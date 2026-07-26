import { cn } from "../../lib/utils";

type AdminStatus =
  | "confirmed"
  | "pending"
  | "pending_payment"
  | "cancelled"
  | "completed"
  | "no_show"
  | "paid"
  | "ready_for_pickup"
  | "picked_up"
  | "superseded"
  | string;

const bookingLabels: Record<string, string> = {
  confirmed: "Bevestigd",
  pending: "In afwachting",
  pending_payment: "In afwachting",
  cancelled: "Geannuleerd",
  completed: "Voltooid",
  no_show: "No-show",
  paid: "Betaald",
  ready_for_pickup: "Klaar",
  picked_up: "Opgehaald",
  superseded: "Verlopen",
};

export function StatusBadge({ status }: { status: AdminStatus }) {
  return (
    <span
      className={cn(
        "lovableStatus",
        status,
      )}
    >
      {bookingLabels[status] ?? status}
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
