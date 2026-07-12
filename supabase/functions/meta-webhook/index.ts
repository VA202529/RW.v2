import { corsHeaders, json } from "../_shared/http.ts";
import { sendTransactionalEmail } from "../_shared/email.ts";
import { serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge") ?? "";
    if (mode === "subscribe" && token === Deno.env.get("META_WEBHOOK_VERIFY_TOKEN")) {
      return new Response(challenge, { headers: { ...corsHeaders, "content-type": "text/plain" } });
    }
    return json({ code: "FORBIDDEN" }, 403);
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256") ?? "";
  const appSecret = Deno.env.get("META_APP_SECRET") ?? "";
  if (!appSecret || !(await validSignature(rawBody, signature, appSecret))) return json({ code: "BAD_SIGNATURE" }, 403);

  try {
    const supabase = serviceClient();
    const body = JSON.parse(rawBody || "{}");
    const statuses = body.entry?.flatMap((entry: any) => entry.changes?.flatMap((change: any) => change.value?.statuses ?? []) ?? []) ?? [];
    for (const item of statuses) {
      const messageId = item.id;
      const status = normalizeStatus(item.status);
      if (!messageId || !status) continue;
      const { data: existing } = await supabase
        .from("message_log")
        .select("*")
        .eq("provider_message_id", messageId)
        .eq("channel", "whatsapp")
        .maybeSingle();
      if (!existing) continue;
      if (existing.status !== status) {
        await supabase.from("message_log").update({ status, status_updated_at: new Date().toISOString() }).eq("id", existing.id);
      }
      if (status === "failed") await fallbackEmail(supabase, existing);
    }
    return json({ status: 200 });
  } catch (error) {
    console.error(error);
    return json({ status: 200 });
  }
});

function normalizeStatus(status: string) {
  if (["sent", "delivered", "read", "failed"].includes(status)) return status;
  return null;
}

async function validSignature(rawBody: string, header: string, secret: string) {
  const expected = header.replace(/^sha256=/, "");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  return timingSafeEqual(hex(new Uint8Array(digest)), expected);
}

function hex(bytes: Uint8Array) {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return diff === 0;
}

async function fallbackEmail(supabase: ReturnType<typeof serviceClient>, log: any) {
  let query = supabase.from("message_log").select("id").eq("channel", "email").eq("template", log.template).in("status", ["queued", "sent", "delivered", "read"]).limit(1);
  if (log.booking_id) query = query.eq("booking_id", log.booking_id);
  if (log.order_id) query = query.eq("order_id", log.order_id);
  const { data: existingEmail } = await query;
  if ((existingEmail ?? []).length > 0) return;

  if (log.booking_id) {
    const details = await bookingDetails(supabase, log.booking_id);
    if (details) await sendTransactionalEmail({ template: log.template, to: details.customer_email, customer_id: details.customer_id, booking_id: log.booking_id, data: details });
  }
  if (log.order_id) {
    const details = await orderDetails(supabase, log.order_id);
    if (details) await sendTransactionalEmail({ template: log.template, to: details.customer_email, customer_id: details.customer_id, order_id: log.order_id, data: details });
  }
}

async function bookingDetails(supabase: ReturnType<typeof serviceClient>, bookingId: string) {
  const { data, error } = await supabase.from("bookings").select("id,starts_at,ends_at,deposit_cents,customers(id,email,full_name,phone_e164),services(name,price_cents)").eq("id", bookingId).single();
  if (error || !data) return null;
  const customer = Array.isArray(data.customers) ? data.customers[0] : data.customers;
  const service = Array.isArray(data.services) ? data.services[0] : data.services;
  return { booking_id: data.id, customer_id: customer.id, customer_email: customer.email, customer_name: customer.full_name, service_name: service.name, starts_at: data.starts_at, ends_at: data.ends_at, deposit_cents: data.deposit_cents, remaining_cents: Math.max((service.price_cents ?? 0) - data.deposit_cents, 0) };
}

async function orderDetails(supabase: ReturnType<typeof serviceClient>, orderId: string) {
  const { data, error } = await supabase.from("orders").select("id,total_cents,customers(id,email,full_name,phone_e164)").eq("id", orderId).single();
  if (error || !data) return null;
  const customer = Array.isArray(data.customers) ? data.customers[0] : data.customers;
  const { data: items } = await supabase.from("order_items").select("quantity,unit_price_cents,products(name)").eq("order_id", orderId);
  return {
    order_id: data.id,
    total_cents: data.total_cents,
    customer_id: customer.id,
    customer_email: customer.email,
    customer_name: customer.full_name,
    items: (items ?? []).map((item: any) => ({ quantity: item.quantity, unit_price_cents: item.unit_price_cents, name: Array.isArray(item.products) ? item.products[0]?.name : item.products?.name })),
  };
}
