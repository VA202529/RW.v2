export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
export const OPENING_HOURS =
  (import.meta.env.VITE_OPENING_HOURS as string | undefined) ?? "Di–Za 09:00–18:00";
export const ADDRESS = import.meta.env.VITE_ADDRESS as string | undefined;
export const INSTAGRAM_URL =
  (import.meta.env.VITE_INSTAGRAM_URL as string | undefined) ?? "https://instagram.com";
export const TIKTOK_URL =
  (import.meta.env.VITE_TIKTOK_URL as string | undefined) ?? "https://tiktok.com";

export const HAS_BACKEND = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

if (!HAS_BACKEND && typeof window !== "undefined") {
  console.warn("[RW CUTZZ] MOCK MODE actief — geen echte backend verbonden");
}
