import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { EmptyState } from "@/components/EmptyState";
import { useCart } from "@/lib/cart";
import { getProducts } from "@/lib/api/client";
import { euros } from "@/lib/format";
import { jsonLdScript, routeHead } from "@/seo/metadata";
import { webPageJsonLd } from "@/seo/structured-data";

const description =
  "Shop grooming producten en merch van RW CUTZZ. Bestellingen worden klaargezet om af te halen in de salon.";

export const Route = createFileRoute("/winkel/")({
  head: () =>
    routeHead(
      {
        title: "Webshop | RW CUTZZ",
        description,
        path: "/winkel",
      },
      [jsonLdScript(webPageJsonLd("/winkel", "RW CUTZZ Webshop", description))],
    ),
  component: Winkel,
});

function Winkel() {
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: getProducts,
  });
  const { add, openDrawer } = useCart();

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col overflow-x-hidden">
      <SiteHeader />

      <div className="fixed top-16 md:top-20 left-0 right-0 z-30 bg-brand-dark text-white text-center text-xs py-2 px-4">
        🛍 Afhalen in de zaak — je ontvangt bericht zodra je bestelling klaarligt.
      </div>

      <section className="pt-32 pb-8 px-5 sm:px-6 md:px-8">
        <div className="max-w-7xl mx-auto">
          <p className="text-brand-accent text-xs font-bold tracking-[0.3em] uppercase mb-3">
            Webshop
          </p>
          <h1 className="font-display font-extrabold tracking-tight leading-[1.05] text-[clamp(2rem,7vw,3.5rem)]">
            Grooming &amp; merch
          </h1>
          <p className="mt-5 max-w-2xl text-brand-muted">
            Bestel producten online en haal ze op bij RW CUTZZ in Amsterdam-Noord zodra je bericht
            krijgt dat je bestelling klaarligt.
          </p>
        </div>
      </section>

      <section className="flex-1 pb-16 md:pb-20 px-5 sm:px-6 md:px-8">
        <div className="max-w-7xl mx-auto">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6 items-stretch">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-72 bg-brand-surface animate-pulse rounded" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <EmptyState title="Nog geen producten beschikbaar." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6 items-stretch">
              {products.map((p) => {
                const soldOut = p.stock === 0;
                return (
                  <article
                    key={p.id}
                    className="bg-brand-surface border border-brand-text/10 rounded-lg overflow-hidden group hover:border-brand-accent/40 transition flex flex-col h-full"
                  >
                    <Link to="/winkel/$id" params={{ id: p.id }} className="block">
                      <div className="aspect-square bg-brand-bg flex items-center justify-center text-brand-muted text-xs">
                        [ {p.name} ]
                      </div>
                    </Link>
                    <div className="p-4 flex flex-col gap-2 flex-1">
                      <p className="text-[10px] uppercase tracking-widest text-brand-muted">
                        {p.category}
                      </p>
                      <Link to="/winkel/$id" params={{ id: p.id }}>
                        <h3 className="font-display text-sm uppercase">{p.name}</h3>
                      </Link>
                      <p className="text-brand-accent font-bold">
                        {euros(p.price_cents)}{" "}
                        <span className="text-[10px] text-brand-muted font-normal">incl. BTW</span>
                      </p>
                      {soldOut ? (
                        <span className="text-xs text-brand-muted">Uitverkocht</span>
                      ) : p.stock <= 5 ? (
                        <span className="text-xs text-brand-accent">Nog {p.stock} beschikbaar</span>
                      ) : null}
                      <button
                        onClick={() => {
                          if (soldOut) return;
                          add(p.id);
                          openDrawer();
                        }}
                        disabled={soldOut}
                        className="mt-auto bg-brand-accent text-white px-3 py-2 text-[10px] font-bold uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed hover:glow-accent transition"
                      >
                        In winkelwagen
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
