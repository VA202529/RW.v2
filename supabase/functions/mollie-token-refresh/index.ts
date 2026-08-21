import { noStoreJson } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";

const TOKEN_ID = "barberflow-rwcutzz";
const TOKEN_URL = "https://api.mollie.com/oauth2/tokens";

Deno.serve(async () => {
  try {
    console.log("client_id set:", !!Deno.env.get("MOLLIE_CLIENT_ID"));
    console.log("client_secret set:", !!Deno.env.get("MOLLIE_CLIENT_SECRET"));
    console.log("client_id value starts with:", Deno.env.get("MOLLIE_CLIENT_ID")?.slice(0, 10));

    const supabase = serviceClient();
    const { data, error } = await supabase
      .from("mollie_tokens")
      .select("refresh_token")
      .eq("id", TOKEN_ID)
      .single();
    if (error || !data?.refresh_token) throw error ?? new Error("Missing Mollie refresh token");

    const tokenResponse = await refreshToken(data.refresh_token);
    const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString();
    const { error: updateError } = await supabase
      .from("mollie_tokens")
      .update({
        access_token: tokenResponse.access_token,
        refresh_token: tokenResponse.refresh_token ?? data.refresh_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", TOKEN_ID);
    if (updateError) throw updateError;

    return noStoreJson({ success: true, expires_at: expiresAt });
  } catch (error) {
    console.error("Mollie token refresh failed:", String(error));
    return noStoreJson({ success: false, code: "MOLLIE_TOKEN_REFRESH_FAILED" }, 500);
  }
});

async function refreshToken(refreshTokenValue: string) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshTokenValue,
  });
  const credentials = btoa(`${requiredEnv("MOLLIE_CLIENT_ID")}:${requiredEnv("MOLLIE_CLIENT_SECRET")}`);
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });
  if (!response.ok) throw new Error(`Token refresh failed ${response.status}: ${await response.text()}`);
  return await response.json() as { access_token: string; refresh_token?: string; expires_in: number };
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value || value === "PLACEHOLDER") throw new Error(`Missing ${name}`);
  return value;
}
