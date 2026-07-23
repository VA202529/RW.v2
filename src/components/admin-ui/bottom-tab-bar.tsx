import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { Calendar, ClipboardList, Users, ShoppingBag, MoreHorizontal, Scissors, Megaphone, Star, Clock, BarChart3, X } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/agenda", label: "Agenda", icon: Calendar },
  { to: "/boekingen", label: "Boekingen", icon: ClipboardList },
  { to: "/klanten", label: "Klanten", icon: Users },
  { to: "/webshop", label: "Webshop", icon: ShoppingBag },
];

const MORE_ITEMS = [
  { to: "/diensten", label: "Diensten", icon: Scissors, desc: "Beheer je services en prijzen" },
  { to: "/aankondigingen", label: "Aankondigingen", icon: Megaphone, desc: "Stuur updates naar klanten" },
  { to: "/reviews", label: "Reviews", icon: Star, desc: "Klantbeoordelingen" },
  { to: "/beschikbaarheid", label: "Beschikbaarheid", icon: Clock, desc: "Openingsuren en blokkades" },
  { to: "/statistieken", label: "Statistieken", icon: BarChart3, desc: "Cijfers en trends" },
];

export function BottomTabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MORE_ITEMS.some((i) => pathname.startsWith(i.to));

  return (
    <>
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-sidebar/95 backdrop-blur-xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-stretch">
          {TABS.map((t) => {
            const active = pathname === t.to || pathname.startsWith(t.to + "/");
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-1 pt-2 pb-2 min-h-[56px] press relative",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className={cn("h-5 w-5", active && "fill-primary/20")} strokeWidth={active ? 2.5 : 2} />
                <span className="text-[10px] font-medium">{t.label}</span>
                {active && <span className="absolute top-0 h-0.5 w-8 rounded-b-full bg-primary" />}
              </Link>
            );
          })}
          <button
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-1 pt-2 pb-2 min-h-[56px] press",
              moreActive ? "text-primary" : "text-muted-foreground",
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="text-[10px] font-medium">Meer</span>
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-background animate-page-in flex flex-col" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          <div className="flex items-center justify-between px-4 h-14 border-b border-border">
            <h2 className="text-base font-semibold">Meer</h2>
            <button
              onClick={() => setMoreOpen(false)}
              className="h-10 w-10 grid place-items-center rounded-full press hover:bg-accent"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {MORE_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 press"
                >
                  <div className="h-11 w-11 rounded-xl bg-primary/15 grid place-items-center">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{item.label}</div>
                    <div className="text-xs text-muted-foreground truncate">{item.desc}</div>
                  </div>
                </Link>
              );
            })}
            <div className="pt-6 flex items-center gap-3 px-2">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-primary/40 grid place-items-center text-xs font-bold">RW</div>
              <div className="text-xs">
                <div className="font-medium">Reggie W.</div>
                <div className="text-muted-foreground">owner@rwcutzz.nl</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
