import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { services as initialServices, type Service } from "@/lib/mock-data";
import { Clock, Euro, Plus, Scissors } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/diensten")({
  head: () => ({
    meta: [
      { title: "Diensten — BarberFlow" },
      { name: "description", content: "Beheer je aangeboden diensten, prijzen en aanbetalingen." },
      { property: "og:title", content: "Diensten — BarberFlow" },
      { property: "og:description", content: "Alle knip- en baardbehandelingen van RW CUTZZ." },
    ],
  }),
  component: DienstenPage,
});

function DienstenPage() {
  const [services, setServices] = useState<Service[]>(initialServices);
  const [editing, setEditing] = useState<Service | null>(null);

  const openNew = () =>
    setEditing({
      id: "new",
      name: "",
      description: "",
      durationMin: 30,
      price: 25,
      depositType: "fixed",
      depositValue: 5,
      active: true,
    });

  const save = (s: Service) => {
    if (s.id === "new") {
      setServices([...services, { ...s, id: `s${services.length + 1}` }]);
      toast.success("Dienst toegevoegd");
    } else {
      setServices(services.map((x) => (x.id === s.id ? s : x)));
      toast.success("Dienst bijgewerkt");
    }
    setEditing(null);
  };

  return (
    <>
      <AppHeader title="Diensten" large subtitle="Beheer je services" />
      <PageHeader
        title="Diensten"
        description={`${services.length} diensten`}
        actions={
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" /> Dienst toevoegen
          </Button>
        }
      />

      <div className="p-4 lg:p-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {services.map((s) => (
            <div
              key={s.id}
              className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-md bg-primary/15 text-primary grid place-items-center shrink-0">
                    <Scissors className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{s.name}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {s.description}
                    </div>
                  </div>
                </div>
                <Switch
                  checked={s.active}
                  onCheckedChange={(v) => {
                    setServices(services.map((x) => (x.id === s.id ? { ...x, active: v } : x)));
                  }}
                />
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-md border border-border p-2">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3" /> Duur
                  </div>
                  <div className="font-medium mt-0.5">{s.durationMin} min</div>
                </div>
                <div className="rounded-md border border-border p-2">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Euro className="h-3 w-3" /> Prijs
                  </div>
                  <div className="font-medium mt-0.5">€{s.price}</div>
                </div>
                <div className="rounded-md border border-border p-2">
                  <div className="text-muted-foreground">Aanbet.</div>
                  <div className="font-medium mt-0.5">
                    {s.depositType === "fixed" ? `€${s.depositValue}` : `${s.depositValue}%`}
                  </div>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setEditing(s)}>
                Bewerken
              </Button>
            </div>
          ))}
        </div>
      </div>

      <ServiceEditor
        service={editing}
        onClose={() => setEditing(null)}
        onSave={save}
      />
    </>
  );
}

function ServiceEditor({
  service,
  onClose,
  onSave,
}: {
  service: Service | null;
  onClose: () => void;
  onSave: (s: Service) => void;
}) {
  const [form, setForm] = useState<Service | null>(service);

  if (service && (!form || form.id !== service.id)) {
    setForm(service);
  }

  return (
    <Dialog open={!!service} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {service?.id === "new" ? "Nieuwe dienst" : "Dienst bewerken"}
          </DialogTitle>
        </DialogHeader>
        {form && (
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label>Naam</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Beschrijving</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Duur (min)</Label>
                <Input
                  type="number"
                  value={form.durationMin}
                  onChange={(e) => setForm({ ...form, durationMin: Number(e.target.value) })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Prijs (€)</Label>
                <Input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Aanbetaling type</Label>
                <Select
                  value={form.depositType}
                  onValueChange={(v) =>
                    setForm({ ...form, depositType: v as Service["depositType"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Vast bedrag</SelectItem>
                    <SelectItem value="percentage">Percentage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Waarde</Label>
                <Input
                  type="number"
                  value={form.depositValue}
                  onChange={(e) => setForm({ ...form, depositValue: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <Label>Actief</Label>
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Annuleren
          </Button>
          <Button onClick={() => form && onSave(form)}>Opslaan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
