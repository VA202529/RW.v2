import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { GuestForm } from "@/components/GuestForm";
import { EmptyState } from "@/components/EmptyState";
import { useCart } from "@/lib/cart";
import { getProducts, createOrder, createOrderCheckout, dutchError } from "@/lib/api/client";
import { euros } from "@/lib/format";
import { routeHead } from "@/seo/metadata";

export const Route = createFileRoute("/winkel/checkout")({
  head: () =>
    routeHead({
      title: "Afrekenen | RW CUTZZ",
      description: "Afrekenen bij RW CUTZZ.",
      path: "/winkel/checkout",
      robots: "noindex, follow",
    }),
  component: Checkout,
});

function Checkout() {
  const nav = useNavigate();
  const { items, clear } = useCart();
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: getProducts });

  const lines = items
    .map((i) => {
      const p = products.find((x) => x.id === i.product_id);
      return p ? { ...i, product: p } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
  const total = lines.reduce((s, l) => s + l.product.price_cents * l.quantity, 0);

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col overflow-x-hidden">
      <SiteHeader />
      <section className="pt-28 md:pt-32 lg:pt-36 pb-16 md:pb-20 px-5 sm:px-6 md:px-8">
        <div className="max-w-5xl mx-auto">
          <p className="text-brand-accent text-[10px] sm:text-xs font-bold tracking-[0.25em] uppercase mb-3">
            Webshop
          </p>
          <h1 className="font-display font-extrabold tracking-tight leading-[1.05] mb-8 text-[clamp(2rem,6vw,3rem)]">
            Afrekenen
          </h1>

          {items.length === 0 ? (
            <EmptyState title="Je winkelwagen is leeg." />
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8 items-start">
              <div className="min-w-0 bg-brand-surface border border-brand-text/10 rounded-lg p-5 sm:p-6">
                <GuestForm
                  submitLabel={`Betaal ${euros(total)}`}
                  onSubmit={async (guest, token) => {
                    try {
                      const order = await createOrder({
                        items: items.map((i) => ({
                          product_id: i.product_id,
                          quantity: i.quantity,
                        })),
                        guest,
                        turnstile_token: token,
                      });
                      const res = await createOrderCheckout({ order_id: order.order_id });
                      clear();
                      if (res.checkout_url) window.location.href = res.checkout_url;
                      else nav({ to: "/winkel/succes" });
                    } catch (e) {
                      toast.error(dutchError(e));
                    }
                  }}
                />
                <p className="text-[11px] text-brand-muted mt-4">
                  Herroepingsrecht: je hebt het recht om binnen 14 dagen na ontvangst je bestelling
                  te retourneren, tenzij de verzegeling van het product verbroken is.
                </p>
              </div>

              <aside className="min-w-0 bg-brand-surface border border-brand-text/10 rounded-lg p-5 sm:p-6 lg:sticky lg:top-28">
                <p className="text-xs uppercase tracking-widest text-brand-muted mb-4">Overzicht</p>
                <ul className="grid gap-3 text-sm">
                  {lines.map((l) => (
                    <li key={l.product_id} className="flex justify-between gap-3">
                      <span className="min-w-0 break-words">
                        {l.quantity}× {l.product.name}
                      </span>
                      <span className="shrink-0">{euros(l.product.price_cents * l.quantity)}</span>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-brand-text/10 mt-4 pt-4 flex justify-between font-bold">
                  <span>Totaal</span>
                  <span className="text-brand-accent">{euros(total)}</span>
                </div>
              </aside>
            </div>
          )}
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
