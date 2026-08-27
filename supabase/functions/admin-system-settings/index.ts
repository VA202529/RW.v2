import { requireAdmin } from "../_shared/auth.ts";
import { handleOptions, json } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  try {
    const body = await req.json().catch(() => ({}));
    const supabase = serviceClient();
    if (body.action === "get") {
      const { data, error } = await supabase.from("system_settings").select("value").eq("key", "booking_open").single();
      if (error) return json({ code: "SERVER_ERROR" }, 500, {}, req);
      return json({ booking_open: data?.value === true || data?.value === "true" }, 200, {}, req);
    }
    const userId = await requireAdmin(req);
    if (!userId) return json({ code: "FORBIDDEN" }, 403, {}, req);
    if (body.action !== "set_booking_open" || typeof body.booking_open !== "boolean") {
      return json({ code: "INVALID_ACTION" }, 400, {}, req);
    }
    const { error } = await supabase.from("system_settings").upsert({
      key: "booking_open",
      value: body.booking_open,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    });
    if (error) return json({ code: "SERVER_ERROR" }, 500, {}, req);
    return json({ booking_open: body.booking_open }, 200, {}, req);
  } catch (error) {
    console.error("admin-system-settings", error instanceof Error ? error.message : "unknown");
    return json({ code: "SERVER_ERROR" }, 500, {}, req);
  }
});
