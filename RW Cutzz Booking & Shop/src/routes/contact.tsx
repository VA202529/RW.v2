import { createFileRoute, Link } from "@tanstack/react-router";
import { Instagram } from "lucide-react";
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
    <div className="min-h-screen bg-brand-bg text-brand-text flex flex-col">
      <SiteHeader />
      <section className="pt-28 pb-20 px-6">
        <div className="max-w-5xl mx-auto grid gap-10 md:grid-cols-2">
          <div>
            <p className="text-brand-accent text-xs font-bold tracking-[0.3em] uppercase mb-3">
              Contact
            </p>
            <h1 className="font-display text-5xl md:text-6xl font-extrabold tracking-tighter">
              RW CUTZZ Amsterdam-Noord
            </h1>
            <p className="mt-6 text-brand-muted">
              Boek online of neem contact op voor vragen over je afspraak, bestelling of de
              tijdelijke salonlocatie.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/boeken"
                className="bg-brand-accent text-white px-6 py-3 text-xs font-bold uppercase tracking-widest hover:glow-accent transition"
              >
                Boek afspraak
              </Link>
              <a
                href={businessConfig.activeLocation.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="border border-brand-text/20 px-6 py-3 text-xs font-bold uppercase tracking-widest hover:border-brand-accent hover:text-brand-accent transition"
              >
                Route openen
              </a>
            </div>
          </div>

          <div className="bg-brand-surface border border-brand-text/10 rounded p-6">
            <h2 className="font-display text-2xl">Saloninformatie</h2>
            <dl className="mt-6 grid gap-5 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-widest text-brand-muted">Adres</dt>
                <dd className="mt-1">{formatActiveAddress()}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-widest text-brand-muted">Telefoon</dt>
                <dd className="mt-1">
                  <a
                    href={`tel:${businessConfig.phoneMachine}`}
                    className="hover:text-brand-accent"
                  >
                    {businessConfig.phoneDisplay}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-widest text-brand-muted">E-mail</dt>
                <dd className="mt-1">
                  <a href={`mailto:${businessConfig.email}`} className="hover:text-brand-accent">
                    {businessConfig.email}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-widest text-brand-muted">
                  Openingstijden
                </dt>
                <dd className="mt-1 whitespace-pre-line">{formatOpeningHours()}</dd>
              </div>
            </dl>

            <div className="mt-8 flex gap-3">
              <a
                href={businessConfig.socials.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-11 min-w-11 border border-brand-text/20 flex items-center justify-center hover:bg-brand-accent hover:border-brand-accent hover:text-white transition"
                aria-label="Instagram"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href={businessConfig.socials.tiktok}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-11 min-w-11 border border-brand-text/20 flex items-center justify-center hover:bg-brand-accent hover:border-brand-accent hover:text-white transition text-xs font-bold"
              >
                TikTok
              </a>
              <a
                href={businessConfig.socials.snapchat}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-11 min-w-11 border border-brand-text/20 flex items-center justify-center hover:bg-brand-accent hover:border-brand-accent hover:text-white transition text-xs font-bold"
              >
                Snap
              </a>
            </div>
          </div>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
