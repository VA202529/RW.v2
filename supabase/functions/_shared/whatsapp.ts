import { serviceClient } from "./supabase.ts";

export type WhatsAppInput = {
  to_phone?: string | null;
  template_name: string;
  language_code?: string;
  components?: unknown[];
  customer_id?: string;
  booking_id?: string;
  order_id?: string;
};

const phoneRegex = /^\+[1-9]\d{6,14}$/;

export function cents(value: number | null | undefined) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format((value ?? 0) / 100);
}

export function dateParts(value: string) {
  const date = new Date(value);
  return {
    date: new Intl.DateTimeFormat("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date).replace(/\//g, "-"),
    time: new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit" }).format(date),
  };
}

export function firstName(name: string | null | undefined) {
  return name?.trim().split(/\s+/)[0] || "klant";
}

export function bodyComponent(values: Array<string | number | null | undefined>) {
  return [{ type: "body", parameters: values.map((value) => ({ type: "text", text: String(value ?? "") })) }];
}

export async function sendWhatsAppTemplate(input: WhatsAppInput) {
  const token = Deno.env.get("META_WA_TOKEN") ?? "";
  if (!token) {
    console.log({ skipped: "META_WA_TOKEN not set", template: input.template_name });
    return { status: "skipped", skipped: "META_WA_TOKEN not set" };
  }
  const phone = input.to_phone ?? "";
  if (!phoneRegex.test(phone)) return { status: "skipped", reason: "invalid_phone" };

  const supabase = serviceClient();
  if (input.booking_id || input.order_id) {
    let query = supabase
      .from("message_log")
      .select("id")
      .eq("channel", "whatsapp")
      .eq("template", input.template_name)
      .in("status", ["sent", "delivered", "read"])
      .limit(1);
    if (input.booking_id) query = query.eq("booking_id", input.booking_id);
    if (input.order_id) query = query.eq("order_id", input.order_id);
    const { data: existing } = await query;
    if ((existing ?? []).length > 0) return { status: "already_sent" };
  }

  const phoneNumberId = Deno.env.get("META_WA_PHONE_NUMBER_ID");
  if (!phoneNumberId) return await logAndReturn(input, "failed", null, { error: "META_WA_PHONE_NUMBER_ID missing" });

  const response = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: {
        name: input.template_name,
        language: { code: input.language_code ?? "nl" },
        components: input.components ?? [],
      },
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (response.status === 200) {
    const providerId = payload?.messages?.[0]?.id ?? null;
    await logMessage(input, "sent", providerId);
    return { status: "sent", provider_message_id: providerId };
  }
  await logMessage(input, "failed", null);
  return { status: "failed", error: payload };
}

async function logAndReturn(input: WhatsAppInput, status: "sent" | "failed", providerId: string | null, extra: Record<string, unknown>) {
  await logMessage(input, status, providerId);
  return { status, ...extra };
}

async function logMessage(input: WhatsAppInput, status: "sent" | "failed", providerId: string | null) {
  if (!input.customer_id) return;
  await serviceClient().from("message_log").insert({
    customer_id: input.customer_id,
    booking_id: input.booking_id ?? null,
    order_id: input.order_id ?? null,
    channel: "whatsapp",
    template: input.template_name,
    provider_message_id: providerId,
    status,
    status_updated_at: new Date().toISOString(),
  });
}
