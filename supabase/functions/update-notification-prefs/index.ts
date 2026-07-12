import { authUserId } from "../_shared/auth.ts";
import { handleOptions, json } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  const userId = await authUserId(req);
  if (!userId) return json({ code: "UNAUTHENTICATED" }, 401);
  const body = await req.json();
  const { data, error } = await serviceClient().rpc("wp2_update_notification_prefs", {
    p_auth_user_id: userId,
    p_whatsapp_opt_in: body.whatsapp_opt_in === true,
    p_marketing_email_opt_in: body.marketing_email_opt_in === true,
  });
  if (error) return json({ code: "SERVER_ERROR" }, 500);
  return json(data, data.status ?? 200);
});
