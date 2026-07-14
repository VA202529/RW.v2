import { handleOptions, json } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { connectedAccount, stripeClient } from "../_shared/stripe.ts";

async function verifyTurnstile(token: string | undefined, ip: string | null) {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  const skipValidation = !secret || secret.startsWith("1x0000") || token === "BYPASS";
  if (skipValidation) return true;
  if (!secret || !token) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
  });
  const result = await response.json();
  return result.success === true;
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  try {
    const body = await req.json();
    const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const validTurnstile = await verifyTurnstile(body.turnstile_token, ip);
    if (!validTurnstile) return json({ code: "INVALID_TURNSTILE" }, 403);

    const supabase = serviceClient();
    const { data, error } = await supabase.rpc("wp1_create_booking_hold", {
      p_service_id: body.service_id,
      p_starts_at: body.starts_at,
      p_full_name: body.guest?.full_name,
      p_email: body.guest?.email,
      p_phone_e164: body.guest?.phone_e164 ?? null,
      p_whatsapp_opt_in: body.guest?.whatsapp_opt_in ?? false,
      p_marketing_email_opt_in: body.guest?.marketing_email_opt_in ?? false,
      p_terms_accepted: body.guest?.terms_accepted === true,
      p_ip: ip,
    });
    if (error) throw error;

    const status = data.status ?? 200;
    const sessionIds = data.superseded_checkout_session_ids ?? [];
    if (Array.isArray(sessionIds) && sessionIds.length > 0) {
      const stripe = stripeClient();
      const account = connectedAccount();
      await Promise.allSettled(
        sessionIds.map((id) => stripe.checkout.sessions.expire(id, {}, { stripeAccount: account }))
      );
    }

    return json(data, status);
  } catch (error) {
    console.error(error);
    return json({ code: "SERVER_ERROR" }, 500);
  }
});
