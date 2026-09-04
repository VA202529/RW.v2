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
    <div className="min-h-screen bg-brand-bg text-brand-text flex flex-col overflow-x-hidden">
      <SiteHeader />
      <section className="pt-28 md:pt-32 lg:pt-36 pb-8 md:pb-10 px-5 sm:px-6 md:px-8">
        <div className="max-w-7xl mx-auto">
          <p className="text-brand-accent text-[10px] sm:text-xs font-bold tracking-[0.25em] uppercase mb-3">
            Diensten
          </p>
          <h1 className="font-display font-extrabold tracking-tight leading-[1.05] text-[clamp(1.9rem,6vw,3.75rem)] text-balance max-w-[18ch]">
            Barberdiensten in Amsterdam-Noord
          </h1>
          <p className="mt-4 max-w-xl text-brand-muted text-sm sm:text-base leading-relaxed">
            RW CUTZZ biedt strakke cuts, baardverzorging, kids knippen en design lines. Je boekt
            online en betaalt vooraf alleen de aanbetaling.
          </p>
        </div>
      </section>

      <section className="flex-1 pb-16 md:pb-20 px-5 sm:px-6 md:px-8">
        <div className="max-w-7xl mx-auto">
          {isLoading ? (
            <div className="grid gap-5 md:gap-6 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-52 bg-brand-surface animate-pulse rounded-lg" />
              ))}
            </div>
          ) : services.length === 0 ? (
            <EmptyState title="Geen actieve diensten gevonden." />
          ) : (
            <div className="grid gap-5 md:gap-6 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
              {services.map((service) => (
                <article
                  key={service.id}
                  className="w-full min-w-0 bg-brand-surface border border-brand-text/10 rounded-lg p-5 sm:p-6 flex flex-col gap-3"
                >
                  <div className="flex justify-between items-start gap-3">
                    <h2 className="min-w-0 break-words font-display text-lg sm:text-xl leading-tight">
                      {service.name}
                    </h2>
                    <span className="shrink-0 text-[11px] bg-brand-bg px-2 py-1 rounded text-brand-muted">
                      {service.duration_minutes} min
                    </span>
                  </div>
                  <p className="min-w-0 break-words text-sm text-brand-muted flex-1">
                    {service.description}
                  </p>
                  <div className="flex flex-wrap items-end gap-3 justify-between pt-3 border-t border-brand-text/10">
                    <div>
                      <p className="text-2xl font-bold font-display text-brand-accent">
                        {centsToPrice(service.price_cents)}
                      </p>
                      <p className="text-[11px] text-brand-muted">
                        Aanbetaling {centsToPrice(serviceDepositCents(service))}
                      </p>
                    </div>
                    <Link
                      to="/boeken"
                      search={{ service: service.id }}
                      className="border border-brand-accent px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-brand-accent hover:text-white transition"
                    >
                      Boek direct
                    </Link>
                  </div>
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
