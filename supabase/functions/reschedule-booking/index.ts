import { authUserId } from "../_shared/auth.ts";
import { handleOptions, json } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { sendTransactionalEmail } from "../_shared/email.ts";
import { bodyComponent, dateParts, firstName, sendWhatsAppTemplate } from "../_shared/whatsapp.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  try {
    const body = await req.json();
    const userId = await authUserId(req);
    const supabase = serviceClient();
    const { data, error } = await supabase.rpc("wp2_reschedule_booking", {
      p_booking_id: body.booking_id,
      p_new_starts_at: body.new_starts_at,
      p_auth_user_id: userId,
      p_cancel_token: body.cancellation_token ?? null,
    });
    if (error) throw error;
    if (data.status !== 200) return json(data, data.status);
    const details = await bookingDetails(supabase, data.new_booking_id);
    if (details?.whatsapp_opt_in && details.phone_e164) {
      const parts = dateParts(data.starts_at);
      await sendWhatsAppTemplate({
        to_phone: details.phone_e164,
        template_name: "booking_rescheduled",
        customer_id: data.customer_id,
        booking_id: data.new_booking_id,
        components: bodyComponent([firstName(details.customer_name), data.service_name, parts.date, parts.time]),
      });
    }
    await sendTransactionalEmail({
      template: "booking_rescheduled",
      to: data.customer_email,
      customer_id: data.customer_id,
      booking_id: data.new_booking_id,
      data,
    });
    return json(data, 200);
  } catch (error) {
    console.error(error);
    return json({ code: "SERVER_ERROR" }, 500);
  }
});

async function bookingDetails(supabase: ReturnType<typeof serviceClient>, bookingId: string) {
  const { data } = await supabase.from("bookings").select("id,customers(full_name,phone_e164,notification_prefs(whatsapp_opt_in))").eq("id", bookingId).single();
  if (!data) return null;
  const customer = Array.isArray(data.customers) ? data.customers[0] : data.customers;
  return {
    customer_name: customer.full_name,
    phone_e164: customer.phone_e164,
    whatsapp_opt_in: Boolean(Array.isArray(customer.notification_prefs) ? customer.notification_prefs[0]?.whatsapp_opt_in : customer.notification_prefs?.whatsapp_opt_in),
  };
}
