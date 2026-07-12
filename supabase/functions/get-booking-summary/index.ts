import { handleOptions, noStoreJson } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  const bookingId = new URL(req.url).searchParams.get("booking_id");
  if (!bookingId) return noStoreJson({ status: 400, code: "BOOKING_REQUIRED" }, 400);
  const { data, error } = await serviceClient().rpc("wp5_get_booking_summary", { p_booking_id: bookingId });
  if (error) return noStoreJson({ status: 500, code: "SERVER_ERROR" }, 500);
  return noStoreJson(data, data.status ?? 200);
});
