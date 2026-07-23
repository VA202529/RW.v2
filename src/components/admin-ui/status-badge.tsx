import { cn } from "@/lib/utils";
import type { BookingStatus } from "@/lib/mock-data";

const bookingLabels: Record<BookingStatus, string> = {
  confirmed: "Bevestigd",
  pending: "In afwachting",
  cancelled: "Geannuleerd",
  completed: "Voltooid",
};

const bookingStyles: Record<BookingStatus, string> = {
  confirmed: "bg-success/15 text-success border-success/30",
  pending: "bg-warning/15 text-warning border-warning/30",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
  completed: "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        bookingStyles[status],
      )}
    >
      {bookingLabels[status]}
    </span>
  );
}

export function GenericBadge({
  tone = "default",
  children,
}: {
  tone?: "default" | "success" | "warning" | "danger" | "info" | "muted";
  children: React.ReactNode;
}) {
  const styles: Record<string, string> = {
    default: "bg-muted text-muted-foreground border-border",
    success: "bg-success/15 text-success border-success/30",
    warning: "bg-warning/15 text-warning border-warning/30",
    danger: "bg-destructive/15 text-destructive border-destructive/30",
    info: "bg-primary/15 text-primary border-primary/30",
    muted: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        styles[tone],
      )}
    >
      {children}
    </span>
  );
}
