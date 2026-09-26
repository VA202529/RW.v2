import { decryptToken, readMollieToken } from "./crypto.ts";
import { sendAdminBookingNotificationOnce, sendTransactionalEmail } from "./email.ts";
import { mollieMode, mollieRequest, mollieValueToCents, type MolliePayment } from "./mollie.ts";
import { serviceClient } from "./supabase.ts";
import { bodyComponent, cents, dateParts, firstName, sendWhatsAppTemplate } from "./whatsapp.ts";

const MOLLIE_TOKEN_ID = "barberflow-rwcutzz";

export type MollieFinalizeResult = {
  action: string;
  bookingId?: string;
};

export async function processMolliePaymentById(
  supabase: ReturnType<typeof serviceClient>,
  paymentId: string,
): Promise<MollieFinalizeResult> {
  const accessToken = await getMollieAccessToken(supabase);
  const payment = await mollieRequest<MolliePayment>(`/payments/${encodeURIComponent(paymentId)}`, {}, accessToken);
  const mode = mollieMode();
  if (payment.mode !== mode) throw new Error("Mollie payment mode mismatch");
  if (payment.amount?.currency !== "EUR") throw new Error("Unexpected Mollie currency");

  const { data: stored, error: storedError } = await supabase
    .from("payments")
    .select("id,booking_id,amount_cents,payment_mode,status")
    .eq("mollie_payment_id", payment.id)
    .eq("payment_provider", "mollie")
    .maybeSingle();
  if (storedError) throw storedError;
  if (!stored) return { action: "unknown_payment" };
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
    }, accessToken, `booking-conflict-${stored.booking_id}`);
    await supabase.rpc("wp_mollie_mark_refunded_conflict", { p_mollie_payment_id: payment.id });
  }

  if (result?.action === "confirmed" || result?.action === "already_confirmed") {
    await sendConfirmationIfNeeded(supabase, stored.booking_id);
  }

  return { action: result?.action ?? "unknown", bookingId: stored.booking_id };
}

async function getMollieAccessToken(supabase: ReturnType<typeof serviceClient>) {
  const { data, error } = await supabase
    .from("mollie_tokens")
    .select("access_token,expires_at")
    .eq("id", MOLLIE_TOKEN_ID)
    .single();
  if (error || !data?.access_token) throw error ?? new Error("Mollie OAuth token is not connected");
  const expiresAtMs = Number(data.expires_at);
  if (!Number.isFinite(expiresAtMs)) throw new Error("Invalid Mollie token expiry");
  if (expiresAtMs <= Date.now() + 5 * 60_000) {
    await refreshMollieToken();
    return await getMollieAccessToken(supabase);
  }
  return readMollieToken(data.access_token);
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
  const { data: delivery } = await supabase
    .from("booking_management_token_delivery")
    .select("encrypted_token")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (!delivery?.encrypted_token) {
    console.error("mollie-finalize missing management token delivery", { booking_id: bookingId });
    return;
  }

  const cancellationToken = await decryptToken(delivery.encrypted_token);
  const emailResult = await sendTransactionalEmail({
    template: "booking_confirmation",
    to: details.customer_email,
    customer_id: details.customer_id,
    booking_id: bookingId,
    data: { ...details, cancel_token: cancellationToken },
  });
  await sendAdminBookingNotificationOnce(details);

  if (emailResult.ok) {
    await supabase.from("booking_management_token_delivery").delete().eq("booking_id", bookingId);
  }

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
    .select("id,starts_at,ends_at,deposit_cents,customers(id,email,auth_user_id,full_name,phone_e164,notification_prefs(whatsapp_opt_in)),services(name,price_cents,duration_minutes)")
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
    duration_minutes: service.duration_minutes,
    deposit_cents: data.deposit_cents,
    price_cents: service.price_cents,
    remaining_cents: Math.max((service.price_cents ?? 0) - data.deposit_cents, 0),
  };
}
