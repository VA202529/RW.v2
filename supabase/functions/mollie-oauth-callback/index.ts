import { noStoreJson } from "../_shared/http.ts";
import { encryptToken } from "../_shared/crypto.ts";
import { serviceClient } from "../_shared/supabase.ts";

const TOKEN_ID = "barberflow-rwcutzz";
const TOKEN_URL = "https://api.mollie.com/oauth2/tokens";
const API_URL = "https://api.mollie.com/v2";

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) return successHtml("Mollie koppeling mist code of state.", 400);

    const supabase = serviceClient();
    const { data: pendingState, error: stateError } = await supabase
      .from("mollie_tokens")
      .select("access_token")
      .eq("id", "pending-state")
      .single();
    if (stateError || pendingState?.access_token !== state) {
      return successHtml("Ongeldige Mollie state token.", 400);
    }

    const tokenResponse = await exchangeCode(code);
    const [organization, profile] = await Promise.all([
      mollieGet<{ id: string }>("/organizations/me", tokenResponse.access_token),
      mollieGet<{ id: string }>("/profiles/me", tokenResponse.access_token),
    ]);

    const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString();
    const { error } = await supabase.from("mollie_tokens").upsert({
      id: TOKEN_ID,
      access_token: await encryptToken(tokenResponse.access_token),
      refresh_token: await encryptToken(tokenResponse.refresh_token),
      expires_at: expiresAt,
      organization_id: organization.id,
      profile_id: profile.id,
    });
    if (error) throw error;

    const siteUrl = (Deno.env.get("PUBLIC_SITE_URL") ?? "").replace(/\/$/, "");
    if (siteUrl) return Response.redirect(`${siteUrl}/mollie-connected`, 302);
    return successHtml("Kapper succesvol gekoppeld aan BarberFlow. Je kunt nu aanbetalingen ontvangen.");
  } catch (error) {
    console.error("Mollie OAuth callback failed:", String(error));
    return noStoreJson({ code: "MOLLIE_OAUTH_CALLBACK_FAILED" }, 500, req);
  }
});

async function exchangeCode(code: string) {
  const clientId = requiredEnv("MOLLIE_CLIENT_ID");
  const clientSecret = requiredEnv("MOLLIE_CLIENT_SECRET");
  const redirectUri = requiredEnv("MOLLIE_REDIRECT_URI");
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    }),
  });
  if (!response.ok) throw new Error(`Token exchange failed ${response.status}: ${await response.text()}`);
  return await response.json() as { access_token: string; refresh_token: string; expires_in: number };
}

async function mollieGet<T>(path: string, accessToken: string) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/hal+json" },
  });
  if (!response.ok) throw new Error(`Mollie GET ${path} failed ${response.status}: ${await response.text()}`);
  return await response.json() as T;
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value || value === "PLACEHOLDER") throw new Error(`Missing ${name}`);
  return value;
}

function successHtml(message: string, status = 200) {
  return new Response(`<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>Mollie gekoppeld</title></head><body><main><h1>${message}</h1></main></body></html>`, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
