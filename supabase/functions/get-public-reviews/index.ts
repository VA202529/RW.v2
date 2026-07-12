import { handleOptions, noStoreJson } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  const { data, error } = await serviceClient().rpc("wp5_public_reviews");
  if (error) return noStoreJson({ status: 500, code: "SERVER_ERROR" }, 500);
  return noStoreJson({ status: 200, reviews: data ?? [] });
});
