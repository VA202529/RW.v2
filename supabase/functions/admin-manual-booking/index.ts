import { requireAdmin } from "../_shared/auth.ts";
import { handleOptions, json } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  const userId = await requireAdmin(req);
  if (!userId) return json({ code: "FORBIDDEN" }, 403);
  const body = await req.json();
  const { data, error } = await serviceClient().rpc("wp3_admin_manual_booking", {
    p_auth_user_id: userId,
    p_service_id: body.service_id,
    p_starts_at: body.starts_at,
    p_full_name: body.full_name,
    p_email: body.email,
    p_phone_e164: body.phone_e164 || null,
  });
  if (error) return json({ code: "SERVER_ERROR" }, 500);
  return json(data, data.status ?? 200);
});
