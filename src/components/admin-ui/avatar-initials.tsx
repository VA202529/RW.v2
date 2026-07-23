import { cn } from "@/lib/utils";

const PALETTE = [
  "from-primary/60 to-primary/20",
  "from-emerald-500/60 to-emerald-500/20",
  "from-amber-500/60 to-amber-500/20",
  "from-rose-500/60 to-rose-500/20",
  "from-fuchsia-500/60 to-fuchsia-500/20",
  "from-cyan-500/60 to-cyan-500/20",
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function AvatarInitials({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const color = PALETTE[hash(name) % PALETTE.length];
  const sizes = {
    sm: "h-8 w-8 text-[11px]",
    md: "h-10 w-10 text-xs",
    lg: "h-14 w-14 text-sm",
  }[size];
  return (
    <div
      className={cn(
        "rounded-full bg-gradient-to-br grid place-items-center font-semibold text-white shrink-0",
        color,
        sizes,
        className,
      )}
    >
      {initials}
    </div>
  );
}
