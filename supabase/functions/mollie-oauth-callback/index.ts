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
    if (!code || !state) return invalidRequest();

    const supabase = serviceClient();
    const stateHash = await hashState(state);
    const { data: pendingState, error: stateError } = await supabase
      .from("oauth_pending_states")
      .select("id, expires_at, consumed_at")
      .eq("state_hash", stateHash)
      .single();
    if (stateError || !pendingState) return invalidRequest();
    if (new Date(pendingState.expires_at).getTime() <= Date.now() || pendingState.consumed_at) return invalidRequest();

    const { data: consumedRows, error: consumeError } = await supabase
      .from("oauth_pending_states")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", pendingState.id)
      .is("consumed_at", null)
      .select("id");
    if (consumeError) throw consumeError;
    if (!consumedRows || consumedRows.length !== 1) return invalidRequest();

    const tokenResponse = await exchangeCode(code);
    const [organization, profile] = await Promise.all([
      mollieGet<{ id: string }>("/organizations/me", tokenResponse.access_token),
      mollieGet<{ id: string }>("/profiles/me", tokenResponse.access_token),
    ]);

    const expiresAt = Date.now() + Number(tokenResponse.expires_in) * 1000;
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

async function hashState(state: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(state));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function invalidRequest() {
  return noStoreJson({ error: "invalid_request" }, 400);
}

function successHtml(message: string, status = 200) {
  return new Response(`<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>Mollie gekoppeld</title></head><body><main><h1>${message}</h1></main></body></html>`, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
