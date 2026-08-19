import { useEffect, useState } from "react";
import {
  Calendar,
  ClipboardList,
  Users,
  ShoppingBag,
  MoreHorizontal,
  Scissors,
  Megaphone,
  Star,
  Clock,
  BarChart3,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/admin", label: "Agenda", icon: Calendar },
  { to: "/admin/boekingen", label: "Boekingen", icon: ClipboardList },
  { to: "/admin/klanten", label: "Klanten", icon: Users },
  { to: "/admin/webshop", label: "Webshop", icon: ShoppingBag },
];

const MORE_ITEMS = [
  { to: "/admin/diensten", label: "Diensten", icon: Scissors, desc: "Beheer je services en prijzen" },
  { to: "/admin/aankondigingen", label: "Aankondigingen", icon: Megaphone, desc: "Stuur updates naar klanten" },
  { to: "/admin/reviews", label: "Reviews", icon: Star, desc: "Klantbeoordelingen" },
  { to: "/admin/beschikbaarheid", label: "Beschikbaarheid", icon: Clock, desc: "Openingsuren en blokkades" },
  { to: "/admin/statistieken", label: "Statistieken", icon: BarChart3, desc: "Cijfers en trends" },
];

type BottomTabBarProps = {
  path: string;
  onNavigate: (to: string) => void;
};

export function BottomTabBar({ path, onNavigate }: BottomTabBarProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MORE_ITEMS.some((item) => path.startsWith(item.to));

  useEffect(() => {
    setMoreOpen(false);
  }, [path]);

  function navigateAndClose(to: string) {
    setMoreOpen(false);
    onNavigate(to);
  }

  return (
    <>
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-sidebar/95 backdrop-blur-xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-stretch">
          {TABS.map((tab) => {
            const active = path === tab.to || path.startsWith(tab.to + "/");
            const Icon = tab.icon;
            return (
              <button
                key={tab.to}
                type="button"
                onClick={() => navigateAndClose(tab.to)}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-1 pt-2 pb-2 min-h-[56px] press relative",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className={cn("h-5 w-5", active && "fill-primary/20")} strokeWidth={active ? 2.5 : 2} />
                <span className="text-[10px] font-medium">{tab.label}</span>
                {active && <span className="absolute top-0 h-0.5 w-8 rounded-b-full bg-primary" />}
              </button>
            );
          })}
          <button
            type="button"
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
        <div className="md:hidden fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Sluit menu"
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
            onClick={() => setMoreOpen(false)}
          />
          <section
            className="absolute inset-x-0 bottom-0 max-h-[80dvh] rounded-t-3xl border border-border bg-background shadow-2xl animate-page-in flex flex-col"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="flex items-center justify-between px-4 h-14 border-b border-border">
              <h2 className="text-base font-semibold">Meer</h2>
              <button
                type="button"
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
                  <button
                    key={item.to}
                    type="button"
                    onClick={() => navigateAndClose(item.to)}
                    className="w-full text-left flex items-center gap-4 rounded-2xl border border-border bg-card p-4 press"
                  >
                    <div className="h-11 w-11 rounded-xl bg-primary/15 grid place-items-center">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold">{item.label}</div>
                      <div className="text-xs text-muted-foreground truncate">{item.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
