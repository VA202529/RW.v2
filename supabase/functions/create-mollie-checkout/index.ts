import { handleOptions, noStoreJson } from "../_shared/http.ts";
import {
  centsToMollieValue,
  mollieCheckoutUrl,
  mollieConfig,
  mollieRequest,
  type MolliePayment,
} from "../_shared/mollie.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { sendTransactionalEmail } from "../_shared/email.ts";
import { bodyComponent, cents, dateParts, firstName, sendWhatsAppTemplate } from "../_shared/whatsapp.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  try {
    const { mode } = mollieConfig();
    console.log("MOLLIE_MODE:", mode);
    console.log("Selected Mollie API key set: true");

    const options = handleOptions(req);
    if (options) return options;

    const body = await req.json();
    console.log("REQUEST BODY:", JSON.stringify(body));
    const bookingId = typeof body?.booking_id === "string" ? body.booking_id : "";
    const serviceId = typeof body?.service_id === "string" ? body.service_id : "";
    if (!UUID_PATTERN.test(bookingId) || !UUID_PATTERN.test(serviceId)) {
      return noStoreJson({ code: "INVALID_BODY" }, 400);
    }

    const supabase = serviceClient();
    const { data, error } = await supabase.rpc("wp_mollie_prepare_booking_checkout", {
      p_booking_id: bookingId,
      p_service_id: serviceId,
      p_payment_mode: mode,
    });
    if (error) throw error;
    if (!data || data.status !== 200) return noStoreJson(data ?? { code: "CHECKOUT_PREPARE_FAILED" }, data?.status ?? 500);

    if (!data.requires_mollie) {
      await sendBookingConfirmation(supabase, bookingId);
      return noStoreJson({ confirmed: true, booking_id: bookingId, status: "confirmed" });
    }

    if (data.mollie_payment_id) {
      const existing = await mollieRequest<MolliePayment>(`/payments/${encodeURIComponent(data.mollie_payment_id)}`);
      if (existing.mode !== mode) throw new Error("Mollie payment mode mismatch");
      if (existing.status === "open" || existing.status === "pending") {
        return noStoreJson({
          checkout_url: mollieCheckoutUrl(existing),
          payment_id: existing.id,
          booking_id: bookingId,
        });
      }
    }

    const siteUrl = (Deno.env.get("PUBLIC_SITE_URL") ?? req.headers.get("origin") ?? "").replace(/\/$/, "");
    const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
    if (!siteUrl || !supabaseUrl) throw new Error("Missing PUBLIC_SITE_URL or SUPABASE_URL");

    const payment = await mollieRequest<MolliePayment>(
      "/payments",
      {
        method: "POST",
        body: JSON.stringify({
          amount: { currency: "EUR", value: centsToMollieValue(data.amount_due_cents) },
          description: `${data.service_name} - afspraak ${bookingId.slice(0, 8)}`,
          redirectUrl: `${siteUrl}/boeken/succes?booking_id=${encodeURIComponent(bookingId)}`,
          cancelUrl: `${siteUrl}/boeken/verlopen`,
          webhookUrl: `${supabaseUrl}/functions/v1/mollie-webhook`,
          method: "ideal",
          metadata: { booking_id: bookingId, service_id: serviceId, payment_mode: mode },
        }),
      },
      `booking-${bookingId}`,
    );

    if (payment.mode !== mode) throw new Error("Mollie response mode mismatch");
    const checkoutUrl = mollieCheckoutUrl(payment);
    const { data: attached, error: attachError } = await supabase.rpc("wp_mollie_attach_payment", {
      p_payment_id: data.payment_id,
      p_mollie_payment_id: payment.id,
      p_provider_status: payment.status,
    });
    if (attachError || attached !== true) throw attachError ?? new Error("Could not attach Mollie payment");

    return noStoreJson({ checkout_url: checkoutUrl, payment_id: payment.id, booking_id: bookingId }, 201);
  } catch (error) {
    console.error("CRASH:", String(error), error instanceof Error ? error.stack : undefined);
    return noStoreJson({ code: "SERVER_ERROR", detail: String(error) }, 500);
  }
});

async function sendBookingConfirmation(supabase: ReturnType<typeof serviceClient>, bookingId: string) {
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
}

async function bookingDetails(supabase: ReturnType<typeof serviceClient>, bookingId: string) {
  const { data, error } = await supabase
    .from("bookings")
    .select("id,starts_at,ends_at,deposit_cents,customers(id,email,full_name,phone_e164,notification_prefs(whatsapp_opt_in)),services(name,price_cents)")
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
    service_name: service.name,
    starts_at: data.starts_at,
    ends_at: data.ends_at,
    deposit_cents: data.deposit_cents,
    remaining_cents: Math.max((service.price_cents ?? 0) - data.deposit_cents, 0),
  };
}
