import { requireAdmin } from "../_shared/auth.ts";
import { sendAdminBookingNotificationOnce } from "../_shared/email.ts";
import { handleOptions, json } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  const userId = await requireAdmin(req);
  if (!userId) return json({ code: "FORBIDDEN" }, 403);
  const body = await req.json();
  const supabase = serviceClient();
  const { data, error } = await supabase.rpc("wp3_admin_manual_booking", {
    p_auth_user_id: userId,
    p_service_id: body.service_id,
    p_starts_at: body.starts_at,
    p_full_name: body.full_name,
    p_email: body.email,
    p_phone_e164: body.phone_e164 || null,
  });
  if (error) return json({ code: "SERVER_ERROR" }, 500);
  if (data?.status === 201 && data.booking_id) {
    try {
      const details = await bookingDetails(supabase, data.booking_id);
      if (details) await sendAdminBookingNotificationOnce(details);
    } catch (notifyError) {
      console.error("admin manual booking notification failed", notifyError);
    }
  }
  return json(data, data.status ?? 200);
});

async function bookingDetails(supabase: ReturnType<typeof serviceClient>, bookingId: string) {
  const { data, error } = await supabase
    .from("bookings")
    .select("id,starts_at,ends_at,deposit_cents,customers(id,email,full_name,phone_e164),services(name,price_cents,duration_minutes)")
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
    service_name: service.name,
    starts_at: data.starts_at,
    ends_at: data.ends_at,
    duration_minutes: service.duration_minutes,
    deposit_cents: data.deposit_cents,
    price_cents: service.price_cents,
    remaining_cents: Math.max((service.price_cents ?? 0) - data.deposit_cents, 0),
  };
}
