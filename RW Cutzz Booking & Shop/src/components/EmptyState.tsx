import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  cta,
}: {
  icon?: ReactNode;
  title: string;
  cta?: ReactNode;
}) {
  return (
    <div className="border border-dashed border-brand-text/15 rounded-lg p-10 text-center flex flex-col items-center gap-3 bg-brand-surface">
      {icon && <div className="text-brand-muted">{icon}</div>}
      <p className="text-sm text-brand-muted">{title}</p>
      {cta}
    </div>
  );
}
