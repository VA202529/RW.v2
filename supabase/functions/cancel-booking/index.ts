import { authUserId } from "../_shared/auth.ts";
import { handleOptions, json } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { connectedAccount, stripeClient } from "../_shared/stripe.ts";
import { sendTransactionalEmail } from "../_shared/email.ts";
import { bodyComponent, cents, dateParts, firstName, sendWhatsAppTemplate } from "../_shared/whatsapp.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  try {
    const body = await req.json();
    const userId = await authUserId(req);
    const supabase = serviceClient();
    const { data: prepared, error } = await supabase.rpc("wp2_prepare_cancel", {
      p_booking_id: body.booking_id,
      p_action: body.action,
      p_auth_user_id: userId,
      p_cancel_token: body.cancellation_token ?? null,
    });
    if (error) throw error;
    if (prepared.status !== 200) return json(prepared, prepared.status);

    let refunded = false;
    if (prepared.requires_refund) {
      if (!prepared.payment_intent_id) return json({ code: "PAYMENT_INTENT_MISSING" }, 500);
      await stripeClient().refunds.create(
        { payment_intent: prepared.payment_intent_id, refund_application_fee: true },
        { stripeAccount: connectedAccount() }
      );
      refunded = true;
    }

    const { data: finalized, error: finalError } = await supabase.rpc("wp2_finalize_cancel", {
      p_booking_id: body.booking_id,
      p_action: body.action,
      p_refunded: refunded,
    });
    if (finalError) throw finalError;
    const details = await bookingDetails(supabase, body.booking_id);
    if (details?.whatsapp_opt_in && details.phone_e164) {
      const parts = dateParts(details.starts_at);
      await sendWhatsAppTemplate({
        to_phone: details.phone_e164,
        template_name: "booking_cancelled",
        customer_id: finalized.customer_id,
        booking_id: body.booking_id,
        components: bodyComponent([firstName(details.customer_name), details.service_name, parts.date, parts.time, cents(prepared.deposit_cents)]),
      });
    }

    await sendTransactionalEmail({
      template: "booking_cancelled",
      to: finalized.customer_email,
      customer_id: finalized.customer_id,
      booking_id: body.booking_id,
      data: { ...finalized, deposit_cents: prepared.deposit_cents },
    });

    return json(finalized, 200);
  } catch (error) {
    console.error(error);
    return json({ code: "SERVER_ERROR" }, 500);
  }
});

async function bookingDetails(supabase: ReturnType<typeof serviceClient>, bookingId: string) {
  const { data } = await supabase.from("bookings").select("id,starts_at,customers(full_name,phone_e164,notification_prefs(whatsapp_opt_in)),services(name)").eq("id", bookingId).single();
  if (!data) return null;
  const customer = Array.isArray(data.customers) ? data.customers[0] : data.customers;
  const service = Array.isArray(data.services) ? data.services[0] : data.services;
  return {
    starts_at: data.starts_at,
    customer_name: customer.full_name,
    phone_e164: customer.phone_e164,
    whatsapp_opt_in: Boolean(Array.isArray(customer.notification_prefs) ? customer.notification_prefs[0]?.whatsapp_opt_in : customer.notification_prefs?.whatsapp_opt_in),
    service_name: service.name,
  };
}
