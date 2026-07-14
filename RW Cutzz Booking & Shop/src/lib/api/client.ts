import { HAS_BACKEND, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";
import { supabase } from "@/lib/supabase";
import { ApiError } from "./types";
import type {
  Service,
  Product,
  Review,
  Guest,
  AccountData,
} from "./types";
import { mockServices, mockProducts, mockReviews, mockSlots, mockAccount } from "./mock";

async function invoke<T>(name: string, body?: unknown, opts?: { token?: string }): Promise<T> {
  if (!HAS_BACKEND || !supabase) throw new ApiError("Geen backend geconfigureerd.", { code: "NO_BACKEND" });
  const { data, error } = await supabase.functions.invoke(name, {
    body: body ?? {},
    headers: opts?.token ? { authorization: `Bearer ${opts.token}` } : undefined,
  });
  if (error) {
    throw new ApiError(error.message ?? "Er ging iets mis.", {
      code: (data as any)?.code,
      status: (error as any).context?.status,
    });
  }
  return data as T;
}

// small helper for simulated latency in mock mode
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* -------------------- PUBLIC -------------------- */

export async function getServices(): Promise<Service[]> {
  if (!HAS_BACKEND) {
    await sleep(150);
    return mockServices;
  }
  if (!supabase) throw new ApiError("Geen backend geconfigureerd.", { code: "NO_BACKEND" });
  const { data, error } = await supabase.from("services").select("*").eq("is_active", true);
  if (error) throw new ApiError("Kon diensten niet laden.", { code: error.code });
  return (data ?? []) as Service[];
}

export async function getSlots(args: {
  service_id: string;
  from: string;
  to: string;
}): Promise<string[]> {
  if (!HAS_BACKEND) {
    await sleep(200);
    return mockSlots(args.from, args.to);
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new ApiError("Geen backend geconfigureerd.", { code: "NO_BACKEND" });
  }
  const body = {
    service_id: args.service_id,
    from: args.from.slice(0, 10),
    to: args.to.slice(0, 10),
  };
  const res = await fetch(`${SUPABASE_URL}/functions/v1/get-slots`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { slots?: Array<string | { starts_at: string }>; code?: string };
  if (!res.ok) {
    throw new ApiError("Kon beschikbare tijden niet laden.", {
      code: data.code,
      status: res.status,
    });
  }
  if (!data.slots) return [];
  return data.slots.map((slot) => (typeof slot === "string" ? slot : slot.starts_at));
}

export async function createBookingHold(args: {
  service_id: string;
  starts_at: string;
  guest: Guest;
  turnstile_token: string;
}): Promise<{ booking_id: string; cancel_token: string; expires_at: string }> {
  if (!HAS_BACKEND) {
    await sleep(400);
    return {
      booking_id: "mock-" + Math.random().toString(36).slice(2, 10),
      cancel_token: "tok-" + Math.random().toString(36).slice(2, 10),
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
  }
  return invoke("create-booking-hold", args);
}

export async function createCheckout(args: {
  booking_id: string;
}): Promise<{ checkout_url?: string; status?: string }> {
  if (!HAS_BACKEND) {
    await sleep(400);
    return { status: "confirmed" };
  }
  const data = await invoke<{ checkout_url?: string; url?: string; status?: string; confirmed?: boolean }>("create-checkout", args);
  return { checkout_url: data.checkout_url ?? data.url, status: data.status ?? (data.confirmed ? "confirmed" : undefined) };
}

export async function getProducts(): Promise<Product[]> {
  if (!HAS_BACKEND) {
    await sleep(150);
    return mockProducts;
  }
  const data = await invoke<{ products: Product[] }>("get-products");
  return data.products;
}

export async function createOrder(args: {
  items: Array<{ product_id: string; quantity: number }>;
  guest: Guest;
  turnstile_token: string;
}): Promise<{ order_id: string; cancel_token: string; expires_at: string }> {
  if (!HAS_BACKEND) {
    await sleep(400);
    return {
      order_id: "ord-" + Math.random().toString(36).slice(2, 10),
      cancel_token: "tok-" + Math.random().toString(36).slice(2, 10),
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
  }
  return invoke("create-order", args);
}

export async function createOrderCheckout(args: {
  order_id: string;
}): Promise<{ checkout_url?: string; status?: string }> {
  if (!HAS_BACKEND) {
    await sleep(400);
    return { status: "paid" };
  }
  const data = await invoke<{ checkout_url?: string; url?: string; status?: string; paid?: boolean }>("create-order-checkout", args);
  return { checkout_url: data.checkout_url ?? data.url, status: data.status ?? (data.paid ? "paid" : undefined) };
}

export async function getPublicReviews(): Promise<Review[]> {
  if (!HAS_BACKEND) {
    await sleep(150);
    return mockReviews;
  }
  const data = await invoke<{ reviews: Review[] }>("get-public-reviews");
  return data.reviews;
}

export async function getBookingSummary(args: {
  booking_id: string;
}): Promise<{ service_name: string; starts_at: string }> {
  if (!HAS_BACKEND) {
    await sleep(100);
    return {
      service_name: "Classic Fade",
      starts_at: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
    };
  }
  return invoke("get-booking-summary", args);
}

export async function submitReview(args: {
  booking_id: string;
  token: string;
  rating: number;
  body: string;
}): Promise<void> {
  if (!HAS_BACKEND) {
    await sleep(300);
    return;
  }
  await invoke("submit-review", args);
}

export async function unsubscribe(args: { token: string }): Promise<void> {
  if (!HAS_BACKEND) {
    await sleep(200);
    return;
  }
  await invoke("unsubscribe", args);
}

/* -------------------- AUTHENTICATED -------------------- */

export async function getAccountData(): Promise<AccountData> {
  if (!HAS_BACKEND) {
    await sleep(200);
    return mockAccount;
  }
  return invoke("account-data");
}

export async function cancelBooking(args: {
  booking_id: string;
  action: "credit" | "refund";
  cancellation_token?: string;
}): Promise<{ result: string }> {
  if (!HAS_BACKEND) return { result: args.action === "credit" ? "credited" : "refunded" };
  return invoke("cancel-booking", args);
}

export async function rescheduleBooking(args: {
  booking_id: string;
  new_starts_at: string;
  cancellation_token?: string;
}): Promise<{ new_booking_id: string }> {
  if (!HAS_BACKEND) return { new_booking_id: "reb-" + Math.random().toString(36).slice(2, 8) };
  return invoke("reschedule-booking", args);
}

export async function updateNotificationPrefs(args: {
  whatsapp_opt_in: boolean;
  marketing_email_opt_in: boolean;
}): Promise<void> {
  if (!HAS_BACKEND) return;
  await invoke("update-notification-prefs", args);
}

export async function updateCustomerPhone(args: { phone_e164: string }): Promise<void> {
  if (!HAS_BACKEND) return;
  await invoke("update-customer-phone", args);
}

export async function deleteAccount(): Promise<void> {
  if (!HAS_BACKEND) return;
  await invoke("delete-account");
}

export async function cancelOrder(args: {
  order_id: string;
  cancellation_token?: string;
}): Promise<void> {
  if (!HAS_BACKEND) return;
  await invoke("cancel-order", args);
}

export function dutchError(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case "SLOT_TAKEN":
        return "Dit tijdstip is zojuist vergeven — kies een ander tijdslot.";
      case "OUT_OF_STOCK":
        return "Niet genoeg voorraad beschikbaar.";
      case "ALREADY_REVIEWED":
        return "Je hebt al een review achtergelaten voor deze afspraak.";
    }
    if (err.status === 403) return "Online boeken is niet beschikbaar. Neem contact op met de kapper.";
    if (err.status === 429) return "Even wachten — te veel verzoeken. Probeer het zo opnieuw.";
  }
  return "Er ging iets mis. Probeer het opnieuw.";
}
