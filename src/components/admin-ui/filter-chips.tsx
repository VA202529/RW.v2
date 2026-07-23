import { cn } from "@/lib/utils";

interface Chip {
  value: string;
  label: string;
  count?: number;
}

export function FilterChips({
  chips,
  value,
  onChange,
  className,
}: {
  chips: Chip[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4", className)}>
      {chips.map((c) => {
        const active = c.value === value;
        return (
          <button
            key={c.value}
            onClick={() => onChange(c.value)}
            className={cn(
              "shrink-0 h-9 px-4 rounded-full text-xs font-medium border press whitespace-nowrap",
              active
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:text-foreground",
            )}
          >
            {c.label}
            {c.count !== undefined && (
              <span className={cn("ml-1.5 opacity-70")}>{c.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
