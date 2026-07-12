import { authUserId } from "../_shared/auth.ts";
import { handleOptions, json } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  const userId = await authUserId(req);
  if (!userId) return json({ code: "UNAUTHENTICATED" }, 401);
  try {
    const supabase = serviceClient();
    const { data, error } = await supabase.rpc("wp2_delete_account_prepare", { p_auth_user_id: userId });
    if (error) throw error;
    if (data.status !== 200) return json(data, data.status);
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;
    return json({ status: 200 });
  } catch (error) {
    console.error(error);
    return json({ code: "SERVER_ERROR" }, 500);
  }
});
