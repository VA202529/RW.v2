import { requireInternal } from "../_shared/auth.ts";
import { handleOptions, json } from "../_shared/http.ts";
import { sendTransactionalEmail } from "../_shared/email.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { bodyComponent, cents, dateParts, firstName, sendWhatsAppTemplate } from "../_shared/whatsapp.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (!requireInternal(req)) return json({ code: "FORBIDDEN" }, 403);
  try {
    const { kind } = await req.json();
    const { data, error } = await serviceClient().rpc("wp2_due_emails", { p_kind: kind });
    if (error) throw error;
    const supabase = serviceClient();
    for (const item of data ?? []) {
      if (item.template === "review_request") {
        const rawToken = crypto.randomUUID();
        const { data: prepared, error: prepareError } = await supabase.rpc("wp5_prepare_review_request", {
          p_booking_id: item.booking_id,
          p_raw_token: rawToken,
        });
        if (prepareError) throw prepareError;
        if (prepared?.status !== 200) continue;
        item.review_token = rawToken;
      }
      if ((item.template === "booking_reminder_48h" || item.template === "booking_reminder_3h") && item.whatsapp_opt_in === true && item.phone_e164) {
        const parts = dateParts(item.starts_at);
        const waTemplate = item.template === "booking_reminder_3h" ? "booking_reminder_sameday" : "booking_reminder_48h";
        const waResult = await sendWhatsAppTemplate({
          to_phone: item.phone_e164,
          template_name: waTemplate,
          customer_id: item.customer_id,
          booking_id: item.booking_id,
          components: bodyComponent([firstName(item.customer_name), item.service_name, parts.date, parts.time, cents(item.deposit_cents)]),
        });
        await supabase.rpc("wp6_set_booking_reminder_channel", {
          p_booking_id: item.booking_id,
          p_channel: waResult.status === "sent" ? "whatsapp" : "email",
        });
      }
      await sendTransactionalEmail({
        template: item.template,
        to: item.to,
        customer_id: item.customer_id,
        booking_id: item.booking_id,
        data: item,
      });
    }
    return json({ status: 200, count: data?.length ?? 0 });
  } catch (error) {
    console.error(error);
    return json({ code: "SERVER_ERROR" }, 500);
  }
});
