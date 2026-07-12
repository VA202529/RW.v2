import { requireInternal } from "../_shared/auth.ts";
import { handleOptions, json } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { sendTransactionalEmail } from "../_shared/email.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (!requireInternal(req)) return json({ code: "FORBIDDEN" }, 403);
  const supabase = serviceClient();
  const { data, error } = await supabase.rpc("wp3_create_platform_invoice_previous_month");
  if (error) return json({ code: "SERVER_ERROR" }, 500);
  const adminEmail = Deno.env.get("ADMIN_EMAIL");
  if (adminEmail) await sendTransactionalEmail({ template: "platform_invoice", to: adminEmail, data });
  return json(data);
});
