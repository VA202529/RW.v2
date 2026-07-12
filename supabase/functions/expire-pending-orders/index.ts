import { handleOptions, json } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  const { data, error } = await serviceClient().rpc("wp4_expire_pending_orders");
  if (error) return json({ code: "SERVER_ERROR" }, 500);
  return json({ expired: data });
});
