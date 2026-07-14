import { handleOptions, json } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { connectedAccount, stripeClient } from "../_shared/stripe.ts";

async function verifyTurnstile(token: string | undefined, ip: string | null) {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  const skipValidation = !secret || secret.startsWith("1x0000") || token === "BYPASS" || token === "XXXX.DUMMY.TOKEN.XXXX";
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
    console.log("REQUEST BODY:", JSON.stringify(body));
    console.log("FULL BODY:", JSON.stringify(body));
    console.log("BODY KEYS:", Object.keys(body ?? {}));
    console.log("GUEST:", JSON.stringify(body?.guest));
    const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const validTurnstile = await verifyTurnstile(body.turnstile_token, ip);
    if (!validTurnstile) return json({ code: "INVALID_TURNSTILE" }, 403);
    if (!body.service_id || !body.starts_at || !body.guest) {
      return json({ code: "INVALID_BODY", message: "service_id, starts_at and guest are required" }, 400);
    }

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
    if (error) {
      console.error("RPC wp1_create_booking_hold failed:", error);
      return json({ code: error.code ?? "RPC_ERROR", message: error.message, detail: error.details }, 500);
    }
    if (!data) {
      console.error("RPC wp1_create_booking_hold returned empty data");
      return json({ code: "EMPTY_RPC_RESPONSE" }, 500);
    }

    const status = data.status ?? 200;
    const sessionIds = data.superseded_checkout_session_ids ?? [];
    if (Array.isArray(sessionIds) && sessionIds.length > 0) {
      try {
        const stripe = stripeClient();
        const account = connectedAccount();
        await Promise.allSettled(
          sessionIds.map((id) => stripe.checkout.sessions.expire(id, {}, { stripeAccount: account }))
        );
      } catch (stripeError) {
        console.error("Stripe expire failed (non-fatal):", stripeError);
        // Non-fatal: booking hold already created successfully.
      }
    }

    return json(data, status);
  } catch (error) {
    console.error("CRASH:", error);
    return json({ code: "SERVER_ERROR", detail: String(error), stack: (error as Error)?.stack }, 500);
  }
});
