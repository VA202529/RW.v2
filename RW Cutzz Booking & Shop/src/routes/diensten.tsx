import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { businessConfig, centsToPrice } from "@/config/business";
import { EmptyState } from "@/components/EmptyState";
import { getServices } from "@/lib/api/client";
import { serviceDepositCents } from "@/lib/format";
import { jsonLdScript, routeHead } from "@/seo/metadata";
import { hairSalonJsonLd, webPageJsonLd } from "@/seo/structured-data";

const description =
  "Bekijk de barberdiensten van RW CUTZZ in Amsterdam-Noord: knippen, knippen met baard, baard trimmen, kids knippen en design lines.";

export const Route = createFileRoute("/diensten")({
  head: () =>
    routeHead(
      {
        title: "Diensten & prijzen | RW CUTZZ Amsterdam-Noord",
        description,
        path: "/diensten",
      },
      [
        jsonLdScript(hairSalonJsonLd()),
        jsonLdScript(webPageJsonLd("/diensten", "Diensten & prijzen", description)),
      ],
    ),
  component: Diensten,
});

function Diensten() {
  const { data: services = [], isLoading } = useQuery({
    queryKey: ["services"],
    queryFn: getServices,
  });

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text flex flex-col">
      <SiteHeader />
      <section className="pt-28 pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          <p className="text-brand-accent text-xs font-bold tracking-[0.3em] uppercase mb-3">
            Diensten
          </p>
          <h1 className="font-display text-5xl md:text-6xl font-extrabold tracking-tighter">
            Barberdiensten in Amsterdam-Noord
          </h1>
          <p className="mt-6 max-w-2xl text-brand-muted">
            RW CUTZZ biedt strakke cuts, baardverzorging, kids knippen en design lines. Je boekt
            online en betaalt vooraf alleen de aanbetaling.
          </p>

          {isLoading ? (
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-56 bg-brand-surface animate-pulse rounded" />
              ))}
            </div>
          ) : services.length === 0 ? (
            <div className="mt-10">
              <EmptyState title="Geen actieve diensten gevonden." />
            </div>
          ) : (
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((service) => (
                <article
                  key={service.id}
                  className="bg-brand-surface border border-brand-text/10 rounded p-6"
                >
                  <h2 className="font-display text-2xl">{service.name}</h2>
                  <p className="mt-3 text-sm text-brand-muted">{service.description}</p>
                  <div className="mt-5 border-t border-brand-text/10 pt-4 text-sm">
                    <p className="font-bold text-brand-accent">
                      {centsToPrice(service.price_cents)}
                    </p>
                    <p className="mt-1 text-brand-muted">
                      Aanbetaling {centsToPrice(serviceDepositCents(service))}
                    </p>
                    <p className="mt-1 text-brand-muted">{service.duration_minutes} min</p>
                  </div>
                  <Link
                    to="/boeken"
                    search={{ service: service.id }}
                    className="mt-5 inline-flex bg-brand-accent text-white px-5 py-3 text-xs font-bold uppercase tracking-widest hover:glow-accent transition"
                  >
                    Boek deze dienst
                  </Link>
                </article>
              ))}
            </div>
          )}

          <p className="mt-10 text-sm text-brand-muted">
            Locatie: {businessConfig.activeLocation.streetAddress},{" "}
            {businessConfig.activeLocation.postalCode} {businessConfig.activeLocation.locality}.
          </p>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
