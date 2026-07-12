import { handleOptions, noStoreJson } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  const { data, error } = await serviceClient()
    .from("products")
    .select("id,name,description,price_cents,stock,is_active,image_paths,category")
    .eq("is_active", true)
    .order("name");
  if (error) return noStoreJson({ code: "SERVER_ERROR" }, 500);
  return noStoreJson({ products: data ?? [] });
});
