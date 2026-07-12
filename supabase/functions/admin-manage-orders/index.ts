import { requireAdmin } from "../_shared/auth.ts";
import { handleOptions, json } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { sendTransactionalEmail } from "../_shared/email.ts";
import { connectedAccount, stripeClient } from "../_shared/stripe.ts";
import { bodyComponent, firstName, sendWhatsAppTemplate } from "../_shared/whatsapp.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  const userId = await requireAdmin(req);
  if (!userId) return json({ code: "FORBIDDEN" }, 403);
  try {
    const body = await req.json();
    const supabase = serviceClient();
    if (body.action === "cancel_order") {
      const { data: prepared, error } = await supabase.rpc("wp4_admin_prepare_cancel_order", { p_auth_user_id: userId, p_order_id: body.payload?.order_id });
      if (error) throw error;
      if (prepared.status !== 200) return json(prepared, prepared.status);
      let refunded = false;
      if (prepared.requires_refund) {
        await stripeClient().refunds.create(
          { payment_intent: prepared.payment_intent_id, refund_application_fee: true },
          { stripeAccount: connectedAccount() },
        );
        refunded = true;
      }
      const { data: finalized, error: finalError } = await supabase.rpc("wp4_finalize_cancel_order", { p_order_id: body.payload?.order_id, p_refunded: refunded });
      if (finalError) throw finalError;
      await sendTransactionalEmail({ template: "order_cancelled", to: finalized.customer_email, customer_id: finalized.customer_id, order_id: body.payload?.order_id, data: finalized });
      return json(finalized);
    }
    const { data, error } = await supabase.rpc("wp4_admin_manage_orders", { p_auth_user_id: userId, p_action: body.action, p_payload: body.payload ?? {} });
    if (error) throw error;
    if (body.action === "update_status" && body.payload?.status === "ready_for_pickup" && data.order) {
      const details = await orderDetails(supabase, data.order.id);
      if (details) {
        if (details.whatsapp_opt_in && details.phone_e164) {
          await sendWhatsAppTemplate({
            to_phone: details.phone_e164,
            template_name: "order_ready",
            customer_id: details.customer_id,
            order_id: data.order.id,
            components: bodyComponent([firstName(details.customer_name), details.items_summary, Deno.env.get("BARBER_OPENING_HOURS") ?? "openingstijden in de zaak"]),
          });
        }
        await sendTransactionalEmail({ template: "order_ready", to: details.customer_email, customer_id: details.customer_id, order_id: data.order.id, data: { ...details, opening_hours: Deno.env.get("BARBER_OPENING_HOURS") } });
      }
    }
    return json(data, data.status ?? 200);
  } catch (error) {
    console.error(error);
    return json({ code: "SERVER_ERROR" }, 500);
  }
});

async function orderDetails(supabase: ReturnType<typeof serviceClient>, orderId: string) {
  const { data } = await supabase.from("orders").select("id,total_cents,customers(id,email,full_name,phone_e164,notification_prefs(whatsapp_opt_in))").eq("id", orderId).single();
  if (!data) return null;
  const customer = Array.isArray(data.customers) ? data.customers[0] : data.customers;
  const { data: items } = await supabase.from("order_items").select("quantity,products(name)").eq("order_id", orderId);
  const itemsSummary = (items ?? []).map((item: any) => `${Array.isArray(item.products) ? item.products[0]?.name : item.products?.name} x${item.quantity}`).join(", ");
  return {
    order_id: data.id,
    total_cents: data.total_cents,
    customer_id: customer.id,
    customer_email: customer.email,
    customer_name: customer.full_name,
    phone_e164: customer.phone_e164,
    whatsapp_opt_in: Boolean(Array.isArray(customer.notification_prefs) ? customer.notification_prefs[0]?.whatsapp_opt_in : customer.notification_prefs?.whatsapp_opt_in),
    items_summary: itemsSummary,
  };
}
