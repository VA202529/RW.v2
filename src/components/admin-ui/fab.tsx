import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onClick?: () => void;
  icon?: ReactNode;
  label?: string;
  className?: string;
}

/** Floating action button — bottom right, above bottom nav on mobile. */
export function FAB({ onClick, icon, label, className }: Props) {
  return (
    <button
      onClick={onClick}
      aria-label={label ?? "Nieuw"}
      className={cn(
        "md:hidden fixed right-4 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground grid place-items-center shadow-2xl shadow-primary/40 active:scale-90 active:rotate-12 transition-transform duration-150",
        className,
      )}
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 72px)" }}
    >
      {icon ?? <Plus className="h-6 w-6" strokeWidth={2.5} />}
    </button>
  );
}
