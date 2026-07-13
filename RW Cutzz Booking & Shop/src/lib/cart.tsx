import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type CartItem = { product_id: string; quantity: number };

type Ctx = {
  items: CartItem[];
  count: number;
  add: (product_id: string, qty?: number) => void;
  remove: (product_id: string) => void;
  setQty: (product_id: string, qty: number) => void;
  clear: () => void;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
};

const CartContext = createContext<Ctx | null>(null);
const KEY = "rw_cart_v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {}
  }, [items, hydrated]);

  const add = useCallback((product_id: string, qty = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product_id === product_id);
      if (existing) {
        return prev.map((i) =>
          i.product_id === product_id ? { ...i, quantity: i.quantity + qty } : i,
        );
      }
      return [...prev, { product_id, quantity: qty }];
    });
  }, []);

  const remove = useCallback((product_id: string) => {
    setItems((prev) => prev.filter((i) => i.product_id !== product_id));
  }, []);

  const setQty = useCallback((product_id: string, qty: number) => {
    setItems((prev) =>
      prev
        .map((i) => (i.product_id === product_id ? { ...i, quantity: Math.max(1, qty) } : i))
        .filter((i) => i.quantity > 0),
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);
  const count = useMemo(() => items.reduce((s, i) => s + i.quantity, 0), [items]);

  const value: Ctx = {
    items,
    count,
    add,
    remove,
    setQty,
    clear,
    drawerOpen,
    openDrawer: () => setDrawerOpen(true),
    closeDrawer: () => setDrawerOpen(false),
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
