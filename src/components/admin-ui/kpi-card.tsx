import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string;
  delta?: string;
  icon?: LucideIcon;
  positive?: boolean;
  compact?: boolean;
  className?: string;
}

export function KPICard({ label, value, delta, icon: Icon, positive = true, compact, className }: Props) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-4 press",
        compact ? "min-w-[160px]" : "",
        className,
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
        {Icon && (
          <span className="h-8 w-8 rounded-lg bg-primary/15 grid place-items-center">
            <Icon className="h-4 w-4 text-primary" />
          </span>
        )}
      </div>
      <div className="text-2xl font-black tracking-tight">{value}</div>
      {delta && (
        <div className={cn("mt-1 text-[11px] font-medium", positive ? "text-success" : "text-destructive")}>
          {delta} <span className="text-muted-foreground font-normal">vs vorige</span>
        </div>
      )}
    </div>
  );
}
