import { requireAdmin } from "../_shared/auth.ts";
import { handleOptions, json } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  const userId = await requireAdmin(req);
  if (!userId) return json({ code: "FORBIDDEN" }, 403);
  const body = await req.json();
  const { data, error } = await serviceClient().rpc("wp4_admin_manage_products", { p_auth_user_id: userId, p_action: body.action, p_payload: body.payload ?? {} });
  if (error) return json({ code: "SERVER_ERROR" }, 500);
  return json(data, data.status ?? 200);
});
