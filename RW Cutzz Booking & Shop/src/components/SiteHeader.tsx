import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, ShoppingBag, User, X } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/lib/cart";

const links = [
  { to: "/", label: "Home" },
  { to: "/diensten", label: "Diensten" },
  { to: "/boeken", label: "Boeken" },
  { to: "/winkel", label: "Winkel" },
  { to: "/contact", label: "Contact" },
  { to: "/account", label: "Account" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { count, openDrawer } = useCart();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <header className="fixed top-0 w-full z-40 border-b border-brand-text/10 bg-brand-bg/85 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-5 sm:px-6 md:px-8 gap-3 md:gap-4 h-16 md:h-[4.5rem] lg:h-20 flex items-center justify-between">
        <Link
          to="/"
          className="font-display text-xl md:text-[1.375rem] lg:text-2xl font-extrabold tracking-tighter whitespace-nowrap shrink-0"
        >
          RW <span className="text-brand-accent">CUTZZ</span>
        </Link>

        <nav className="hidden md:flex gap-4 lg:gap-5 xl:gap-8 text-[11px] lg:text-xs xl:text-sm whitespace-nowrap font-medium tracking-widest uppercase">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`hover:text-brand-accent transition-colors ${
                pathname === l.to ? "text-brand-accent" : ""
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1 md:gap-2 shrink-0">
          <button
            onClick={openDrawer}
            aria-label="Winkelwagen openen"
            className="relative p-2 hover:text-brand-accent transition"
          >
            <ShoppingBag className="w-5 h-5" />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 bg-brand-accent text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {count}
              </span>
            )}
          </button>
          <Link
            to="/account"
            aria-label="Account"
            className="p-2 hover:text-brand-accent transition hidden md:inline-flex"
          >
            <User className="w-5 h-5" />
          </Link>
          <Link
            to="/boeken"
            className="hidden lg:inline-flex whitespace-nowrap bg-brand-accent text-white px-4 xl:px-5 py-2.5 text-[11px] xl:text-xs font-bold uppercase tracking-widest hover:glow-accent transition-all rounded"
          >
            Boek nu
          </Link>
          <button onClick={() => setOpen((v) => !v)} className="md:hidden p-2" aria-label="Menu">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-brand-text/10 bg-brand-surface">
          <div className="flex flex-col p-4 gap-3">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="py-2 text-sm font-medium uppercase tracking-widest"
              >
                {l.label}
              </Link>
            ))}
            <Link
              to="/boeken"
              onClick={() => setOpen(false)}
              className="bg-brand-accent text-white px-5 py-3 text-xs font-bold uppercase tracking-widest text-center rounded"
            >
              Boek nu
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
