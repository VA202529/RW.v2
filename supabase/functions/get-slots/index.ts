import { handleOptions, noStoreJson } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  try {
    const { service_id: serviceId, from, to, exclude_booking_id: excludeBookingId } = await req.json();

    if (!serviceId || !from || !to) {
      return noStoreJson({ code: "MISSING_PARAMS" }, 400, req);
    }

    const fromDate = String(from).slice(0, 10);
    const toDate = String(to).slice(0, 10);
    const supabase = serviceClient();
    const { data, error } = await supabase.rpc("rwcutzz_available_slots", {
      p_service_id: serviceId,
      p_from: fromDate,
      p_to: toDate,
      p_public: true,
      p_exclude_booking_id: excludeBookingId ?? null,
    });

    if (error) throw error;
    return noStoreJson(data, data?.status ?? 200, req);
  } catch (error) {
    console.error(error);
    return noStoreJson({ code: "SERVER_ERROR" }, 500, req);
  }
});
