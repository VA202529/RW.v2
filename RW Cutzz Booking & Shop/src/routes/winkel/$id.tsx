import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { useCart } from "@/lib/cart";
import { getProducts } from "@/lib/api/client";
import { euros } from "@/lib/format";

export const Route = createFileRoute("/winkel/$id")({
  head: () => ({ meta: [{ title: "Product — RW CUTZZ" }] }),
  component: ProductPage,
});

function ProductPage() {
  const { id } = Route.useParams();
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: getProducts,
  });
  const [qty, setQty] = useState(1);
  const { add, openDrawer } = useCart();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-brand-bg flex flex-col">
        <SiteHeader />
        <div className="pt-32 max-w-4xl mx-auto px-6">
          <div className="h-96 bg-brand-surface animate-pulse rounded" />
        </div>
      </div>
    );
  }

  const p = products.find((x) => x.id === id);
  if (!p) throw notFound();

  const soldOut = p.stock === 0;

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      <SiteHeader />
      <section className="pt-28 pb-20 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-10">
          <div className="aspect-square bg-brand-surface border border-brand-text/10 rounded flex items-center justify-center text-brand-muted">
            [ {p.name} ]
          </div>
          <div>
            <Link
              to="/winkel"
              className="text-xs text-brand-muted hover:text-brand-accent uppercase tracking-widest"
            >
              ← Terug naar shop
            </Link>
            <p className="text-[10px] uppercase tracking-widest text-brand-muted mt-6">
              {p.category}
            </p>
            <h1 className="font-display text-4xl font-extrabold tracking-tighter mt-2">
              {p.name}
            </h1>
            <p className="text-2xl text-brand-accent font-bold mt-3">
              {euros(p.price_cents)}{" "}
              <span className="text-xs text-brand-muted font-normal">incl. BTW</span>
            </p>
            <p className="mt-6 text-brand-muted">{p.description}</p>

            {soldOut ? (
              <p className="mt-6 text-sm text-brand-muted">Momenteel uitverkocht.</p>
            ) : (
              <>
                <div className="mt-6 flex items-center gap-3">
                  <button
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="w-9 h-9 border border-brand-text/15 rounded"
                  >
                    −
                  </button>
                  <span className="w-8 text-center">{qty}</span>
                  <button
                    onClick={() => setQty((q) => Math.min(p.stock, q + 1))}
                    className="w-9 h-9 border border-brand-text/15 rounded"
                  >
                    +
                  </button>
                  <span className="text-xs text-brand-muted ml-2">
                    {p.stock <= 5 ? `Nog ${p.stock} beschikbaar` : ""}
                  </span>
                </div>
                <button
                  onClick={() => {
                    add(p.id, qty);
                    openDrawer();
                  }}
                  className="mt-6 bg-brand-accent text-white px-6 py-3 text-xs font-bold uppercase tracking-widest hover:glow-accent transition"
                >
                  In winkelwagen
                </button>
              </>
            )}
          </div>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
