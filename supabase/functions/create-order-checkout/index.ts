import { handleOptions, json } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { connectedAccount, stripeClient } from "../_shared/stripe.ts";
import { sendTransactionalEmail } from "../_shared/email.ts";
import { bodyComponent, cents, firstName, sendWhatsAppTemplate } from "../_shared/whatsapp.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  try {
    const { order_id, cancellation_token } = await req.json();
    const origin = req.headers.get("origin") ?? Deno.env.get("PUBLIC_SITE_URL") ?? "http://localhost:5173";
    const supabase = serviceClient();
    const { data, error } = await supabase.rpc("wp4_prepare_order_checkout", { p_order_id: order_id });
    if (error) throw error;
    if (data.status !== 200) return json(data, data.status);
    if (!data.requires_stripe) {
      const details = await orderDetails(supabase, order_id);
      if (details?.whatsapp_opt_in && details.phone_e164) {
        await sendWhatsAppTemplate({
          to_phone: details.phone_e164,
          template_name: "order_confirmation",
          customer_id: data.customer_id,
          order_id,
          components: bodyComponent([firstName(details.customer_name), details.items_summary, cents(data.total_cents)]),
        });
      }
      await sendTransactionalEmail({ template: "order_confirmation", to: data.customer_email, customer_id: data.customer_id, order_id, data: { ...data, cancel_token: cancellation_token } });
      return json({ paid: true, order_id });
    }
    const stripe = stripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["ideal"],
      locale: "nl",
      customer_email: data.customer_email,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      success_url: `${origin}/winkel/succes?order_id=${order_id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/winkel/mislukt?order_id=${order_id}`,
      metadata: { order_id, cancel_token: cancellation_token ?? "" },
      payment_intent_data: { application_fee_amount: data.application_fee_cents, metadata: { order_id } },
      line_items: data.items.map((item: any) => ({
        quantity: item.quantity,
        price_data: { currency: "eur", unit_amount: item.unit_price_cents, product_data: { name: item.name } },
      })),
    }, { stripeAccount: connectedAccount() });
    await supabase.rpc("wp4_attach_order_checkout", {
      p_payment_id: data.payment_id,
      p_session_id: session.id,
      p_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
    });
    return json({ url: session.url, order_id, amount_due_cents: data.amount_due_cents });
  } catch (error) {
    console.error(error);
    return json({ code: "SERVER_ERROR" }, 500);
  }
});

async function orderDetails(supabase: ReturnType<typeof serviceClient>, orderId: string) {
  const { data } = await supabase.from("orders").select("id,customers(full_name,phone_e164,notification_prefs(whatsapp_opt_in))").eq("id", orderId).single();
  if (!data) return null;
  const customer = Array.isArray(data.customers) ? data.customers[0] : data.customers;
  const { data: items } = await supabase.from("order_items").select("quantity,products(name)").eq("order_id", orderId);
  return {
    customer_name: customer.full_name,
    phone_e164: customer.phone_e164,
    whatsapp_opt_in: Boolean(Array.isArray(customer.notification_prefs) ? customer.notification_prefs[0]?.whatsapp_opt_in : customer.notification_prefs?.whatsapp_opt_in),
    items_summary: (items ?? []).map((item: any) => `${Array.isArray(item.products) ? item.products[0]?.name : item.products?.name} x${item.quantity}`).join(", "),
  };
}
