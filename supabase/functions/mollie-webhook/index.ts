import { noStoreJson } from "../_shared/http.ts";
import { mollieConfig, mollieRequest, mollieValueToCents, type MolliePayment } from "../_shared/mollie.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { sendTransactionalEmail } from "../_shared/email.ts";
import { bodyComponent, cents, dateParts, firstName, sendWhatsAppTemplate } from "../_shared/whatsapp.ts";

const PAYMENT_ID_PATTERN = /^tr_[A-Za-z0-9]{5,64}$/;

Deno.serve(async (req) => {
  try {
    const paymentId = await readPaymentId(req);
    if (!PAYMENT_ID_PATTERN.test(paymentId)) return noStoreJson({ received: true, ignored: true });

    const payment = await mollieRequest<MolliePayment>(`/payments/${encodeURIComponent(paymentId)}`);
    const { mode } = mollieConfig();
    if (payment.mode !== mode) throw new Error("Mollie payment mode mismatch");
    if (payment.amount?.currency !== "EUR") throw new Error("Unexpected Mollie currency");

    const supabase = serviceClient();
    const { data: stored, error: storedError } = await supabase
      .from("payments")
      .select("id,booking_id,amount_cents,payment_mode,status")
      .eq("mollie_payment_id", payment.id)
      .eq("payment_provider", "mollie")
      .maybeSingle();
    if (storedError) throw storedError;
    if (!stored) return noStoreJson({ received: true, ignored: true });
    if (stored.payment_mode !== payment.mode) throw new Error("Stored Mollie mode mismatch");
    if (stored.amount_cents !== mollieValueToCents(payment.amount.value)) throw new Error("Stored Mollie amount mismatch");

    const { data: result, error } = await supabase.rpc("wp_mollie_process_payment", {
      p_mollie_payment_id: payment.id,
      p_provider_status: payment.status,
      p_paid_at: payment.paidAt ?? null,
    });
    if (error) throw error;

    if (result?.action === "refund_required") {
      await mollieRequest(`/payments/${encodeURIComponent(payment.id)}/refunds`, {
        method: "POST",
        body: JSON.stringify({
          amount: payment.amount,
          description: `Automatische terugbetaling boeking ${stored.booking_id}`,
          metadata: { booking_id: stored.booking_id, reason: "slot_conflict" },
        }),
      }, `booking-conflict-${stored.booking_id}`);
      await supabase.rpc("wp_mollie_mark_refunded_conflict", { p_mollie_payment_id: payment.id });
    }

    if (result?.action === "confirmed" || result?.action === "already_confirmed") {
      await sendConfirmationIfNeeded(supabase, stored.booking_id);
    }

    return noStoreJson({ received: true });
  } catch (error) {
    // Mollie expects 200. The error remains visible in function logs for reconciliation.
    console.error("mollie-webhook failed", error);
    return noStoreJson({ received: true, processed: false });
  }
});

async function readPaymentId(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await req.json();
    return typeof body?.id === "string" ? body.id : "";
  }
  const form = new URLSearchParams(await req.text());
  return form.get("id") ?? "";
}

async function sendConfirmationIfNeeded(supabase: ReturnType<typeof serviceClient>, bookingId: string) {
  const { data: existing } = await supabase
    .from("message_log")
    .select("id")
    .eq("booking_id", bookingId)
    .eq("template", "booking_confirmation")
    .eq("status", "sent")
    .limit(1);
  if ((existing ?? []).length > 0) return;

  const details = await bookingDetails(supabase, bookingId);
  if (!details) return;
  if (details.whatsapp_opt_in && details.phone_e164) {
    const parts = dateParts(details.starts_at);
    await sendWhatsAppTemplate({
      to_phone: details.phone_e164,
      template_name: "booking_confirmation",
      customer_id: details.customer_id,
      booking_id: bookingId,
      components: bodyComponent([
        firstName(details.customer_name),
        details.service_name,
        parts.date,
        parts.time,
        cents(details.deposit_cents),
      ]),
    });
  }
  await sendTransactionalEmail({
    template: "booking_confirmation",
    to: details.customer_email,
    customer_id: details.customer_id,
    booking_id: bookingId,
    data: details,
  });

  if (!details.auth_user_id) {
    const { data: shouldSendMagicLink } = await supabase.rpc("wp3_should_send_magic_link", {
      p_customer_id: details.customer_id,
    });
    if (shouldSendMagicLink) {
      const { data: link } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: details.customer_email,
        options: { redirectTo: `${Deno.env.get("PUBLIC_SITE_URL") ?? "http://localhost:5173"}/account` },
      });
      if (link?.properties?.action_link) {
        await sendTransactionalEmail({
          template: "magic_link",
          to: details.customer_email,
          customer_id: details.customer_id,
          booking_id: bookingId,
          data: { magic_link: link.properties.action_link },
        });
      }
    }
  }
}

async function bookingDetails(supabase: ReturnType<typeof serviceClient>, bookingId: string) {
  const { data, error } = await supabase
    .from("bookings")
    .select("id,starts_at,ends_at,deposit_cents,customers(id,email,auth_user_id,full_name,phone_e164,notification_prefs(whatsapp_opt_in)),services(name,price_cents)")
    .eq("id", bookingId)
    .single();
  if (error || !data) return null;
  const customer = Array.isArray(data.customers) ? data.customers[0] : data.customers;
  const service = Array.isArray(data.services) ? data.services[0] : data.services;
  return {
    booking_id: data.id,
    customer_id: customer.id,
    customer_email: customer.email,
    customer_name: customer.full_name,
    phone_e164: customer.phone_e164,
    whatsapp_opt_in: Boolean(Array.isArray(customer.notification_prefs) ? customer.notification_prefs[0]?.whatsapp_opt_in : customer.notification_prefs?.whatsapp_opt_in),
    auth_user_id: customer.auth_user_id,
    service_name: service.name,
    starts_at: data.starts_at,
    ends_at: data.ends_at,
    deposit_cents: data.deposit_cents,
    remaining_cents: Math.max((service.price_cents ?? 0) - data.deposit_cents, 0),
  };
}
