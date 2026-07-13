import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { EmptyState } from "@/components/EmptyState";
import { useCart } from "@/lib/cart";
import { getProducts } from "@/lib/api/client";
import { euros } from "@/lib/format";

export const Route = createFileRoute("/winkel/")({
  head: () => ({
    meta: [
      { title: "Webshop — RW CUTZZ" },
      { name: "description", content: "Grooming producten en merch van RW CUTZZ." },
    ],
  }),
  component: Winkel,
});

function Winkel() {
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: getProducts,
  });
  const { add, openDrawer } = useCart();

  return (
    <div className="min-h-screen bg-brand-bg">
      <SiteHeader />

      <div className="fixed top-16 md:top-20 left-0 right-0 z-30 bg-brand-dark text-white text-center text-xs py-2 px-4">
        🛍 Afhalen in de zaak — je ontvangt bericht zodra je bestelling klaarligt.
      </div>

      <section className="pt-32 pb-8 px-6">
        <div className="max-w-7xl mx-auto">
          <p className="text-brand-accent text-xs font-bold tracking-[0.3em] uppercase mb-3">
            Webshop
          </p>
          <h1 className="font-display text-5xl md:text-6xl font-extrabold tracking-tighter">
            Grooming &amp; merch
          </h1>
        </div>
      </section>

      <section className="pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-64 bg-brand-surface animate-pulse rounded" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <EmptyState title="Nog geen producten beschikbaar." />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {products.map((p) => {
                const soldOut = p.stock === 0;
                return (
                  <article
                    key={p.id}
                    className="bg-brand-surface border border-brand-text/10 rounded overflow-hidden group hover:border-brand-accent/40 transition"
                  >
                    <Link to="/winkel/$id" params={{ id: p.id }} className="block">
                      <div className="aspect-square bg-brand-bg flex items-center justify-center text-brand-muted text-xs">
                        [ {p.name} ]
                      </div>
                    </Link>
                    <div className="p-4 flex flex-col gap-2">
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
                        <span className="text-xs text-brand-accent">
                          Nog {p.stock} beschikbaar
                        </span>
                      ) : null}
                      <button
                        onClick={() => {
                          if (soldOut) return;
                          add(p.id);
                          openDrawer();
                        }}
                        disabled={soldOut}
                        className="mt-2 bg-brand-accent text-white px-3 py-2 text-[10px] font-bold uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed hover:glow-accent transition"
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
