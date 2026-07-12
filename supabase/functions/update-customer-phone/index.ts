import { authUserId } from "../_shared/auth.ts";
import { handleOptions, json } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  const userId = await authUserId(req);
  if (!userId) return json({ code: "UNAUTHENTICATED" }, 401);
  try {
    const body = await req.json();
    const { data, error } = await serviceClient().rpc("wp6_update_customer_phone", {
      p_auth_user_id: userId,
      p_phone_e164: body.phone_e164,
    });
    if (error) throw error;
    return json(data, data.status ?? 200);
  } catch (error) {
    console.error(error);
    return json({ code: "SERVER_ERROR" }, 500);
  }
});
