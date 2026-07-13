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

export const Route = createFileRoute("/winkel/checkout")({
  head: () => ({ meta: [{ title: "Afrekenen — RW CUTZZ" }] }),
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
    <div className="min-h-screen bg-brand-bg">
      <SiteHeader />
      <section className="pt-28 pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="font-display text-4xl md:text-5xl font-extrabold tracking-tighter mb-8">
            Afrekenen
          </h1>

          {items.length === 0 ? (
            <EmptyState title="Je winkelwagen is leeg." />
          ) : (
            <div className="grid md:grid-cols-[1fr_360px] gap-8 items-start">
              <div className="bg-brand-surface border border-brand-text/10 rounded p-6">
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
                  Herroepingsrecht: je hebt het recht om binnen 14 dagen na ontvangst je
                  bestelling te retourneren, tenzij de verzegeling van het product verbroken is.
                </p>
              </div>

              <aside className="bg-brand-surface border border-brand-text/10 rounded p-6">
                <p className="text-xs uppercase tracking-widest text-brand-muted mb-4">
                  Overzicht
                </p>
                <ul className="grid gap-3 text-sm">
                  {lines.map((l) => (
                    <li key={l.product_id} className="flex justify-between gap-2">
                      <span className="truncate">
                        {l.quantity}× {l.product.name}
                      </span>
                      <span>{euros(l.product.price_cents * l.quantity)}</span>
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
