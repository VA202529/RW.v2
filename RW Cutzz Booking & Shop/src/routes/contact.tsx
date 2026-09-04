import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock, Instagram, Mail, MapPin } from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { businessConfig, formatActiveAddress, formatOpeningHours } from "@/config/business";
import { jsonLdScript, routeHead } from "@/seo/metadata";
import { hairSalonJsonLd, webPageJsonLd } from "@/seo/structured-data";

const description =
  "Neem contact op met RW CUTZZ in Amsterdam-Noord. Bekijk het adres, openingstijden, telefoonnummer, e-mail en socials.";

export const Route = createFileRoute("/contact")({
  head: () =>
    routeHead(
      {
        title: "Contact | RW CUTZZ Amsterdam-Noord",
        description,
        path: "/contact",
      },
      [
        jsonLdScript(hairSalonJsonLd()),
        jsonLdScript(webPageJsonLd("/contact", "Contact RW CUTZZ", description)),
      ],
    ),
  component: Contact,
});

function Contact() {
  return (
    <div className="min-h-screen bg-brand-bg text-brand-text flex flex-col overflow-x-hidden">
      <SiteHeader />
      <section className="pt-28 md:pt-32 lg:pt-36 pb-8 md:pb-10 px-5 sm:px-6 md:px-8">
        <div className="max-w-7xl mx-auto">
          <p className="text-brand-accent text-[10px] sm:text-xs font-bold tracking-[0.25em] uppercase mb-3">
            Contact
          </p>
          <h1 className="font-display font-extrabold tracking-tight leading-[1.05] text-[clamp(1.9rem,6vw,3.75rem)] text-balance max-w-[18ch]">
            Kom langs of stuur een bericht
          </h1>
          <p className="mt-4 max-w-xl text-brand-muted text-sm sm:text-base leading-relaxed">
            Boek online of neem contact op voor vragen over je afspraak, bestelling of de tijdelijke
            salonlocatie.
          </p>
        </div>
      </section>

      <section className="flex-1 pb-16 md:pb-20 px-5 sm:px-6 md:px-8">
        <div className="max-w-7xl mx-auto grid gap-6 md:gap-8 lg:grid-cols-2">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 content-start">
            <div className="bg-brand-surface border border-brand-text/10 rounded-lg p-5 flex gap-4">
              <MapPin className="w-5 h-5 text-brand-accent shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] uppercase tracking-widest text-brand-muted mb-1">Adres</p>
                <p className="text-sm whitespace-pre-line">{formatActiveAddress()}</p>
              </div>
            </div>
            <div className="bg-brand-surface border border-brand-text/10 rounded-lg p-5 flex gap-4">
              <Clock className="w-5 h-5 text-brand-accent shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] uppercase tracking-widest text-brand-muted mb-1">
                  Openingstijden
                </p>
                <p className="text-sm whitespace-pre-line">{formatOpeningHours()}</p>
              </div>
            </div>
            <div className="bg-brand-surface border border-brand-text/10 rounded-lg p-5 flex gap-4">
              <Mail className="w-5 h-5 text-brand-accent shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] uppercase tracking-widest text-brand-muted mb-1">
                  E-mail
                </p>
                <a
                  href={`mailto:${businessConfig.email}`}
                  className="text-sm break-all hover:text-brand-accent"
                >
                  {businessConfig.email}
                </a>
              </div>
            </div>
            <div className="bg-brand-surface border border-brand-text/10 rounded-lg p-5">
              <p className="text-[10px] uppercase tracking-widest text-brand-muted mb-3">
                Telefoon
              </p>
              <a
                href={`tel:${businessConfig.phoneMachine}`}
                className="text-sm hover:text-brand-accent"
              >
                {businessConfig.phoneDisplay}
              </a>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                to="/boeken"
                className="inline-flex items-center bg-brand-accent text-white px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:glow-accent transition rounded"
              >
                Boek nu
              </Link>
              <a
                href={businessConfig.activeLocation.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center border border-brand-text/15 px-4 py-2.5 text-xs font-bold uppercase tracking-widest hover:border-brand-accent hover:text-brand-accent transition rounded"
              >
                Route openen
              </a>
              <a
                href={businessConfig.socials.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 border border-brand-text/15 px-4 py-2.5 text-xs font-bold uppercase tracking-widest hover:border-brand-accent hover:text-brand-accent transition rounded"
                aria-label="Instagram"
              >
                <Instagram className="w-4 h-4" /> Instagram
              </a>
              <a
                href={businessConfig.socials.tiktok}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center border border-brand-text/15 px-4 py-2.5 text-xs font-bold uppercase tracking-widest hover:border-brand-accent hover:text-brand-accent transition rounded"
              >
                TikTok
              </a>
              <a
                href={businessConfig.socials.snapchat}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center border border-brand-text/15 px-4 py-2.5 text-xs font-bold uppercase tracking-widest hover:border-brand-accent hover:text-brand-accent transition rounded"
              >
                Snap
              </a>
            </div>
          </div>

          <div className="aspect-[4/3] lg:aspect-auto lg:min-h-[420px] rounded-lg overflow-hidden border border-brand-text/10 bg-brand-surface">
            <iframe
              title="Kaart RW CUTZZ"
              src="https://www.openstreetmap.org/export/embed.html?bbox=4.88%2C52.38%2C4.96%2C52.42&layer=mapnik"
              className="w-full h-full"
              loading="lazy"
            />
          </div>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
