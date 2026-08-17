import { businessConfig, formatActiveAddress, formatOpeningHours } from "@/config/business";

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
export const OPENING_HOURS =
  (import.meta.env.VITE_OPENING_HOURS as string | undefined) ?? formatOpeningHours();
export const ADDRESS =
  (import.meta.env.VITE_ADDRESS as string | undefined) ?? formatActiveAddress("\n");
export const INSTAGRAM_URL =
  (import.meta.env.VITE_INSTAGRAM_URL as string | undefined) ?? businessConfig.socials.instagram;
export const TIKTOK_URL =
  (import.meta.env.VITE_TIKTOK_URL as string | undefined) ?? businessConfig.socials.tiktok;
export const SNAPCHAT_URL =
  (import.meta.env.VITE_SNAPCHAT_URL as string | undefined) ?? businessConfig.socials.snapchat;

export const HAS_BACKEND = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

if (!HAS_BACKEND && typeof window !== "undefined") {
  console.warn("[RW CUTZZ] MOCK MODE actief — geen echte backend verbonden");
}
