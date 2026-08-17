import { noStoreJson } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";

const TOKEN_ID = "barberflow-rwcutzz";
const TOKEN_URL = "https://api.mollie.com/oauth2/tokens";

Deno.serve(async () => {
  try {
    const supabase = serviceClient();
    const { data, error } = await supabase
      .from("mollie_tokens")
      .select("refresh_token")
      .eq("id", TOKEN_ID)
      .single();
    if (error || !data?.refresh_token) throw error ?? new Error("Missing Mollie refresh token");

    const tokenResponse = await refreshToken(data.refresh_token);
    const { error: updateError } = await supabase
      .from("mollie_tokens")
      .update({
        access_token: tokenResponse.access_token,
        refresh_token: tokenResponse.refresh_token ?? data.refresh_token,
        expires_at: new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString(),
      })
      .eq("id", TOKEN_ID);
    if (updateError) throw updateError;

    return noStoreJson({ success: true });
  } catch (error) {
    console.error("Mollie token refresh failed:", String(error));
    return noStoreJson({ success: false, code: "MOLLIE_TOKEN_REFRESH_FAILED", detail: String(error) }, 500);
  }
});

async function refreshToken(refreshTokenValue: string) {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: requiredEnv("MOLLIE_CLIENT_ID"),
      client_secret: requiredEnv("MOLLIE_CLIENT_SECRET"),
      refresh_token: refreshTokenValue,
    }),
  });
  if (!response.ok) throw new Error(`Token refresh failed ${response.status}: ${await response.text()}`);
  return await response.json() as { access_token: string; refresh_token?: string; expires_in: number };
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value || value === "PLACEHOLDER") throw new Error(`Missing ${name}`);
  return value;
}
