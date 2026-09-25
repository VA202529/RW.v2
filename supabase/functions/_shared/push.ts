import webpush from "npm:web-push@3.6.7";
import { serviceClient } from "./supabase.ts";

type PushPayload = {
  title: string;
  body: string;
  url?: string;
  booking_id?: string;
};

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

function configureWebPush() {
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:info@rwcutzz.com";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

export function vapidPublicKey() {
  return Deno.env.get("VAPID_PUBLIC_KEY") ?? null;
}

export async function sendPushToSubscription(subscription: PushSubscriptionRow, payload: PushPayload) {
  if (!configureWebPush()) return { ok: false, error: "missing_push_config" };
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify(payload),
    );
    return { ok: true };
  } catch (error) {
    const statusCode = (error as { statusCode?: number })?.statusCode;
    if (statusCode === 404 || statusCode === 410) {
      await serviceClient().from("admin_push_subscriptions").delete().eq("id", subscription.id);
    }
    console.error("admin push failed", error);
    return { ok: false, error: statusCode ? `push_failed_${statusCode}` : "push_failed" };
  }
}

export async function sendAdminPush(payload: PushPayload, bookingId?: string) {
  const supabase = serviceClient();
  if (bookingId) {
    const { data: existing } = await supabase
      .from("admin_push_log")
      .select("id")
      .eq("template", "admin_booking_push")
      .eq("booking_id", bookingId)
      .eq("status", "sent")
      .limit(1);
    if ((existing ?? []).length > 0) return { ok: true, skipped: true };
  }

  const { data: subscriptions, error } = await supabase
    .from("admin_push_subscriptions")
    .select("id, endpoint, p256dh, auth");
  if (error) return { ok: false, error: error.message };

  let sent = 0;
  let failed = 0;
  for (const subscription of subscriptions ?? []) {
    const result = await sendPushToSubscription(subscription, payload);
    if (result.ok) sent += 1;
    else failed += 1;
  }

  if (bookingId) {
    await supabase.from("admin_push_log").insert({
      booking_id: bookingId,
      template: "admin_booking_push",
      status: sent > 0 ? "sent" : "failed",
      sent_count: sent,
      failed_count: failed,
    });
  }

  return { ok: failed === 0, sent, failed };
}

export function adminBookingPushPayload(data: Record<string, any>): PushPayload {
  const name = data.customer_name ?? "Nieuwe klant";
  const time = data.starts_at
    ? new Intl.DateTimeFormat("nl-NL", {
        timeZone: "Europe/Amsterdam",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(data.starts_at))
    : "";
  const service = data.service_name ?? "Afspraak";
  const parts = [name, time, service].filter(Boolean);
  return {
    title: "Nieuwe afspraak",
    body: parts.join(" — "),
    url: "/admin/boekingen",
    booking_id: data.booking_id,
  };
}
