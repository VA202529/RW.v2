import { requireAdmin } from "../_shared/auth.ts";
import { handleOptions, json } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  const userId = await requireAdmin(req);
  if (!userId) return json({ code: "FORBIDDEN" }, 403);
  try {
    const body = await req.json();
    const { data, error } = await serviceClient().rpc("wp5_admin_manage_reviews", {
      p_auth_user_id: userId,
      p_action: body.action ?? "list",
      p_payload: body.payload ?? {},
    });
    if (error) throw error;
    return json(data, data.status ?? 200);
  } catch (error) {
    console.error(error);
    return json({ code: "SERVER_ERROR" }, 500);
  }
});
