import type { ReactNode } from "react";

/** Desktop / tablet page header. Hidden on mobile — AppHeader takes over. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="hidden md:flex h-auto lg:h-16 border-b border-border bg-background/60 backdrop-blur px-6 lg:px-8 py-4 lg:py-0 flex-col lg:flex-row lg:items-center gap-3 lg:gap-4 sticky top-0 z-30">
      <div className="min-w-0 flex-1">
        <h1 className="text-lg font-semibold tracking-tight truncate">{title}</h1>
        {description && (
          <p className="text-xs text-muted-foreground truncate">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {actions}
      </div>
    </header>
  );
}
