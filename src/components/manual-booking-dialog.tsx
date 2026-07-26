import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { customers, services } from "@/lib/mock-data";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const STEPS = ["Klant", "Dienst", "Datum & tijd", "Bevestigen"];

export function ManualBookingDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [step, setStep] = useState(0);
  const [search, setSearch] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "" });
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  );
  const customer =
    customers.find((c) => c.id === customerId) ??
    (newCustomer.name ? { name: newCustomer.name, phone: newCustomer.phone } : null);
  const service = services.find((s) => s.id === serviceId);

  const reset = () => {
    setStep(0);
    setSearch("");
    setCustomerId(null);
    setNewCustomer({ name: "", phone: "" });
    setServiceId(null);
    setDate("");
    setTime("");
  };

  const canNext =
    (step === 0 && (customerId || newCustomer.name)) ||
    (step === 1 && serviceId) ||
    (step === 2 && date && time) ||
    step === 3;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Handmatige boeking</DialogTitle>
        </DialogHeader>

        <ol className="flex items-center gap-2 text-xs">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              <span
                className={cn(
                  "h-6 w-6 rounded-full grid place-items-center border",
                  i < step && "bg-primary text-primary-foreground border-primary",
                  i === step && "border-primary text-primary",
                  i > step && "border-border text-muted-foreground",
                )}
              >
                {i < step ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className={cn(i === step ? "text-foreground" : "text-muted-foreground")}>
                {s}
              </span>
              {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            </li>
          ))}
        </ol>

        <div className="mt-4 min-h-[220px]">
          {step === 0 && (
            <div className="space-y-3">
              <Input
                placeholder="Zoek bestaande klant..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="max-h-40 overflow-y-auto rounded-md border border-border divide-y divide-border">
                {filteredCustomers.slice(0, 6).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setCustomerId(c.id);
                      setNewCustomer({ name: "", phone: "" });
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center justify-between",
                      customerId === c.id && "bg-primary/10 text-primary",
                    )}
                  >
                    <span>{c.name}</span>
                    <span className="text-xs text-muted-foreground">{c.phone}</span>
                  </button>
                ))}
              </div>
              <div className="text-xs text-muted-foreground">Of maak een nieuwe klant aan:</div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Naam"
                  value={newCustomer.name}
                  onChange={(e) => {
                    setNewCustomer({ ...newCustomer, name: e.target.value });
                    setCustomerId(null);
                  }}
                />
                <Input
                  placeholder="Telefoon"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {services
                .filter((s) => s.active)
                .map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setServiceId(s.id)}
                    className={cn(
                      "rounded-md border p-3 text-left",
                      serviceId === s.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/40",
                    )}
                  >
                    <div className="text-sm font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {s.durationMin} min · €{s.price}
                    </div>
                  </button>
                ))}
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Datum</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Tijd</Label>
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
              <div className="col-span-2 grid grid-cols-4 gap-2 mt-2">
                {["09:00", "10:30", "12:00", "13:30", "15:00", "16:30", "17:30", "18:30"].map(
                  (t) => (
                    <button
                      key={t}
                      onClick={() => setTime(t)}
                      className={cn(
                        "rounded-md border py-1.5 text-xs",
                        time === t
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/40",
                      )}
                    >
                      {t}
                    </button>
                  ),
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="rounded-md border border-border p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Klant</span>
                <span>{customer?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dienst</span>
                <span>{service?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Datum</span>
                <span>{date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tijd</span>
                <span>{time}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 mt-2">
                <span className="text-muted-foreground">Totaal</span>
                <span className="font-medium">€{service?.price ?? 0}</span>
              </div>
              <div className="text-xs text-muted-foreground pt-1">
                Geen aanbetaling vereist voor handmatige boekingen.
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button
            variant="ghost"
            onClick={() => (step === 0 ? onOpenChange(false) : setStep(step - 1))}
          >
            {step === 0 ? "Annuleren" : "Terug"}
          </Button>
          {step < 3 ? (
            <Button disabled={!canNext} onClick={() => setStep(step + 1)}>
              Volgende
            </Button>
          ) : (
            <Button
              onClick={() => {
                toast.success("Boeking aangemaakt");
                onOpenChange(false);
                reset();
              }}
            >
              Boeking bevestigen
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
