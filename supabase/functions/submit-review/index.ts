import { authUserId } from "../_shared/auth.ts";
import { handleOptions, json } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  try {
    const body = await req.json();
    const userId = await authUserId(req);
    const { data, error } = await serviceClient().rpc("wp5_submit_review", {
      p_auth_user_id: userId,
      p_booking_id: body.booking_id,
      p_raw_token: body.review_token ?? null,
      p_rating: body.rating,
      p_body: body.body,
    });
    if (error) throw error;
    return json(data, data.status ?? 200);
  } catch (error) {
    console.error(error);
    return json({ code: "SERVER_ERROR" }, 500);
  }
});
