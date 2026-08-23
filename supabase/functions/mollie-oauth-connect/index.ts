import { serviceClient } from "../_shared/supabase.ts";
import { requireAdmin } from "../_shared/auth.ts";
import { json } from "../_shared/http.ts";

const AUTHORIZE_URL = "https://my.mollie.com/oauth2/authorize";
const SCOPES = "payments.read payments.write organizations.read profiles.read";

Deno.serve(async (req) => {
  let step = "init";
  try {
    step = "authorize-admin";
    const userId = await requireAdmin(req);
    if (!userId) return json({ error: "FORBIDDEN" }, 403, {}, req);

    step = "create-service-client";
    const supabase = serviceClient();

    step = "generate-state";
    const stateBytes = crypto.getRandomValues(new Uint8Array(32));
    const state = toHex(stateBytes);
    const stateHash = await hashState(state);

    step = "persist-pending-state";
    const { error } = await supabase.from("oauth_pending_states").insert({
      state_hash: stateHash,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    if (error) throw error;

    step = "read-client-id";
    const clientId = requiredEnv("MOLLIE_CLIENT_ID");
    step = "read-redirect-uri";
    const redirectUri = requiredEnv("MOLLIE_REDIRECT_URI");
    const redirect = new URL(redirectUri);
    console.log("[mollie-oauth-connect] config", {
      client_id_present: Boolean(clientId),
      redirect_uri_present: Boolean(redirectUri),
      redirect_uri_valid: true,
      redirect_uri_protocol: redirect.protocol,
      redirect_uri_hostname: redirect.hostname,
      redirect_uri_pathname: redirect.pathname,
    });

    step = "build-authorize-url";
    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", SCOPES);
    url.searchParams.set("state", state);

    step = "redirect";
    return Response.redirect(url.toString(), 302);
  } catch (error) {
    const diagnostic = safeDiagnostic(error);
    console.error("[mollie-oauth-connect] failed", { function: "mollie-oauth-connect", step, ...diagnostic });
    return new Response(JSON.stringify({ error: "oauth_connect_failed", step }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
});

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value || value === "PLACEHOLDER") throw new Error(`Missing ${name}`);
  return value;
}

async function hashState(state: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(state));
  return toHex(new Uint8Array(digest));
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeDiagnostic(error: unknown) {
  if (error instanceof Error) {
    return { error_name: error.name, error_message: error.message };
  }
  if (typeof error === "object" && error !== null) {
    const value = error as Record<string, unknown>;
    return {
      error_name: typeof value.name === "string" ? value.name : "UnknownError",
      error_message: typeof value.message === "string" ? value.message : "Unknown OAuth connect error",
      ...(typeof value.code === "string" ? { supabase_error_code: value.code } : {}),
      ...(typeof value.status === "number" ? { http_status: value.status } : {}),
    };
  }
  return { error_name: "UnknownError", error_message: "Unknown OAuth connect error" };
}
