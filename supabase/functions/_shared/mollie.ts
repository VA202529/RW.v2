const MOLLIE_API_URL = "https://api.mollie.com/v2";

export type MollieMode = "test" | "live";

export type MolliePayment = {
  id: string;
  mode: MollieMode;
  status: string;
  amount: { currency: string; value: string };
  description?: string;
  paidAt?: string;
  metadata?: Record<string, unknown> | string | null;
  _links?: { checkout?: { href?: string } };
};

export function mollieConfig() {
  const apiKey = Deno.env.get("MOLLIE_API_KEY")?.trim();
  const mode = Deno.env.get("MOLLIE_MODE")?.trim();
  if (!apiKey) throw new Error("Missing MOLLIE_API_KEY");
  if (mode !== "test" && mode !== "live") throw new Error("MOLLIE_MODE must be test or live");
  const expectedPrefix = mode === "test" ? "test_" : "live_";
  if (!apiKey.startsWith(expectedPrefix)) throw new Error(`MOLLIE_API_KEY must start with ${expectedPrefix}`);
  return { apiKey, mode } as { apiKey: string; mode: MollieMode };
}

export async function mollieRequest<T>(
  path: string,
  init: RequestInit = {},
  idempotencyKey?: string,
): Promise<T> {
  const { apiKey } = mollieConfig();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${apiKey}`);
  headers.set("Accept", "application/hal+json");
  if (init.body) headers.set("Content-Type", "application/json");
  if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);

  const response = await fetch(`${MOLLIE_API_URL}${path}`, { ...init, headers });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    console.error("Mollie API error", response.status, payload?.status, payload?.title);
    throw new Error(`Mollie API returned ${response.status}`);
  }
  return payload as T;
}

export function mollieCheckoutUrl(payment: MolliePayment) {
  const checkoutUrl = payment._links?.checkout?.href;
  if (!checkoutUrl) throw new Error("Mollie response has no checkout URL");
  const parsed = new URL(checkoutUrl);
  if (parsed.protocol !== "https:") throw new Error("Mollie checkout URL is not HTTPS");
  return parsed.toString();
}

export function centsToMollieValue(cents: number) {
  if (!Number.isInteger(cents) || cents <= 0) throw new Error("Invalid Mollie amount");
  return (cents / 100).toFixed(2);
}

export function mollieValueToCents(value: string) {
  if (!/^\d+\.\d{2}$/.test(value)) throw new Error("Invalid Mollie amount value");
  return Math.round(Number(value) * 100);
}
