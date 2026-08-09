import { requireAdmin } from "../_shared/auth.ts";
import { handleOptions, json } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  const userId = await requireAdmin(req);
  if (!userId) return json({ code: "FORBIDDEN" }, 403);
  const body = await req.json();
  const { action, ...rest } = body;
  const supabase = serviceClient();

  if (action === "add_block") {
    const { data, error } = await supabase.rpc("wp3_admin_add_time_block", {
      p_auth_user_id: userId,
      p_date: rest.date,
      p_start_time: rest.start_time,
      p_end_time: rest.end_time,
      p_note: typeof rest.note === "string" ? rest.note : null,
    });
    if (error) return json({ code: "SERVER_ERROR" }, 500);
    return json(data, data.status ?? 200);
  }

  const normalizedAction = action === "delete_block" ? "delete_blocked_slot" : action;
  const { data, error } = await supabase.rpc("wp3_admin_manage_availability", {
    p_auth_user_id: userId,
    p_action: normalizedAction,
    p_payload: body.payload ?? rest ?? {},
  });
  if (error) return json({ code: "SERVER_ERROR" }, 500);
  return json(data, data.status ?? 200);
});
