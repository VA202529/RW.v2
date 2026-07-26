import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/50 p-10 flex flex-col items-center justify-center text-center gap-3">
      <div className="h-12 w-12 rounded-full bg-muted grid place-items-center text-muted-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        {description && (
          <div className="text-xs text-muted-foreground mt-1 max-w-sm">{description}</div>
        )}
      </div>
      {action}
    </div>
  );
}
