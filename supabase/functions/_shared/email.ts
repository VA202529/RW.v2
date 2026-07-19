import { Resend } from "npm:resend@4.1.2";
import { renderToStaticMarkup } from "npm:react-dom@18.3.1/server";
import { serviceClient } from "./supabase.ts";
import { booking_confirmation } from "./emails/booking_confirmation.tsx";
import { booking_reminder_48h } from "./emails/booking_reminder_48h.tsx";
import { booking_reminder_3h } from "./emails/booking_reminder_3h.tsx";
import { booking_cancelled } from "./emails/booking_cancelled.tsx";
import { booking_rescheduled } from "./emails/booking_rescheduled.tsx";
import { magic_link } from "./emails/magic_link.tsx";
import { review_request } from "./emails/review_request.tsx";
import { conflict_refund } from "./emails/conflict_refund.tsx";
import { order_confirmation } from "./emails/order_confirmation.tsx";
import { order_ready } from "./emails/order_ready.tsx";
import { announcement } from "./emails/announcement.tsx";
import { platform_invoice } from "./emails/platform_invoice.tsx";
import { order_cancelled } from "./emails/order_cancelled.tsx";

const templates: Record<string, (data: Record<string, any>) => any> = {
  booking_confirmation,
  booking_reminder_48h,
  booking_reminder_3h,
  booking_cancelled,
  booking_rescheduled,
  magic_link,
  review_request,
  conflict_refund,
  order_confirmation,
  order_ready,
  announcement,
  platform_invoice,
  order_cancelled,
};

export async function sendTransactionalEmail(input: {
  template: string;
  to: string;
  data?: Record<string, any>;
  customer_id?: string;
  booking_id?: string;
  order_id?: string;
}) {
  const supabase = serviceClient();
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM_EMAIL");
  const publicSiteUrl = Deno.env.get("PUBLIC_SITE_URL") ?? "http://localhost:5173";
  const factory = templates[input.template];
  if (!factory || !apiKey || !from) {
    await logMessage(supabase, input, "failed");
    return { ok: false, error: "missing_email_config" };
  }

  const rendered = factory({ ...(input.data ?? {}), public_site_url: publicSiteUrl });
  const html = renderEmailHtml(rendered.html);
  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from,
    to: [input.to],
    subject: rendered.subject,
    html,
    text: rendered.text,
    attachments: rendered.attachments,
  });

  if (error) {
    console.error(error);
    await logMessage(supabase, input, "failed");
    return { ok: false, error };
  }

  await logMessage(supabase, input, "sent", data?.id);
  return { ok: true, id: data?.id };
}

function renderEmailHtml(html: unknown) {
  if (typeof html === "string") return html;
  return `<!doctype html>${renderToStaticMarkup(html as any)}`;
}

async function logMessage(supabase: ReturnType<typeof serviceClient>, input: any, status: "sent" | "failed", providerId?: string) {
  const customerId = input.customer_id ?? input.data?.customer_id;
  if (!customerId) return;
  await supabase.from("message_log").insert({
    customer_id: customerId,
    booking_id: input.booking_id ?? input.data?.booking_id ?? null,
    order_id: input.order_id ?? input.data?.order_id ?? null,
    channel: "email",
    template: input.template,
    provider_message_id: providerId ?? null,
    status,
    status_updated_at: new Date().toISOString(),
  });
}
