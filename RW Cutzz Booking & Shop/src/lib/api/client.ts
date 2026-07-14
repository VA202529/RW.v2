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

async function edgeFunction<T>(name: string, body?: unknown, opts?: { token?: string }): Promise<T> {
  if (!HAS_BACKEND || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new ApiError("Geen backend geconfigureerd.", { code: "NO_BACKEND" });
  }

  const sessionToken =
    opts?.token ??
    (supabase ? (await supabase.auth.getSession()).data.session?.access_token : undefined);
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${sessionToken ?? SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body ?? {}),
  });
  const responseText = await res.text();
  const data = responseText ? JSON.parse(responseText) : undefined;
  if (!res.ok) {
    throw new ApiError(data?.message ?? data?.code ?? "Er ging iets mis.", {
      code: data?.code,
      status: res.status,
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
  const body = {
    service_id: args.service_id,
    from: args.from.slice(0, 10),
    to: args.to.slice(0, 10),
  };
  const data = await edgeFunction<{ slots?: Array<string | { starts_at: string }> }>("get-slots", body);
  if (!data.slots) return [];
  return data.slots.map((slot) => (typeof slot === "string" ? slot : slot.starts_at));
}

export async function createBookingHold(args: {
  service_id: string;
  starts_at: string;
  guest: Guest;
  turnstile_token: string;
}): Promise<{ booking_id: string; cancel_token: string; expires_at: string }> {
  console.log('FINAL PAYLOAD TO API:', JSON.stringify({
    service_id: args.service_id,
    starts_at: args.starts_at,
    guest: args.guest,
    turnstile_token: args.turnstile_token?.substring(0, 20),
  }));
  if (!HAS_BACKEND) {
    await sleep(400);
    return {
      booking_id: "mock-" + Math.random().toString(36).slice(2, 10),
      cancel_token: "tok-" + Math.random().toString(36).slice(2, 10),
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
  }
  return edgeFunction("create-booking-hold", {
    service_id: args.service_id,
    starts_at: args.starts_at,
    guest: {
      full_name: args.guest.full_name,
      email: args.guest.email,
      phone_e164: args.guest.phone_e164,
      whatsapp_opt_in: args.guest.whatsapp_opt_in,
      marketing_email_opt_in: args.guest.marketing_email_opt_in,
      terms_accepted: args.guest.terms_accepted,
    },
    turnstile_token: args.turnstile_token,
  });
}

export async function createCheckout(args: {
  booking_id: string;
}): Promise<{ checkout_url?: string; status?: string }> {
  if (!HAS_BACKEND) {
    await sleep(400);
    return { status: "confirmed" };
  }
  const data = await edgeFunction<{ checkout_url?: string; url?: string; status?: string; confirmed?: boolean }>("create-checkout", args);
  return { checkout_url: data.checkout_url ?? data.url, status: data.status ?? (data.confirmed ? "confirmed" : undefined) };
}

export async function getProducts(): Promise<Product[]> {
  if (!HAS_BACKEND) {
    await sleep(150);
    return mockProducts;
  }
  const data = await edgeFunction<{ products: Product[] }>("get-products");
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
  return edgeFunction("create-order", {
    items: args.items.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
    })),
    guest: {
      full_name: args.guest.full_name,
      email: args.guest.email,
      phone_e164: args.guest.phone_e164,
      whatsapp_opt_in: args.guest.whatsapp_opt_in,
      marketing_email_opt_in: args.guest.marketing_email_opt_in,
      terms_accepted: args.guest.terms_accepted,
    },
    turnstile_token: args.turnstile_token,
  });
}

export async function createOrderCheckout(args: {
  order_id: string;
}): Promise<{ checkout_url?: string; status?: string }> {
  if (!HAS_BACKEND) {
    await sleep(400);
    return { status: "paid" };
  }
  const data = await edgeFunction<{ checkout_url?: string; url?: string; status?: string; paid?: boolean }>("create-order-checkout", args);
  return { checkout_url: data.checkout_url ?? data.url, status: data.status ?? (data.paid ? "paid" : undefined) };
}

export async function getPublicReviews(): Promise<Review[]> {
  if (!HAS_BACKEND) {
    await sleep(150);
    return mockReviews;
  }
  const data = await edgeFunction<{ reviews: Review[] }>("get-public-reviews");
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
  return edgeFunction("get-booking-summary", args);
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
  await edgeFunction("submit-review", args);
}

export async function unsubscribe(args: { token: string }): Promise<void> {
  if (!HAS_BACKEND) {
    await sleep(200);
    return;
  }
  await edgeFunction("unsubscribe", args);
}

/* -------------------- AUTHENTICATED -------------------- */

export async function getAccountData(): Promise<AccountData> {
  if (!HAS_BACKEND) {
    await sleep(200);
    return mockAccount;
  }
  return edgeFunction("account-data");
}

export async function cancelBooking(args: {
  booking_id: string;
  action: "credit" | "refund";
  cancellation_token?: string;
}): Promise<{ result: string }> {
  if (!HAS_BACKEND) return { result: args.action === "credit" ? "credited" : "refunded" };
  return edgeFunction("cancel-booking", args);
}

export async function rescheduleBooking(args: {
  booking_id: string;
  new_starts_at: string;
  cancellation_token?: string;
}): Promise<{ new_booking_id: string }> {
  if (!HAS_BACKEND) return { new_booking_id: "reb-" + Math.random().toString(36).slice(2, 8) };
  return edgeFunction("reschedule-booking", args);
}

export async function updateNotificationPrefs(args: {
  whatsapp_opt_in: boolean;
  marketing_email_opt_in: boolean;
}): Promise<void> {
  if (!HAS_BACKEND) return;
  await edgeFunction("update-notification-prefs", args);
}

export async function updateCustomerPhone(args: { phone_e164: string }): Promise<void> {
  if (!HAS_BACKEND) return;
  await edgeFunction("update-customer-phone", args);
}

export async function deleteAccount(): Promise<void> {
  if (!HAS_BACKEND) return;
  await edgeFunction("delete-account");
}

export async function cancelOrder(args: {
  order_id: string;
  cancellation_token?: string;
}): Promise<void> {
  if (!HAS_BACKEND) return;
  await edgeFunction("cancel-order", args);
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
