import { requireInternal } from "../_shared/auth.ts";
import { handleOptions, json } from "../_shared/http.ts";
import { sendWhatsAppTemplate } from "../_shared/whatsapp.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (!requireInternal(req)) return json({ code: "FORBIDDEN" }, 403);
  try {
    const body = await req.json();
    const result = await sendWhatsAppTemplate({
      to_phone: body.to_phone,
      template_name: body.template_name,
      language_code: body.language_code ?? "nl",
      components: body.components ?? [],
      customer_id: body.customer_id,
      booking_id: body.booking_id,
      order_id: body.order_id,
    });
    return json(result);
  } catch (error) {
    console.error(error);
    return json({ status: "failed", error: "SERVER_ERROR" });
  }
});
