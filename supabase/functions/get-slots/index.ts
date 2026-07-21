import { handleOptions, noStoreJson } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";

const TIME_ZONE = "Europe/Amsterdam";

function localParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
    weekday: weekdayMap[get("weekday")],
  };
}

function minutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

function overlaps(start: number, end: number, busyStart: number, busyEnd: number) {
  return start < busyEnd && end > busyStart;
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  try {
    const { service_id: serviceId, from, to } = await req.json();

    if (!serviceId || !from || !to) {
      return noStoreJson({ code: "MISSING_PARAMS" }, 400);
    }

    const fromDate = new Date(`${from}T00:00:00.000Z`);
    const toDate = new Date(`${to}T00:00:00.000Z`);
    const maxTo = new Date(fromDate.getTime() + 31 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || toDate > maxTo) {
      return noStoreJson({ code: "INVALID_RANGE" }, 400);
    }

    const supabase = serviceClient();
    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("id,duration_minutes,buffer_minutes")
      .eq("id", serviceId)
      .eq("is_active", true)
      .single();
    if (serviceError || !service) return noStoreJson({ code: "SERVICE_NOT_FOUND" }, 404);

    const { data: rules, error: rulesError } = await supabase
      .from("availability_rules")
      .select("weekday,opens_at,closes_at,max_bookings_per_day")
      .eq("is_active", true);
    if (rulesError) throw rulesError;

    const { data: overrides, error: overridesError } = await supabase
      .from("day_overrides")
      .select("override_date,is_closed,opens_at,closes_at,max_bookings")
      .gte("override_date", from)
      .lte("override_date", to);
    if (overridesError) throw overridesError;

    const rangeStart = new Date(`${from}T00:00:00.000Z`);
    const rangeEnd = new Date(new Date(`${to}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000);
    const { data: bookings, error: bookingsError } = await supabase
      .from("bookings")
      .select("starts_at,ends_at,status,expires_at")
      .gte("starts_at", rangeStart.toISOString())
      .lt("starts_at", rangeEnd.toISOString())
      .or(`status.eq.confirmed,and(status.eq.pending_payment,expires_at.gt.${new Date().toISOString()})`);
    if (bookingsError) throw bookingsError;

    const { data: blocked, error: blockedError } = await supabase
      .from("blocked_slots")
      .select("starts_at,ends_at")
      .lt("starts_at", rangeEnd.toISOString())
      .gt("ends_at", rangeStart.toISOString());
    if (blockedError) throw blockedError;

    const slotSpan = service.duration_minutes + service.buffer_minutes;
    const results: Array<{ starts_at: string; local_date: string; local_time: string }> = [];
    const overridesByDate = new Map((overrides ?? []).map((override) => [override.override_date, override]));
    const bookingCountsByDate = new Map<string, number>();

    for (const booking of bookings ?? []) {
      const status = booking.status;
      if (status !== "confirmed" && status !== "pending_payment") continue;
      const localDate = localParts(new Date(booking.starts_at)).date;
      bookingCountsByDate.set(localDate, (bookingCountsByDate.get(localDate) ?? 0) + 1);
    }

    for (let cursor = rangeStart.getTime(); cursor < rangeEnd.getTime(); cursor += 15 * 60 * 1000) {
      const start = new Date(cursor);
      const end = new Date(cursor + service.duration_minutes * 60 * 1000);
      const local = localParts(start);
      if (local.date < from || local.date > to) continue;

      const rule = rules?.find((r) => r.weekday === local.weekday);
      const override = overridesByDate.get(local.date);
      if (override?.is_closed) continue;
      if (!rule && !override) continue;

      const opensAt = override?.opens_at ?? rule?.opens_at;
      const closesAt = override?.closes_at ?? rule?.closes_at;
      if (!opensAt || !closesAt) continue;

      const maxBookings =
        override?.max_bookings ?? rule?.max_bookings_per_day ?? null;
      if (maxBookings !== null && (bookingCountsByDate.get(local.date) ?? 0) >= maxBookings) continue;

      const startMinute = minutes(local.time);
      if (startMinute < minutes(opensAt) || startMinute + slotSpan > minutes(closesAt)) continue;

      const busy = [...(bookings ?? []), ...(blocked ?? [])].some((item) =>
        overlaps(start.getTime(), end.getTime(), new Date(item.starts_at).getTime(), new Date(item.ends_at).getTime())
      );
      if (!busy) results.push({ starts_at: start.toISOString(), local_date: local.date, local_time: local.time });
    }

    return noStoreJson({ slots: results });
  } catch (error) {
    console.error(error);
    return noStoreJson({ code: "SERVER_ERROR" }, 500);
  }
});
