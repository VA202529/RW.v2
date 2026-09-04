import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { useCart } from "@/lib/cart";
import { getProducts } from "@/lib/api/client";
import { euros } from "@/lib/format";
import { routeHead } from "@/seo/metadata";
import { productJsonLd } from "@/seo/structured-data";

export const Route = createFileRoute("/winkel/$id")({
  head: ({ params }) =>
    routeHead({
      title: "Product | RW CUTZZ",
      description: "Bekijk dit product in de RW CUTZZ webshop.",
      path: `/winkel/${params.id}`,
    }),
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
      <div className="min-h-screen bg-brand-bg flex flex-col overflow-x-hidden">
        <SiteHeader />
        <div className="pt-32 max-w-5xl mx-auto px-5 sm:px-6 md:px-8 w-full">
          <div className="h-96 bg-brand-surface animate-pulse rounded-lg" />
        </div>
      </div>
    );
  }

  const p = products.find((x) => x.id === id);
  if (!p) throw notFound();

  const soldOut = p.stock === 0;
  const productSchema = productJsonLd(p);
  const image = p.image_paths?.[0];

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col overflow-x-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <SiteHeader />
      <section className="pt-28 md:pt-32 lg:pt-36 pb-16 md:pb-20 px-5 sm:px-6 md:px-8">
        <div className="max-w-6xl mx-auto grid gap-8 md:grid-cols-2 lg:gap-12 items-start">
          <div className="min-w-0">
            <div className="aspect-square bg-brand-surface border border-brand-text/10 rounded-lg overflow-hidden flex items-center justify-center text-brand-muted">
              {image ? (
                <img src={image} alt={p.name} className="h-full w-full object-cover" />
              ) : (
                <span className="px-6 text-center text-xs uppercase tracking-widest">{p.name}</span>
              )}
            </div>
          </div>
          <div className="min-w-0">
            <Link
              to="/winkel"
              className="text-xs text-brand-muted hover:text-brand-accent uppercase tracking-widest"
            >
              ← Terug naar shop
            </Link>
            <p className="text-[10px] uppercase tracking-widest text-brand-muted mt-6">
              {p.category}
            </p>
            <h1 className="break-words font-display font-extrabold tracking-tight leading-[1.05] mt-2 text-[clamp(2rem,7vw,3.5rem)]">
              {p.name}
            </h1>
            <p className="text-2xl text-brand-accent font-bold mt-3">
              {euros(p.price_cents)}{" "}
              <span className="text-xs text-brand-muted font-normal">incl. BTW</span>
            </p>
            <p className="mt-6 text-brand-muted leading-relaxed">{p.description}</p>

            {soldOut ? (
              <p className="mt-6 rounded-lg border border-brand-text/10 bg-brand-surface p-4 text-sm text-brand-muted">
                Momenteel uitverkocht.
              </p>
            ) : (
              <>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <div className="flex items-center rounded-lg border border-brand-text/15 bg-brand-surface">
                    <button
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                      className="w-11 h-11 hover:text-brand-accent transition"
                      aria-label="Aantal verlagen"
                    >
                      −
                    </button>
                    <span className="w-10 text-center text-sm font-bold">{qty}</span>
                    <button
                      onClick={() => setQty((q) => Math.min(p.stock, q + 1))}
                      className="w-11 h-11 hover:text-brand-accent transition"
                      aria-label="Aantal verhogen"
                    >
                      +
                    </button>
                  </div>
                  {p.stock <= 5 ? (
                    <span className="text-xs text-brand-accent">Nog {p.stock} beschikbaar</span>
                  ) : null}
                </div>
                <button
                  onClick={() => {
                    add(p.id, qty);
                    openDrawer();
                  }}
                  className="mt-6 w-full sm:w-auto bg-brand-accent text-white px-6 py-4 text-xs font-bold uppercase tracking-widest rounded hover:glow-accent transition"
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
