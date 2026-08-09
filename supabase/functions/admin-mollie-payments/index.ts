import { requireAdmin } from "../_shared/auth.ts";
import { handleOptions, noStoreJson } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  const userId = await requireAdmin(req);
  if (!userId) return noStoreJson({ code: "FORBIDDEN" }, 403);

  try {
    const body = await req.json();
    const { data, error } = await serviceClient().rpc("wp_mollie_admin_payments", {
      p_auth_user_id: userId,
      p_from: body.date_from,
      p_to: body.date_to,
    });
    if (error) throw error;
    return noStoreJson(data, data?.status ?? 200);
  } catch (error) {
    console.error("admin-mollie-payments failed", error);
    return noStoreJson({ code: "SERVER_ERROR" }, 500);
  }
});
