import { NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { Scissors, LogOut } from "lucide-react";

type SidebarProps = {
  path: string;
  onNavigate: (to: string) => void;
  onLogout?: () => void;
};

export function FullSidebar({ path, onNavigate, onLogout }: SidebarProps) {
  return (
    <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground">
      <div className="h-16 flex items-center gap-2.5 px-5 border-b border-border">
        <div className="h-9 w-9 rounded-xl bg-primary grid place-items-center shadow-lg shadow-primary/30">
          <Scissors className="h-4 w-4 text-primary-foreground" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold leading-tight">BarberFlow</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">RW CUTZZ</div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const active = path === item.to || path.startsWith(item.to + "/");
          const Icon = item.icon;
          return (
            <button
              key={item.to}
              type="button"
              onClick={() => onNavigate(item.to)}
              className={cn(
                "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors press",
                active
                  ? "bg-primary/15 text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", active && "text-primary")} />
              <span className="truncate">{item.label}</span>
              {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
            </button>
          );
        })}
      </nav>
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-primary/40 grid place-items-center text-xs font-bold">RW</div>
          <div className="min-w-0 flex-1 text-xs">
            <div className="font-semibold truncate">RW CUTZZ Admin</div>
            <div className="text-muted-foreground truncate">Beheerdersaccount</div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="h-8 w-8 grid place-items-center rounded-md hover:bg-accent text-muted-foreground"
            aria-label="Uitloggen"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

export function SideRail({ path, onNavigate }: Omit<SidebarProps, "onLogout">) {
  return (
    <aside className="hidden md:flex lg:hidden w-16 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="h-16 grid place-items-center border-b border-border">
        <div className="h-9 w-9 rounded-xl bg-primary grid place-items-center">
          <Scissors className="h-4 w-4 text-primary-foreground" />
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-3 space-y-1 px-2">
        {NAV_ITEMS.map((item) => {
          const active = path === item.to || path.startsWith(item.to + "/");
          const Icon = item.icon;
          return (
            <button
              key={item.to}
              type="button"
              onClick={() => onNavigate(item.to)}
              title={item.label}
              className={cn(
                "w-full flex flex-col items-center gap-1 rounded-xl py-2.5 press",
                active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[9px] font-medium leading-none">{item.label.slice(0, 5)}</span>
            </button>
          );
        })}
      </nav>
      <div className="p-2 border-t border-border grid place-items-center pb-3">
        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-primary/40 grid place-items-center text-[11px] font-bold">RW</div>
      </div>
    </aside>
  );
}
