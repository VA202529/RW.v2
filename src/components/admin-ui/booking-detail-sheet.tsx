import { useEffect, useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AvatarInitials } from "@/components/avatar-initials";
import { StatusBadge } from "@/components/status-badge";
import type { Booking } from "@/lib/mock-data";
import { Calendar, Clock, Euro, CheckCircle2, X, CalendarClock } from "lucide-react";
import { toast } from "sonner";

interface Props {
  booking: Booking | null;
  onOpenChange: (open: boolean) => void;
  onUpdate?: (b: Booking) => void;
}

export function BookingDetailSheet({ booking, onOpenChange, onUpdate }: Props) {
  const [notes, setNotes] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [reschedule, setReschedule] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");

  useEffect(() => {
    if (booking) {
      setNotes("");
      const d = new Date(booking.start);
      setNewDate(d.toISOString().slice(0, 10));
      setNewTime(d.toTimeString().slice(0, 5));
    }
  }, [booking]);

  if (!booking) return null;
  const start = new Date(booking.start);
  const end = new Date(start.getTime() + booking.durationMin * 60000);

  const doCancel = () => {
    onUpdate?.({ ...booking, status: "cancelled" });
    setConfirmCancel(false);
    onOpenChange(false);
    toast.success("Boeking geannuleerd");
  };
  const doComplete = () => {
    onUpdate?.({ ...booking, status: "completed" });
    onOpenChange(false);
    toast.success("Gemarkeerd als voltooid");
  };
  const doReschedule = () => {
    const iso = new Date(`${newDate}T${newTime}:00`).toISOString();
    onUpdate?.({ ...booking, start: iso });
    setReschedule(false);
    onOpenChange(false);
    toast.success("Afspraak verzet");
  };

  return (
    <>
      <Sheet open={!!booking} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl border-t border-border bg-card p-0 max-h-[92vh] overflow-y-auto sm:max-w-lg sm:mx-auto"
        >
          <div className="pt-2 pb-1 grid place-items-center">
            <div className="h-1.5 w-12 rounded-full bg-muted-foreground/30" />
          </div>

          <div className="px-5 pt-4 pb-6 space-y-5">
            <div className="flex items-center gap-3">
              <AvatarInitials name={booking.customerName} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="text-lg font-bold truncate">{booking.customerName}</div>
                <div className="text-sm text-muted-foreground truncate">{booking.serviceName}</div>
              </div>
              <StatusBadge status={booking.status} />
            </div>

            <div className="grid gap-2 rounded-2xl bg-muted/30 p-4">
              <Row
                icon={<Calendar className="h-4 w-4" />}
                label="Datum"
                value={start.toLocaleDateString("nl-NL", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              />
              <Row
                icon={<Clock className="h-4 w-4" />}
                label="Tijd"
                value={`${start.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })} — ${end.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })} (${booking.durationMin} min)`}
              />
              <Row
                icon={<Euro className="h-4 w-4" />}
                label="Aanbetaling"
                value={`€ ${booking.deposit.toFixed(2)}`}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="notes" className="text-xs uppercase tracking-wide text-muted-foreground">
                Notitie
              </Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Voeg een notitie toe…"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
              <Button
                variant="outline"
                className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setConfirmCancel(true)}
                disabled={booking.status === "cancelled"}
              >
                <X className="h-4 w-4 mr-1.5" /> Annuleren
              </Button>
              <Button
                variant="outline"
                className="border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
                onClick={() => setReschedule(true)}
              >
                <CalendarClock className="h-4 w-4 mr-1.5" /> Verzetten
              </Button>
              <Button
                className="bg-success text-success-foreground hover:bg-success/90"
                onClick={doComplete}
                disabled={booking.status === "completed"}
              >
                <CheckCircle2 className="h-4 w-4 mr-1.5" /> Voltooid
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Boeking annuleren?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je de boeking van {booking.customerName} wilt annuleren? Dit kan niet ongedaan
              worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Terug</AlertDialogCancel>
            <AlertDialogAction
              onClick={doCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Annuleer boeking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={reschedule} onOpenChange={setReschedule}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl border-t border-border bg-card sm:max-w-md sm:mx-auto"
        >
          <div className="pt-2 pb-1 grid place-items-center">
            <div className="h-1.5 w-12 rounded-full bg-muted-foreground/30" />
          </div>
          <div className="px-1 pt-4 space-y-4">
            <div className="text-lg font-bold">Afspraak verzetten</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Datum</Label>
                <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Tijd</Label>
                <Input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="ghost" className="flex-1" onClick={() => setReschedule(false)}>
                Terug
              </Button>
              <Button className="flex-1" onClick={doReschedule}>
                Bevestig
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-8 w-8 rounded-lg bg-background grid place-items-center text-muted-foreground shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-sm font-medium truncate">{value}</div>
      </div>
    </div>
  );
}
