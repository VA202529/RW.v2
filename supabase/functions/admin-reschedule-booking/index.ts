import { requireAdmin } from "../_shared/auth.ts";
import { handleOptions, json } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { sendTransactionalEmail } from "../_shared/email.ts";
import { bodyComponent, dateParts, firstName, sendWhatsAppTemplate } from "../_shared/whatsapp.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  const userId = await requireAdmin(req);
  if (!userId) return json({ code: "FORBIDDEN" }, 403, {}, req);

  try {
    const body = await req.json();
    if (!body.booking_id || !body.new_starts_at) {
      return json({ code: "INVALID_BODY" }, 400, {}, req);
    }

    const supabase = serviceClient();
    const { data, error } = await supabase.rpc("wp2_reschedule_booking", {
      p_booking_id: body.booking_id,
      p_new_starts_at: body.new_starts_at,
      p_auth_user_id: userId,
      p_cancel_token: null,
    });
    if (error) {
      console.error("admin-reschedule rpc", error);
      return json({ code: "SERVER_ERROR" }, 500, {}, req);
    }
    if (data.status !== 200) return json(data, data.status ?? 400, {}, req);

    const notification = { email: "unknown", whatsapp: "unknown" };
    const details = await bookingDetails(supabase, data.new_booking_id);

    if (details?.whatsapp_opt_in && details.phone_e164) {
      try {
        const parts = dateParts(data.starts_at);
        await sendWhatsAppTemplate({
          to_phone: details.phone_e164,
          template_name: "booking_rescheduled",
          customer_id: data.customer_id,
          booking_id: data.new_booking_id,
          components: bodyComponent([firstName(details.customer_name), data.service_name, parts.date, parts.time]),
        });
        notification.whatsapp = "sent";
      } catch (notifyError) {
        console.error("admin-reschedule whatsapp", notifyError);
        notification.whatsapp = "failed";
      }
    }

    try {
      await sendTransactionalEmail({
        template: "booking_rescheduled",
        to: data.customer_email,
        customer_id: data.customer_id,
        booking_id: data.new_booking_id,
        data,
      });
      notification.email = "sent";
    } catch (notifyError) {
      console.error("admin-reschedule email", notifyError);
      notification.email = "failed";
    }

    return json({ ...data, notification }, 200, {}, req);
  } catch (error) {
    console.error("admin-reschedule", error);
    return json({ code: "SERVER_ERROR" }, 500, {}, req);
  }
});

async function bookingDetails(supabase: ReturnType<typeof serviceClient>, bookingId: string) {
  const { data } = await supabase
    .from("bookings")
    .select("id,customers(full_name,phone_e164,notification_prefs(whatsapp_opt_in))")
    .eq("id", bookingId)
    .single();
  if (!data) return null;
  const customer = Array.isArray(data.customers) ? data.customers[0] : data.customers;
  return {
    customer_name: customer.full_name,
    phone_e164: customer.phone_e164,
    whatsapp_opt_in: Boolean(Array.isArray(customer.notification_prefs) ? customer.notification_prefs[0]?.whatsapp_opt_in : customer.notification_prefs?.whatsapp_opt_in),
  };
}
