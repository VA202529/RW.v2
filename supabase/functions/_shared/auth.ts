import { serviceClient } from "./supabase.ts";

export async function authUserId(req: Request) {
  const header = req.headers.get("authorization");
  const token = header?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const supabase = serviceClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

export async function requireAdmin(req: Request) {
  const userId = await authUserId(req);
  if (!userId) return null;
  const supabase = serviceClient();
  const { data, error } = await supabase.rpc("wp3_is_admin_user", { p_auth_user_id: userId });
  if (error || data !== true) return null;
  return userId;
}

export function requireInternal(req: Request) {
  const expected = Deno.env.get("INTERNAL_FUNCTION_SECRET");
  return Boolean(expected && req.headers.get("x-internal-secret") === expected);
}
