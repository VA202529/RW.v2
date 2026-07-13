import { Star } from "lucide-react";

export function StarRating({
  value,
  onChange,
  size = 20,
  readOnly = false,
}: {
  value: number;
  onChange?: (n: number) => void;
  size?: number;
  readOnly?: boolean;
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
        const Cmp = readOnly ? "span" : "button";
        return (
          <Cmp
            key={n}
            {...(readOnly
              ? {}
              : {
                  type: "button" as const,
                  onClick: () => onChange?.(n),
                  "aria-label": `${n} ster${n > 1 ? "ren" : ""}`,
                })}
            className={readOnly ? "" : "cursor-pointer"}
          >
            <Star
              width={size}
              height={size}
              className={filled ? "fill-brand-accent text-brand-accent" : "text-brand-text/25"}
            />
          </Cmp>
        );
      })}
    </div>
  );
}
