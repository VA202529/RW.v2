import { requireAdmin } from "../_shared/auth.ts";
import { handleOptions, json } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { connectedAccount, stripeClient } from "../_shared/stripe.ts";
import { sendTransactionalEmail } from "../_shared/email.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  const userId = await requireAdmin(req);
  if (!userId) return json({ code: "FORBIDDEN" }, 403);
  try {
    const body = await req.json();
    const supabase = serviceClient();
    if (body.new_status === "cancelled" && body.refund_policy !== "none") {
      const { data: prepared, error } = await supabase.rpc("wp3_admin_cancel_prepare", {
        p_auth_user_id: userId,
        p_booking_id: body.booking_id,
        p_action: body.refund_policy,
      });
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
      const { data: finalized, error: finalError } = await supabase.rpc("wp2_finalize_cancel", {
        p_booking_id: body.booking_id,
        p_action: body.refund_policy,
        p_refunded: refunded,
      });
      if (finalError) throw finalError;
      await sendTransactionalEmail({
        template: "booking_cancelled",
        to: finalized.customer_email,
        customer_id: finalized.customer_id,
        booking_id: body.booking_id,
        data: { ...finalized, deposit_cents: prepared.deposit_cents },
      });
      return json(finalized);
    }
    const { data, error } = await supabase.rpc("wp3_admin_update_booking_status", {
      p_auth_user_id: userId,
      p_booking_id: body.booking_id,
      p_new_status: body.new_status,
      p_refund_policy: body.refund_policy ?? "none",
    });
    if (error) throw error;
    if (body.new_status === "completed" && data.status === 200) {
      const details = await bookingDetails(supabase, body.booking_id);
      if (details) {
        const rawToken = crypto.randomUUID();
        const { data: prepared, error: prepareError } = await supabase.rpc("wp5_prepare_review_request", {
          p_booking_id: body.booking_id,
          p_raw_token: rawToken,
        });
        if (prepareError) throw prepareError;
        if (prepared?.status === 200) {
          await sendTransactionalEmail({ template: "review_request", to: details.email, customer_id: details.customer_id, booking_id: body.booking_id, data: { ...details, review_token: rawToken } });
        }
      }
    }
    return json(data, data.status ?? 200);
  } catch (error) {
    console.error(error);
    return json({ code: "SERVER_ERROR" }, 500);
  }
});

async function bookingDetails(supabase: ReturnType<typeof serviceClient>, bookingId: string) {
  const { data } = await supabase.from("bookings").select("id,starts_at,customers(id,email),services(name)").eq("id", bookingId).single();
  if (!data) return null;
  const customer = Array.isArray(data.customers) ? data.customers[0] : data.customers;
  const service = Array.isArray(data.services) ? data.services[0] : data.services;
  return { booking_id: data.id, starts_at: data.starts_at, customer_id: customer.id, email: customer.email, service_name: service.name };
}
