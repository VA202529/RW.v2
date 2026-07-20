import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { StarRating } from "@/components/StarRating";
import { RelativeDate } from "@/components/RelativeDate";
import { EmptyState } from "@/components/EmptyState";
import { getServices, getPublicReviews } from "@/lib/api/client";
import { euros, depositCents } from "@/lib/format";
import { ADDRESS, OPENING_HOURS } from "@/lib/env";
import heroImg from "@/assets/hero-cut.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RW CUTZZ — Fresher Than Clean" },
      {
        name: "description",
        content:
          "RW CUTZZ — barbershop met neon precisie. Boek online, shop grooming producten.",
      },
      { property: "og:title", content: "RW CUTZZ — Fresher Than Clean" },
      { property: "og:description", content: "Boek online of shop de RW CUTZZ webshop." },
    ],
  }),
  component: Home,
});

function Home() {
  const { data: services = [] } = useQuery({ queryKey: ["services"], queryFn: getServices });
  const { data: reviews = [] } = useQuery({ queryKey: ["reviews"], queryFn: getPublicReviews });

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text flex flex-col">
      <SiteHeader />

      {/* Hero (dark) */}
      <section className="relative pt-32 pb-24 px-6 bg-brand-dark text-white overflow-hidden">
        <div
          aria-hidden
          className="absolute -top-40 -right-40 w-[520px] h-[520px] rounded-full blur-3xl opacity-30"
          style={{ background: "radial-gradient(circle, #2B3BEF, transparent 70%)" }}
        />
        <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-12 items-center relative">
          <div className="lg:col-span-7">
            <p className="text-brand-accent text-xs font-bold tracking-[0.3em] uppercase mb-6">
              RW CUTZZ · Nederland
            </p>
            <h1 className="font-display text-6xl md:text-8xl font-extrabold tracking-tighter leading-[0.9]">
              FRESHER<br />
              THAN{" "}
              <span
                className="italic"
                style={{ color: "#2B3BEF", textShadow: "0 0 40px rgba(43,59,239,0.6)" }}
              >
                CLEAN.
              </span>
            </h1>
            <p className="mt-8 max-w-md text-white/70 text-lg leading-relaxed">
              Boek online in twee minuten. Kies je dienst, kies je tijdslot, klaar.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                to="/boeken"
                className="bg-brand-accent text-white px-8 py-4 text-xs font-bold uppercase tracking-widest hover:glow-accent-lg transition-all"
              >
                Boek nu
              </Link>
              <Link
                to="/winkel"
                className="border border-white/30 text-white px-8 py-4 text-xs font-bold uppercase tracking-widest hover:border-brand-accent hover:text-brand-accent transition-all"
              >
                Bekijk shop
              </Link>
            </div>
          </div>
          <div className="lg:col-span-5">
            <img
              src={heroImg}
              alt="RW CUTZZ"
              className="w-full aspect-[4/5] object-cover rounded"
            />
          </div>
        </div>
      </section>

      {/* Diensten */}
      <section id="diensten" className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-4">
            <h2 className="font-display text-4xl font-extrabold tracking-tight">Diensten</h2>
            <Link
              to="/boeken"
              className="text-xs font-bold uppercase tracking-widest border-b border-brand-accent pb-1"
            >
              Alle diensten →
            </Link>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => {
              const dep = depositCents(s.price_cents, s.deposit_type, s.deposit_value);
              return (
                <article
                  key={s.id}
                  className="bg-brand-surface border border-brand-text/10 p-6 flex flex-col gap-3 rounded hover:border-brand-accent/40 transition"
                >
                  <div className="flex justify-between items-start">
                    <h3 className="font-display text-xl">{s.name}</h3>
                    <span className="text-xs bg-brand-bg px-2 py-1 rounded text-brand-muted">
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
      <section className="py-20 px-6 bg-brand-surface border-y border-brand-text/10">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div className="aspect-[4/3] bg-brand-dark rounded flex items-center justify-center text-white/40 text-sm">
            [ Foto van de zaak ]
          </div>
          <div>
            <h2 className="font-display text-4xl font-extrabold tracking-tight mb-4">
              Over RW CUTZZ
            </h2>
            <p className="text-brand-muted mb-6">
              Bij RW CUTZZ draait alles om precisie en persoonlijke aandacht. Elke knipbeurt is
              op maat. Geen haast, geen concessies — Fresher Than Clean.
            </p>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs uppercase tracking-widest text-brand-muted mb-1">
                  Openingstijden
                </p>
                <p>{OPENING_HOURS}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-brand-muted mb-1">Adres</p>
                <p>{ADDRESS}</p>
              </div>
            </div>
            <div className="mt-6 aspect-[16/9] bg-brand-bg rounded overflow-hidden border border-brand-text/10">
              <iframe
                title="Kaart"
                src="https://www.openstreetmap.org/export/embed.html?bbox=4.85%2C52.35%2C4.95%2C52.40&layer=mapnik"
                className="w-full h-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="font-display text-4xl font-extrabold tracking-tight mb-10">Reviews</h2>
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
