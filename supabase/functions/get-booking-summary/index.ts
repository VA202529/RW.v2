import { handleOptions, noStoreJson } from "../_shared/http.ts";
import { authUserId } from "../_shared/auth.ts";
import { serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  const { booking_id: bookingId, cancellation_token: cancellationToken, review_token: reviewToken } = await req.json();
  if (!bookingId) return noStoreJson({ status: 400, code: "BOOKING_REQUIRED" }, 400, req);
  try {
    const supabase = serviceClient();
    const userId = await authUserId(req);
    const { data: booking, error } = await supabase
      .from("bookings")
      .select("id,customer_id,service_id,starts_at,ends_at,status,deposit_cents,cancel_token,customers(auth_user_id),services(id,name,price_cents,duration_minutes)")
      .eq("id", bookingId)
      .maybeSingle();
    if (error) throw error;
    if (!booking) return noStoreJson({ status: 404, code: "BOOKING_NOT_FOUND" }, 404, req);

    const customer = Array.isArray(booking.customers) ? booking.customers[0] : booking.customers;
    const service = Array.isArray(booking.services) ? booking.services[0] : booking.services;
    const tokenAllowed = cancellationToken
      ? await tokenMatches(supabase, booking.cancel_token, cancellationToken)
      : false;
    const reviewAllowed = reviewToken ? await reviewTokenMatches(supabase, bookingId, reviewToken) : false;
    const authAllowed = Boolean(userId && customer?.auth_user_id === userId);
    if (!authAllowed && !tokenAllowed && !reviewAllowed) {
      return noStoreJson({ status: 403, code: "FORBIDDEN" }, 403, req);
    }

    const { data: payment } = await supabase
      .from("payments")
      .select("amount_cents,status,payment_provider,mollie_payment_id,stripe_payment_intent_id")
      .eq("booking_id", bookingId)
      .in("status", ["paid", "refunded", "partially_refunded"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const beforeDeadline = new Date(booking.starts_at).getTime() > Date.now() + 24 * 60 * 60 * 1000;
    const active = booking.status === "confirmed";
    const priceCents = Number(service?.price_cents ?? 0);
    const depositCents = Number(booking.deposit_cents ?? 0);
    return noStoreJson({
      status: 200,
      booking_id: booking.id,
      service_id: booking.service_id,
      service_name: service?.name ?? "Afspraak",
      starts_at: booking.starts_at,
      ends_at: booking.ends_at,
      booking_status: booking.status,
      duration_minutes: Number(service?.duration_minutes ?? Math.round((new Date(booking.ends_at).getTime() - new Date(booking.starts_at).getTime()) / 60000)),
      deposit_cents: depositCents,
      remaining_cents: Math.max(priceCents - depositCents, 0),
      paid_deposit_cents: payment?.status === "paid" ? Number(payment.amount_cents ?? 0) : 0,
      payment_provider: payment?.payment_provider ?? null,
      payment_status: payment?.status ?? null,
      before_cancellation_deadline: beforeDeadline,
      can_cancel: active,
      can_reschedule: active && beforeDeadline,
      already_cancelled: booking.status === "cancelled",
    }, 200, req);
  } catch (error) {
    console.error(error);
    return noStoreJson({ status: 500, code: "SERVER_ERROR" }, 500, req);
  }
});

async function tokenMatches(supabase: ReturnType<typeof serviceClient>, storedHash: string | null, rawToken: string) {
  if (!storedHash || !rawToken) return false;
  const { data, error } = await supabase.rpc("wp2_hash_token", { p_token: rawToken });
  if (error) throw error;
  return data === storedHash;
}

async function reviewTokenMatches(supabase: ReturnType<typeof serviceClient>, bookingId: string, rawToken: string) {
  const { data: hash, error: hashError } = await supabase.rpc("wp2_hash_token", { p_token: rawToken });
  if (hashError) throw hashError;
  const { data, error } = await supabase
    .from("reviews")
    .select("id")
    .eq("booking_id", bookingId)
    .eq("review_token", hash)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}
