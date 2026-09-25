import { requireAdmin } from "../_shared/auth.ts";
import { handleOptions, json } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { sendPushToSubscription, vapidPublicKey } from "../_shared/push.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  const userId = await requireAdmin(req);
  if (!userId) return json({ code: "FORBIDDEN" }, 403);

  const body = await req.json().catch(() => ({}));
  const action = body.action;
  const publicKey = vapidPublicKey();
  const supabase = serviceClient();

  if (action === "status") {
    return json({ status: 200, vapid_public_key: publicKey });
  }

  if (action === "register") {
    const subscription = body.subscription;
    const endpoint = subscription?.endpoint;
    const p256dh = subscription?.keys?.p256dh;
    const auth = subscription?.keys?.auth;
    if (!publicKey) return json({ code: "MISSING_PUSH_CONFIG" }, 500);
    if (!endpoint || !p256dh || !auth) return json({ code: "INVALID_SUBSCRIPTION" }, 400);

    const { error } = await supabase.from("admin_push_subscriptions").upsert(
      {
        admin_user_id: userId,
        endpoint,
        p256dh,
        auth,
        user_agent: req.headers.get("user-agent"),
        updated_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );
    if (error) return json({ code: "SERVER_ERROR", message: error.message }, 500);
    return json({ status: 200 });
  }

  if (action === "test") {
    const { data: subscriptions, error } = await supabase
      .from("admin_push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("admin_user_id", userId);
    if (error) return json({ code: "SERVER_ERROR", message: error.message }, 500);
    if (!subscriptions?.length) return json({ code: "NO_SUBSCRIPTION", message: "Meldingen zijn nog niet ingeschakeld op dit apparaat." }, 400);

    let sent = 0;
    let failed = 0;
    for (const subscription of subscriptions) {
      const result = await sendPushToSubscription(subscription, {
        title: "RW CUTZZ",
        body: "Testmelding ontvangen. Pushmeldingen werken.",
        url: "/admin",
      });
      if (result.ok) sent += 1;
      else failed += 1;
    }
    if (sent < 1) return json({ code: "PUSH_FAILED", message: "Testmelding kon niet worden verstuurd." }, 500);
    return json({ status: 200, sent, failed });
  }

  return json({ code: "BAD_REQUEST" }, 400);
});
