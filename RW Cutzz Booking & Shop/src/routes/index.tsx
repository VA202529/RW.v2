import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { StarRating } from "@/components/StarRating";
import { RelativeDate } from "@/components/RelativeDate";
import { EmptyState } from "@/components/EmptyState";
import { getServices, getPublicReviews } from "@/lib/api/client";
import { euros, serviceDepositCents } from "@/lib/format";
import { businessConfig, formatActiveAddress, formatOpeningHours } from "@/config/business";
import { jsonLdScript, routeHead } from "@/seo/metadata";
import { hairSalonJsonLd, webPageJsonLd } from "@/seo/structured-data";
import heroImg from "@/assets/hero-rwcutzz.png";
const description = `RW CUTZZ is een kapper en barbershop in Amsterdam-Noord. Boek online je afspraak bij de tijdelijke locatie aan ${businessConfig.activeLocation.streetAddress}.`;

export const Route = createFileRoute("/")({
  head: () =>
    routeHead(
      {
        title: "RW CUTZZ | Kapper & Barbershop in Amsterdam-Noord",
        description,
        path: "/",
      },
      [jsonLdScript(hairSalonJsonLd()), jsonLdScript(webPageJsonLd("/", "RW CUTZZ", description))],
    ),
  component: Home,
});

function Home() {
  const { data: services = [] } = useQuery({ queryKey: ["services"], queryFn: getServices });
  const { data: reviews = [] } = useQuery({ queryKey: ["reviews"], queryFn: getPublicReviews });

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text flex flex-col overflow-x-hidden">
      <SiteHeader />

      {/* Hero (dark) */}
      <section className="relative pt-28 md:pt-32 pb-16 md:pb-20 lg:pb-24 px-5 sm:px-6 bg-brand-dark text-white overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 -right-40 w-[420px] md:w-[520px] h-[420px] md:h-[520px] rounded-full blur-3xl opacity-30"
          style={{ background: "radial-gradient(circle, #2B3BEF, transparent 70%)" }}
        />
        <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-10 lg:gap-12 items-center relative">
          <div className="lg:col-span-7 min-w-0">
            <p className="text-brand-accent text-[10px] sm:text-xs font-bold tracking-[0.25em] uppercase mb-4 md:mb-6">
              RW CUTZZ · Amsterdam-Noord
            </p>
            <h1 className="font-display font-extrabold tracking-tight leading-[0.95] text-[clamp(2.6rem,11vw,6.5rem)] md:text-[clamp(3.25rem,6vw,6.5rem)] lg:text-[clamp(3rem,4.8vw,6.5rem)] xl:text-[clamp(4rem,7vw,6.5rem)] break-words max-w-[16ch]">
              FRESHER
              <br />
              THAN{" "}
              <span
                className="italic"
                style={{ color: "#2B3BEF", textShadow: "0 0 40px rgba(43,59,239,0.6)" }}
              >
                CLEAN.
              </span>
            </h1>
            <p className="mt-6 md:mt-8 max-w-md md:max-w-lg text-white/70 text-base md:text-lg leading-relaxed">
              {businessConfig.tagline}. Boek online in twee minuten bij RW CUTZZ aan{" "}
              {businessConfig.activeLocation.streetAddress} in Amsterdam.
            </p>
            <div className="mt-8 md:mt-10 flex flex-col sm:flex-row flex-wrap gap-3">
              <Link
                to="/boeken"
                className="bg-brand-accent text-white px-8 py-4 text-xs font-bold uppercase tracking-widest text-center hover:glow-accent-lg transition-all rounded"
              >
                Boek nu
              </Link>
              <Link
                to="/winkel"
                className="border border-white/30 text-white px-8 py-4 text-xs font-bold uppercase tracking-widest text-center hover:border-brand-accent hover:text-brand-accent transition-all rounded"
              >
                Bekijk shop
              </Link>
            </div>
          </div>
          <div className="lg:col-span-5 min-w-0">
            <img
              src={heroImg}
              alt="Barber van RW CUTZZ aan het werk"
              loading="eager"
              className="w-full max-w-sm md:max-w-lg mx-auto lg:max-w-none aspect-[4/5] object-cover object-center rounded-lg"
            />
          </div>
        </div>
      </section>

      {/* Diensten */}
      <section id="diensten" className="py-16 md:py-20 px-5 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-4">
            <h2 className="font-display font-extrabold tracking-tight text-[clamp(1.75rem,6vw,2.5rem)]">
              Diensten
            </h2>
            <Link
              to="/boeken"
              className="text-xs font-bold uppercase tracking-widest border-b border-brand-accent pb-1"
            >
              Alle diensten →
            </Link>
          </div>

          <div className="grid gap-5 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
            {services.map((s) => {
              const dep = serviceDepositCents(s);
              return (
                <article
                  key={s.id}
                  className="bg-brand-surface border border-brand-text/10 p-6 flex flex-col gap-3 rounded-lg hover:border-brand-accent/40 transition"
                >
                  <div className="flex justify-between items-start gap-3">
                    <h3 className="font-display text-xl leading-tight">{s.name}</h3>
                    <span className="shrink-0 text-xs bg-brand-bg px-2 py-1 rounded text-brand-muted">
                      {s.duration_minutes} min
                    </span>
                  </div>
                  <p className="text-sm text-brand-muted flex-1">{s.description}</p>
                  <div className="flex items-center justify-between pt-3 border-t border-brand-text/10">
                    <div>
                      <p className="text-2xl font-bold font-display text-brand-accent">
                        {euros(s.price_cents)}
                      </p>
                      <p className="text-[11px] text-brand-muted">Aanbetaling {euros(dep)}</p>
                    </div>
                    <Link
                      to="/boeken"
                      search={{ service: s.id }}
                      className="border border-brand-accent px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-brand-accent hover:text-white transition"
                    >
                      Boek direct
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Over ons */}
      <section className="py-16 md:py-20 px-5 sm:px-6 bg-brand-surface border-y border-brand-text/10">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div className="aspect-[4/3] bg-brand-dark rounded flex items-center justify-center text-white/40 text-sm">
            [ Foto van de zaak ]
          </div>
          <div>
            <h2 className="font-display font-extrabold tracking-tight mb-4 text-[clamp(1.75rem,6vw,2.5rem)]">
              Over RW CUTZZ
            </h2>
            <p className="text-brand-muted mb-6">
              Bij RW CUTZZ draait alles om precisie, persoonlijke aandacht en een frisse finish. Je
              bent welkom op de tijdelijke salonlocatie in Amsterdam-Noord voor knippen,
              baardtrimmen, kids cuts en design lines.
            </p>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs uppercase tracking-widest text-brand-muted mb-1">
                  Openingstijden
                </p>
                <p className="whitespace-pre-line">{formatOpeningHours()}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-brand-muted mb-1">Adres</p>
                <p>{formatActiveAddress()}</p>
              </div>
            </div>
            <div className="mt-6 rounded border border-brand-text/10 bg-brand-bg p-5">
              <p className="text-sm text-brand-muted">
                Actuele klantlocatie: {businessConfig.activeLocation.label.toLowerCase()}.
              </p>
              <a
                href={businessConfig.activeLocation.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex text-xs font-bold uppercase tracking-widest text-brand-accent hover:underline"
              >
                Open route
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section className="py-16 md:py-20 px-5 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="font-display font-extrabold tracking-tight mb-8 md:mb-10 text-[clamp(1.75rem,6vw,2.5rem)]">
            Reviews
          </h2>
          {reviews.length === 0 ? (
            <EmptyState title="Nog geen reviews — wees de eerste." />
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {reviews.slice(0, 10).map((r, i) => (
                <div
                  key={i}
                  className="bg-brand-surface border border-brand-text/10 p-6 rounded flex flex-col gap-3"
                >
                  <StarRating value={r.rating} readOnly size={16} />
                  <p className="text-sm">{r.body}</p>
                  <div className="mt-auto pt-3 border-t border-brand-text/10 text-xs text-brand-muted flex justify-between">
                    <span>
                      {r.first_name} {r.last_initial}. · {r.service_name}
                    </span>
                    <RelativeDate iso={r.created_at} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
