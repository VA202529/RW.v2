import { authUserId } from "../_shared/auth.ts";
import { handleOptions, json } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  const userId = await authUserId(req);
  if (!userId) return json({ code: "UNAUTHENTICATED" }, 401);
  const { data, error } = await serviceClient().rpc("wp2_get_account", { p_auth_user_id: userId });
  if (error) return json({ code: "SERVER_ERROR" }, 500);
  const { data: orders } = await serviceClient().rpc("wp4_get_account_orders", { p_auth_user_id: userId });
  const { data: reviews } = await serviceClient().rpc("wp5_get_account_reviews", { p_auth_user_id: userId });
  return json({ ...data, orders: orders ?? [], reviews: reviews ?? [] }, data.status ?? 200);
});
