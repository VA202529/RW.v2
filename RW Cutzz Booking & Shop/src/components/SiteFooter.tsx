import { Link } from "@tanstack/react-router";
import { Instagram } from "lucide-react";
import { businessConfig, formatActiveAddress, formatOpeningHours } from "@/config/business";

export function SiteFooter() {
  const address = formatActiveAddress("\n");
  const openingHours = formatOpeningHours();

  return (
    <footer className="mt-auto bg-brand-dark text-white/80">
      <div className="max-w-7xl mx-auto px-6 py-16 grid gap-12 md:grid-cols-4">
        <div>
          <p className="font-display text-2xl font-extrabold tracking-tighter text-white">
            RW <span className="text-brand-accent">CUTZZ</span>
          </p>
          <p className="text-xs mt-2 tracking-widest uppercase text-white/60">
            {businessConfig.tagline}
          </p>
          <p className="mt-4 text-sm text-white/70">Kapper en barbershop in Amsterdam-Noord.</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-3">
            Openingstijden
          </p>
          <p className="text-sm whitespace-pre-line">{openingHours}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-3">
            Adres
          </p>
          <p className="text-sm whitespace-pre-line">{address}</p>
          <a
            href={`tel:${businessConfig.phoneMachine}`}
            className="mt-3 block text-sm hover:text-white"
          >
            {businessConfig.phoneDisplay}
          </a>
          <a
            href={`mailto:${businessConfig.email}`}
            className="mt-1 block text-sm hover:text-white"
          >
            {businessConfig.email}
          </a>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-3">
            Volg ons
          </p>
          <div className="flex gap-3">
            {businessConfig.socials.instagram ? (
              <a
                href={businessConfig.socials.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-11 min-w-11 border border-white/20 flex items-center justify-center hover:bg-brand-accent hover:border-brand-accent transition"
                aria-label="Instagram"
              >
                <Instagram className="w-4 h-4" />
              </a>
            ) : null}
            {businessConfig.socials.tiktok ? (
              <a
                href={businessConfig.socials.tiktok}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-11 min-w-11 border border-white/20 flex items-center justify-center hover:bg-brand-accent hover:border-brand-accent transition text-xs font-bold"
                aria-label="TikTok"
              >
                TikTok
              </a>
            ) : null}
            {businessConfig.socials.snapchat ? (
              <a
                href={businessConfig.socials.snapchat}
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
            <Link to="/diensten" className="hover:text-white">
              Diensten
            </Link>
            <Link to="/contact" className="hover:text-white">
              Contact
            </Link>
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
