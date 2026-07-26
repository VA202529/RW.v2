import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  delta,
  icon: Icon,
  positive = true,
}: {
  label: string;
  value: string;
  delta?: string;
  icon: LucideIcon;
  positive?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className="h-8 w-8 rounded-md bg-primary/15 text-primary grid place-items-center">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        {delta && (
          <span
            className={cn(
              "text-xs font-medium",
              positive ? "text-success" : "text-destructive",
            )}
          >
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}
