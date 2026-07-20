import { Link } from "@tanstack/react-router";
import { Instagram } from "lucide-react";
import { ADDRESS, INSTAGRAM_URL, OPENING_HOURS, SNAPCHAT_URL, TIKTOK_URL } from "@/lib/env";

export function SiteFooter() {
  return (
    <footer className="mt-auto bg-brand-dark text-white/80">
      <div className="max-w-7xl mx-auto px-6 py-16 grid gap-12 md:grid-cols-4">
        <div>
          <p className="font-display text-2xl font-extrabold tracking-tighter text-white">
            RW <span className="text-brand-accent">CUTZZ</span>
          </p>
          <p className="text-xs mt-2 tracking-widest uppercase text-white/60">Fresher Than Clean</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-3">
            Openingstijden
          </p>
          <p className="text-sm whitespace-pre-line">{OPENING_HOURS}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-3">
            Adres
          </p>
          {ADDRESS ? <p className="text-sm whitespace-pre-line">{ADDRESS}</p> : null}
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-3">
            Volg ons
          </p>
          <div className="flex gap-3">
            {INSTAGRAM_URL ? (
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-11 min-w-11 border border-white/20 flex items-center justify-center hover:bg-brand-accent hover:border-brand-accent transition"
                aria-label="Instagram"
              >
                <Instagram className="w-4 h-4" />
              </a>
            ) : null}
            {TIKTOK_URL ? (
              <a
                href={TIKTOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-11 min-w-11 border border-white/20 flex items-center justify-center hover:bg-brand-accent hover:border-brand-accent transition text-xs font-bold"
                aria-label="TikTok"
              >
                TikTok
              </a>
            ) : null}
            {SNAPCHAT_URL ? (
              <a
                href={SNAPCHAT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-11 min-w-11 border border-white/20 flex items-center justify-center hover:bg-brand-accent hover:border-brand-accent transition text-xs font-bold"
                aria-label="Snapchat"
              >
                Snap
              </a>
            ) : null}
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-white/50">
          <div className="flex gap-6">
            <Link to="/voorwaarden" className="hover:text-white">
              Voorwaarden
            </Link>
            <Link to="/privacy" className="hover:text-white">
              Privacy
            </Link>
            <Link to="/cookies" className="hover:text-white">
              Cookies
            </Link>
          </div>
          <p>
            © {new Date().getFullYear()} RW CUTZZ · Website door{" "}
            <a
              href="https://vanappiah.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-accent hover:underline"
            >
              Van Appiah
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
