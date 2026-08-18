import { handleOptions, noStoreJson } from "../_shared/http.ts";
import {
  centsToMollieValue,
  mollieCheckoutUrl,
  mollieRequest,
  mollieMode,
  type MolliePayment,
} from "../_shared/mollie.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { sendTransactionalEmail } from "../_shared/email.ts";
import { bodyComponent, cents, dateParts, firstName, sendWhatsAppTemplate } from "../_shared/whatsapp.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MOLLIE_TOKEN_ID = "barberflow-rwcutzz";

Deno.serve(async (req) => {
  try {
    const mode = mollieMode();

    const options = handleOptions(req);
    if (options) return options;

    const body = await req.json();
    const bookingId = typeof body?.booking_id === "string" ? body.booking_id : "";
    const serviceId = typeof body?.service_id === "string" ? body.service_id : "";
    console.log("[mollie-checkout] creating payment");
    if (!UUID_PATTERN.test(bookingId) || !UUID_PATTERN.test(serviceId)) {
      return noStoreJson({ code: "INVALID_BODY" }, 400, req);
    }

    const supabase = serviceClient();
    const mollieToken = await getMollieToken(supabase);
    const { data, error } = await supabase.rpc("wp_mollie_prepare_booking_checkout", {
      p_booking_id: bookingId,
      p_service_id: serviceId,
      p_payment_mode: mode,
    });
    if (error) throw error;
    if (!data || data.status !== 200) return noStoreJson(data ?? { code: "CHECKOUT_PREPARE_FAILED" }, data?.status ?? 500, req);

    if (!data.requires_mollie) {
      await sendBookingConfirmation(supabase, bookingId);
      return noStoreJson({ confirmed: true, booking_id: bookingId, status: "confirmed" }, 200, req);
    }

    if (data.mollie_payment_id) {
      const existing = await mollieRequest<MolliePayment>(
        `/payments/${encodeURIComponent(data.mollie_payment_id)}`,
        {},
        mollieToken.access_token,
      );
      if (existing.mode !== mode) throw new Error("Mollie payment mode mismatch");
      if (existing.status === "open" || existing.status === "pending") {
        return noStoreJson({
          checkout_url: mollieCheckoutUrl(existing),
          payment_id: existing.id,
          booking_id: bookingId,
        }, 200, req);
      }
    }

    const siteUrl = (Deno.env.get("PUBLIC_SITE_URL") ?? req.headers.get("origin") ?? "").replace(/\/$/, "");
    const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
    if (!siteUrl || !supabaseUrl) throw new Error("Missing PUBLIC_SITE_URL or SUPABASE_URL");

    const paymentBody = {
      profileId: mollieToken.profile_id,
      amount: { currency: "EUR", value: centsToMollieValue(data.amount_due_cents) },
      description: `${data.service_name} - afspraak ${bookingId.slice(0, 8)}`,
      redirectUrl: `${siteUrl}/boeken/succes?booking_id=${encodeURIComponent(bookingId)}`,
      cancelUrl: `${siteUrl}/boeken/verlopen`,
      webhookUrl: `${supabaseUrl}/functions/v1/mollie-webhook`,
      method: "ideal",
      applicationFee: {
        amount: { currency: "EUR", value: "0.61" },
        description: "Van Appiah platform fee",
      },
      metadata: { booking_id: bookingId, service_id: serviceId, payment_mode: mode },
    };
    const payment = await createMolliePaymentWithRetry(supabase, mollieToken.access_token, paymentBody, bookingId);

    if (payment.mode !== mode) throw new Error("Mollie response mode mismatch");
    const checkoutUrl = mollieCheckoutUrl(payment);
    const { data: attached, error: attachError } = await supabase.rpc("wp_mollie_attach_payment", {
      p_payment_id: data.payment_id,
      p_mollie_payment_id: payment.id,
      p_provider_status: payment.status,
    });
    if (attachError || attached !== true) throw attachError ?? new Error("Could not attach Mollie payment");

    return noStoreJson({ checkout_url: checkoutUrl, payment_id: payment.id, booking_id: bookingId }, 201, req);
  } catch (error) {
    console.error("CRASH:", String(error), error instanceof Error ? error.stack : undefined);
    return noStoreJson({ code: "SERVER_ERROR" }, 500, req);
  }
});

async function getMollieToken(supabase: ReturnType<typeof serviceClient>) {
  const { data, error } = await supabase
    .from("mollie_tokens")
    .select("access_token,refresh_token,expires_at,profile_id")
    .eq("id", MOLLIE_TOKEN_ID)
    .single();
  if (error || !data?.access_token || !data?.profile_id) {
    throw error ?? new Error("Mollie OAuth token is not connected");
  }

  if (new Date(data.expires_at).getTime() <= Date.now() + 5 * 60_000) {
    await refreshMollieToken();
    return await getMollieToken(supabase);
  }

  return data;
}

async function createMolliePaymentWithRetry(
  supabase: ReturnType<typeof serviceClient>,
  accessToken: string,
  paymentBody: Record<string, unknown>,
  bookingId: string,
) {
  try {
    return await mollieRequest<MolliePayment>("/payments", {
      method: "POST",
      body: JSON.stringify(paymentBody),
    }, accessToken, `booking-${bookingId}`);
  } catch (error) {
    if (!isMollieUnauthorized(error)) throw error;
    await refreshMollieToken();
    const refreshed = await getMollieToken(supabase);
    return await mollieRequest<MolliePayment>("/payments", {
      method: "POST",
      body: JSON.stringify(paymentBody),
    }, refreshed.access_token, `booking-${bookingId}`);
  }
}

async function refreshMollieToken() {
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing Supabase configuration for Mollie token refresh");

  const response = await fetch(`${supabaseUrl}/functions/v1/mollie-token-refresh`, {
    method: "POST",
    headers: { Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" },
  });
  if (!response.ok) throw new Error(`Mollie token refresh function failed ${response.status}: ${await response.text()}`);
}

function isMollieUnauthorized(error: unknown) {
  return error instanceof Error && error.message.includes("Mollie API returned 401");
}

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
