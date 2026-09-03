import { authUserId } from "../_shared/auth.ts";
import { handleOptions, json } from "../_shared/http.ts";
import { centsToMollieValue, mollieRequest } from "../_shared/mollie.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { readMollieToken } from "../_shared/crypto.ts";
import { sendTransactionalEmailOnce } from "../_shared/email.ts";
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
    if (prepared.status !== 200) return json(prepared, prepared.status, {}, req);

    let refunded = false;
    let refundStatus: "not_required" | "refunded" | "manual_required" = "not_required";
    if (prepared.requires_refund && body.action === "refund") {
      const refundResult = await refundBookingPayment(supabase, body.booking_id, prepared.deposit_cents);
      refunded = refundResult.refunded;
      refundStatus = refundResult.status;
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

    await sendTransactionalEmailOnce({
      template: "booking_cancelled",
      to: finalized.customer_email,
      customer_id: finalized.customer_id,
      booking_id: body.booking_id,
      data: { ...finalized, deposit_cents: prepared.deposit_cents },
    });

    return json({ ...finalized, refund_status: refundStatus }, 200, {}, req);
  } catch (error) {
    console.error(error);
    return json({ code: "SERVER_ERROR" }, 500, {}, req);
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

async function refundBookingPayment(
  supabase: ReturnType<typeof serviceClient>,
  bookingId: string,
  depositCents: number,
) {
  const { data: payment, error } = await supabase
    .from("payments")
    .select("id,amount_cents,payment_provider,mollie_payment_id,stripe_payment_intent_id,status")
    .eq("booking_id", bookingId)
    .eq("status", "paid")
    .gt("amount_cents", 0)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!payment) return { refunded: false, status: "not_required" as const };

  if (payment.payment_provider === "mollie" && payment.mollie_payment_id) {
    const accessToken = await getMollieAccessToken(supabase);
    const refundAmount = Math.min(Number(payment.amount_cents ?? 0), Number(depositCents ?? 0));
    await mollieRequest(
      `/payments/${encodeURIComponent(payment.mollie_payment_id)}/refunds`,
      {
        method: "POST",
        body: JSON.stringify({
          amount: { currency: "EUR", value: centsToMollieValue(refundAmount) },
          description: `RW CUTZZ annulering ${bookingId}`,
        }),
      },
      accessToken,
      `booking-cancel-${bookingId}`,
    );
    return { refunded: true, status: "refunded" as const };
  }

  console.error("Cancellation refund requires manual handling", {
    booking_id: bookingId,
    payment_id: payment.id,
    payment_provider: payment.payment_provider,
  });
  return { refunded: false, status: "manual_required" as const };
}

async function getMollieAccessToken(supabase: ReturnType<typeof serviceClient>) {
  const { data, error } = await supabase
    .from("mollie_tokens")
    .select("access_token")
    .eq("id", "barberflow-rwcutzz")
    .single();
  if (error || !data?.access_token) throw error ?? new Error("Mollie OAuth token is not connected");
  return readMollieToken(data.access_token);
}
