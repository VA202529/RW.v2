import { X, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useCart } from "@/lib/cart";
import { getProducts } from "@/lib/api/client";
import { euros } from "@/lib/format";

export function CartDrawer() {
  const { drawerOpen, closeDrawer, items, setQty, remove, count } = useCart();
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: getProducts,
    enabled: drawerOpen,
  });

  const lines = items
    .map((i) => {
      const p = products.find((x) => x.id === i.product_id);
      return p ? { ...i, product: p } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

  const total = lines.reduce((s, l) => s + l.product.price_cents * l.quantity, 0);

  if (!drawerOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeDrawer} />
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-brand-bg flex flex-col shadow-2xl">
        <div className="p-5 sm:p-6 border-b border-brand-text/10 flex justify-between items-center">
          <h2 className="font-display text-2xl font-extrabold">Winkelwagen</h2>
          <button
            onClick={closeDrawer}
            aria-label="Sluiten"
            className="min-h-10 min-w-10 inline-flex items-center justify-center rounded border border-brand-text/10 hover:border-brand-accent hover:text-brand-accent transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {count === 0 ? (
            <p className="text-sm text-brand-muted text-center py-16">Je winkelwagen is leeg.</p>
          ) : (
            <ul className="grid gap-4">
              {lines.map((l) => (
                <li
                  key={l.product_id}
                  className="flex gap-3 bg-brand-surface border border-brand-text/10 p-3 rounded-lg"
                >
                  <div className="w-16 h-16 shrink-0 bg-brand-bg rounded flex items-center justify-center overflow-hidden text-xs text-brand-muted">
                    {l.product.image_paths?.[0] ? (
                      <img
                        src={l.product.image_paths[0]}
                        alt={l.product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      "IMG"
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{l.product.name}</p>
                    <p className="text-xs text-brand-muted">{euros(l.product.price_cents)}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={() => setQty(l.product_id, l.quantity - 1)}
                        className="w-8 h-8 border border-brand-text/15 rounded hover:border-brand-accent hover:text-brand-accent transition"
                        aria-label="Aantal verlagen"
                      >
                        −
                      </button>
                      <span className="text-sm w-6 text-center">{l.quantity}</span>
                      <button
                        onClick={() => setQty(l.product_id, l.quantity + 1)}
                        disabled={l.quantity >= l.product.stock}
                        className="w-8 h-8 border border-brand-text/15 rounded disabled:opacity-40 hover:border-brand-accent hover:text-brand-accent transition"
                        aria-label="Aantal verhogen"
                      >
                        +
                      </button>
                      <button
                        onClick={() => remove(l.product_id)}
                        className="ml-auto text-brand-muted hover:text-red-600"
                        aria-label="Verwijder"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm font-bold self-start">
                    {euros(l.product.price_cents * l.quantity)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
        {count > 0 && (
          <div className="p-5 sm:p-6 border-t border-brand-text/10 space-y-3 bg-brand-bg/95">
            <div className="flex justify-between text-sm">
              <span className="text-brand-muted">Totaal</span>
              <span className="font-bold">{euros(total)}</span>
            </div>
            <Link
              to="/winkel/checkout"
              onClick={closeDrawer}
              className="block text-center bg-brand-accent text-white px-6 py-3 text-xs font-bold uppercase tracking-widest rounded hover:glow-accent transition"
            >
              Afrekenen ({euros(total)})
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
