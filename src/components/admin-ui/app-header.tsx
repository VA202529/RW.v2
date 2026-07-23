import { useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  subtitle?: string;
  back?: boolean | string;
  action?: ReactNode;
  large?: boolean;
  className?: string;
}

/** Mobile top app bar. Sticky, safe-area aware. */
export function AppHeader({ title, subtitle, back, action, large, className }: Props) {
  const router = useRouter();
  return (
    <header
      className={cn(
        "md:hidden sticky top-0 z-30 bg-background/85 backdrop-blur-xl border-b border-border",
        className,
      )}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="h-14 px-3 flex items-center gap-2">
        {back && (
          <button
            onClick={() => (typeof back === "string" ? router.navigate({ to: back }) : router.history.back())}
            className="h-10 w-10 grid place-items-center rounded-full press hover:bg-accent -ml-1"
            aria-label="Terug"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          {!large && (
            <>
              <div className="text-base font-semibold truncate leading-tight">{title}</div>
              {subtitle && <div className="text-[11px] text-muted-foreground truncate">{subtitle}</div>}
            </>
          )}
        </div>
        {action}
      </div>
      {large && (
        <div className="px-4 pb-3">
          <h1 className="text-[26px] font-black tracking-tight leading-tight">{title}</h1>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      )}
    </header>
  );
}
