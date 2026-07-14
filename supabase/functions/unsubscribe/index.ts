import { handleOptions, json } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";

async function sign(value: string) {
  const secret = Deno.env.get("RESEND_UNSUBSCRIBE_SECRET") ?? "";
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  try {
    const body = await req.json();
    const token = String(body.token ?? "");
    const decoded = JSON.parse(atob(token)) as { email: string; sig: string };
    if (!decoded.email || decoded.sig !== await sign(decoded.email)) return json({ code: "FORBIDDEN" }, 403);
    const { data, error } = await serviceClient().rpc("wp2_unsubscribe_email", { p_email: decoded.email });
    if (error) throw error;
    return json(data, data.status ?? 200);
  } catch (error) {
    console.error(error);
    return json({ code: "FORBIDDEN" }, 403);
  }
});
