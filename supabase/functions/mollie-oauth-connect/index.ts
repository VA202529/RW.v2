import { serviceClient } from "../_shared/supabase.ts";

const AUTHORIZE_URL = "https://my.mollie.com/oauth2/authorize";
const SCOPES = "payments.read payments.write organizations.read profiles.read";

Deno.serve(async () => {
  const state = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
  const supabase = serviceClient();
  const { error } = await supabase.from("mollie_tokens").upsert({
    id: "pending-state",
    access_token: state,
    refresh_token: null,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    organization_id: null,
    profile_id: null,
  });
  if (error) throw error;

  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", requiredEnv("MOLLIE_CLIENT_ID"));
  url.searchParams.set("redirect_uri", requiredEnv("MOLLIE_REDIRECT_URI"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("state", state);

  return Response.redirect(url.toString(), 302);
});

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value || value === "PLACEHOLDER") throw new Error(`Missing ${name}`);
  return value;
}
