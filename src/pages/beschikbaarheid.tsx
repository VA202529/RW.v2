import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { PageHeader } from "@/components/page-header";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  openingHours as initialHours,
  blockades as initialBlockades,
  dayOverrides as initialOverrides,
  type OpeningHour,
  type Blockade,
  type DayOverride,
} from "@/lib/mock-data";
import {
  Plus,
  Trash2,
  CalendarOff,
  Clock,
  Pencil,
  Plane,
  GraduationCap,
  User,
  CalendarX,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/beschikbaarheid")({
  head: () => ({
    meta: [
      { title: "Beschikbaarheid — BarberFlow" },
      { name: "description", content: "Beheer weekrooster, dag-overrides en blokkades in de agenda." },
      { property: "og:title", content: "Beschikbaarheid — BarberFlow" },
      { property: "og:description", content: "Weekrooster, dag-overrides en blokkades beheren." },
    ],
  }),
  component: BeschikbaarheidPage,
});

const DAY_LABELS: Record<OpeningHour["day"], string> = {
  Ma: "Maandag",
  Di: "Dinsdag",
  Wo: "Woensdag",
  Do: "Donderdag",
  Vr: "Vrijdag",
  Za: "Zaterdag",
  Zo: "Zondag",
};

const BLOCKADE_TYPES: {
  value: NonNullable<Blockade["type"]>;
  label: string;
  icon: typeof Plane;
  color: string;
}[] = [
  { value: "vakantie", label: "Vakantie", icon: Plane, color: "text-sky-400 bg-sky-500/10" },
  { value: "cursus", label: "Cursus", icon: GraduationCap, color: "text-violet-400 bg-violet-500/10" },
  { value: "prive", label: "Privé", icon: User, color: "text-amber-400 bg-amber-500/10" },
  { value: "overig", label: "Overig", icon: CalendarX, color: "text-muted-foreground bg-muted" },
];

function typeMeta(t?: Blockade["type"]) {
  return BLOCKADE_TYPES.find((x) => x.value === t) ?? BLOCKADE_TYPES[3];
}

function BeschikbaarheidPage() {
  const [hours, setHours] = useState<OpeningHour[]>(initialHours);
  const [blockades, setBlockades] = useState<Blockade[]>(initialBlockades);
  const [overrides, setOverrides] = useState<DayOverride[]>(initialOverrides);

  const [editingDay, setEditingDay] = useState<OpeningHour | null>(null);
  const [overrideOpen, setOverrideOpen] = useState<DayOverride | "new" | null>(null);
  const [blockOpen, setBlockOpen] = useState<Blockade | "new" | null>(null);
  const [deleteBlockade, setDeleteBlockade] = useState<Blockade | null>(null);
  const [deleteOverride, setDeleteOverride] = useState<DayOverride | null>(null);

  const sortedOverrides = useMemo(
    () => [...overrides].sort((a, b) => a.date.localeCompare(b.date)),
    [overrides],
  );
  const sortedBlockades = useMemo(
    () => [...blockades].sort((a, b) => a.start.localeCompare(b.start)),
    [blockades],
  );

  const updateDay = (patch: OpeningHour) => {
    setHours((h) => h.map((x) => (x.day === patch.day ? patch : x)));
  };

  const copyToAll = (from: OpeningHour) => {
    setHours((h) =>
      h.map((x) => ({
        ...x,
        opensAt: from.opensAt,
        closesAt: from.closesAt,
        maxBookings: from.maxBookings,
      })),
    );
    toast.success(`Tijden van ${DAY_LABELS[from.day]} toegepast op alle dagen`);
  };

  return (
    <>
      <AppHeader title="Beschikbaarheid" large subtitle="Weekrooster, overrides & blokkades" />
      <PageHeader
        title="Beschikbaarheid"
        description="Beheer je weekrooster, dag-overrides en blokkades"
      />

      <div className="p-4 lg:p-8 space-y-8 max-w-6xl mx-auto pb-24">
        {/* ============ WEEKROOSTER ============ */}
        <section>
          <div className="flex items-end justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold tracking-tight">Weekrooster</h2>
              <p className="text-xs text-muted-foreground">Standaard openingstijden per weekdag</p>
            </div>
          </div>

          <div className="-mx-4 lg:mx-0 overflow-x-auto pb-2 lg:overflow-visible">
            <div className="flex gap-3 px-4 lg:px-0 lg:grid lg:grid-cols-7 lg:gap-3">
              {hours.map((h) => (
                <button
                  key={h.day}
                  onClick={() => setEditingDay(h)}
                  className={cn(
                    "press text-left shrink-0 w-[160px] lg:w-auto rounded-2xl border p-4 transition-colors",
                    h.open
                      ? "border-border bg-card hover:border-primary/40"
                      : "border-border/60 bg-card/40 hover:border-border",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                      {h.day}
                    </div>
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        h.open ? "bg-primary" : "bg-muted-foreground/40",
                      )}
                    />
                  </div>
                  {h.open ? (
                    <>
                      <div className="mt-3 text-lg font-semibold tabular-nums leading-tight">
                        {h.opensAt}
                      </div>
                      <div className="text-xs text-muted-foreground tabular-nums">
                        tot {h.closesAt}
                      </div>
                      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-medium">
                          max {h.maxBookings}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="mt-3 text-sm font-medium text-muted-foreground">Gesloten</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ============ DAG-OVERRIDES ============ */}
        <section>
          <div className="flex items-end justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold tracking-tight">Dag-overrides</h2>
              <p className="text-xs text-muted-foreground">
                Afwijkende tijden voor specifieke datums
              </p>
            </div>
            <Button size="sm" onClick={() => setOverrideOpen("new")}>
              <Plus className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Override</span>
            </Button>
          </div>

          {sortedOverrides.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="Nog geen dag-overrides"
              description="Voeg afwijkende openingstijden toe voor een specifieke datum."
            />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {sortedOverrides.map((o) => {
                const d = new Date(o.date + "T00:00:00");
                return (
                  <div
                    key={o.id}
                    className="press rounded-xl border border-border bg-card p-4 flex items-center gap-3"
                    onClick={() => setOverrideOpen(o)}
                    role="button"
                  >
                    <div className="h-11 w-11 rounded-xl bg-muted grid place-items-center shrink-0">
                      <div className="text-center leading-none">
                        <div className="text-[9px] font-bold uppercase text-muted-foreground">
                          {d.toLocaleString("nl-NL", { month: "short" })}
                        </div>
                        <div className="text-base font-bold tabular-nums mt-0.5">{d.getDate()}</div>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate">
                        {d.toLocaleDateString("nl-NL", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                        })}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {o.closed ? (
                          <span className="text-destructive font-medium">Gesloten</span>
                        ) : (
                          <span className="tabular-nums">
                            {o.opensAt} – {o.closesAt}
                          </span>
                        )}
                        {o.note && ` · ${o.note}`}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteOverride(o);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ============ BLOKKADES ============ */}
        <section>
          <div className="flex items-end justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold tracking-tight">Blokkades</h2>
              <p className="text-xs text-muted-foreground">
                Periodes waarin klanten niet kunnen boeken
              </p>
            </div>
            <Button size="sm" onClick={() => setBlockOpen("new")}>
              <Plus className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Blokkade</span>
            </Button>
          </div>

          {sortedBlockades.length === 0 ? (
            <EmptyState
              icon={CalendarOff}
              title="Geen blokkades"
              description="Voeg vakanties, cursussen of privé-afspraken toe."
            />
          ) : (
            <div className="grid gap-2">
              {sortedBlockades.map((b) => {
                const meta = typeMeta(b.type);
                const Icon = meta.icon;
                const start = new Date(b.start);
                const end = new Date(b.end);
                const sameDay = start.toDateString() === end.toDateString();
                return (
                  <div
                    key={b.id}
                    className="press rounded-xl border border-border bg-card p-4 flex items-center gap-3"
                    onClick={() => setBlockOpen(b)}
                    role="button"
                  >
                    <div className={cn("h-11 w-11 rounded-xl grid place-items-center shrink-0", meta.color)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold truncate">{b.reason}</div>
                        {b.allDay && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                            Hele dag
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {sameDay
                          ? `${start.toLocaleDateString("nl-NL", { day: "numeric", month: "short" })} · ${start.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })} – ${end.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}`
                          : `${start.toLocaleDateString("nl-NL", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}`}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteBlockade(b);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ============ DAY EDIT SHEET ============ */}
      <DayEditSheet
        day={editingDay}
        onOpenChange={(o) => !o && setEditingDay(null)}
        onSave={(d) => {
          updateDay(d);
          setEditingDay(null);
          toast.success(`${DAY_LABELS[d.day]} bijgewerkt`);
        }}
        onCopyAll={(d) => {
          copyToAll(d);
          setEditingDay(null);
        }}
      />

      {/* ============ OVERRIDE SHEET ============ */}
      <OverrideSheet
        value={overrideOpen}
        onOpenChange={(o) => !o && setOverrideOpen(null)}
        onSave={(o) => {
          setOverrides((prev) => {
            const exists = prev.some((x) => x.id === o.id);
            return exists ? prev.map((x) => (x.id === o.id ? o : x)) : [...prev, o];
          });
          setOverrideOpen(null);
          toast.success("Override opgeslagen");
        }}
      />

      {/* ============ BLOCKADE SHEET ============ */}
      <BlockadeSheet
        value={blockOpen}
        onOpenChange={(o) => !o && setBlockOpen(null)}
        onSave={(b) => {
          setBlockades((prev) => {
            const exists = prev.some((x) => x.id === b.id);
            return exists ? prev.map((x) => (x.id === b.id ? b : x)) : [...prev, b];
          });
          setBlockOpen(null);
          toast.success("Blokkade opgeslagen");
        }}
      />

      {/* ============ CONFIRM DIALOGS ============ */}
      <AlertDialog open={!!deleteBlockade} onOpenChange={(o) => !o && setDeleteBlockade(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Blokkade verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteBlockade?.reason}" wordt permanent verwijderd.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteBlockade) {
                  setBlockades((prev) => prev.filter((x) => x.id !== deleteBlockade.id));
                  toast.success("Blokkade verwijderd");
                }
                setDeleteBlockade(null);
              }}
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteOverride} onOpenChange={(o) => !o && setDeleteOverride(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Override verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              De standaard openingstijden gelden weer voor deze dag.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteOverride) {
                  setOverrides((prev) => prev.filter((x) => x.id !== deleteOverride.id));
                  toast.success("Override verwijderd");
                }
                setDeleteOverride(null);
              }}
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* -------- Day Edit Sheet -------- */
function DayEditSheet({
  day,
  onOpenChange,
  onSave,
  onCopyAll,
}: {
  day: OpeningHour | null;
  onOpenChange: (o: boolean) => void;
  onSave: (d: OpeningHour) => void;
  onCopyAll: (d: OpeningHour) => void;
}) {
  const [draft, setDraft] = useState<OpeningHour | null>(null);
  const active = day && (draft?.day === day.day ? draft : day);

  return (
    <Sheet
      open={!!day}
      onOpenChange={(o) => {
        if (o && day) setDraft({ ...day });
        onOpenChange(o);
      }}
    >
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh]">
        <SheetHeader>
          <SheetTitle>{active ? DAY_LABELS[active.day] : ""}</SheetTitle>
        </SheetHeader>
        {active && (
          <div className="grid gap-5 py-4">
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <div className="text-sm font-medium">Geopend</div>
                <div className="text-xs text-muted-foreground">
                  Klanten kunnen boeken op deze dag
                </div>
              </div>
              <Switch
                checked={active.open}
                onCheckedChange={(v) => setDraft({ ...active, open: v })}
              />
            </div>

            <div className={cn("grid grid-cols-2 gap-3", !active.open && "opacity-50 pointer-events-none")}>
              <div className="grid gap-1.5">
                <Label>Open om</Label>
                <Input
                  type="time"
                  value={active.opensAt}
                  onChange={(e) => setDraft({ ...active, opensAt: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Sluit om</Label>
                <Input
                  type="time"
                  value={active.closesAt}
                  onChange={(e) => setDraft({ ...active, closesAt: e.target.value })}
                />
              </div>
            </div>

            <div className={cn("grid gap-1.5", !active.open && "opacity-50 pointer-events-none")}>
              <Label>Max boekingen per dag</Label>
              <Input
                type="number"
                min={1}
                value={active.maxBookings}
                onChange={(e) =>
                  setDraft({ ...active, maxBookings: parseInt(e.target.value) || 0 })
                }
              />
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => onCopyAll(active)}
            >
              <Copy className="h-4 w-4 mr-2" />
              Toepassen op alle dagen
            </Button>
          </div>
        )}
        <SheetFooter className="flex-row gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => onOpenChange(false)}>
            Annuleren
          </Button>
          <Button className="flex-1" onClick={() => active && onSave(active)}>
            Opslaan
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/* -------- Override Sheet -------- */
function OverrideSheet({
  value,
  onOpenChange,
  onSave,
}: {
  value: DayOverride | "new" | null;
  onOpenChange: (o: boolean) => void;
  onSave: (o: DayOverride) => void;
}) {
  const isNew = value === "new";
  const initial: DayOverride =
    value && value !== "new"
      ? value
      : {
          id: `do${Date.now()}`,
          date: new Date().toISOString().slice(0, 10),
          closed: false,
          opensAt: "10:00",
          closesAt: "16:00",
          note: "",
        };
  const [draft, setDraft] = useState<DayOverride>(initial);

  return (
    <Sheet
      open={!!value}
      onOpenChange={(o) => {
        if (o) setDraft(initial);
        onOpenChange(o);
      }}
    >
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh]">
        <SheetHeader>
          <SheetTitle>{isNew ? "Nieuwe dag-override" : "Override bewerken"}</SheetTitle>
        </SheetHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-1.5">
            <Label>Datum</Label>
            <Input
              type="date"
              value={draft.date}
              onChange={(e) => setDraft({ ...draft, date: e.target.value })}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <div className="text-sm font-medium">Gesloten deze dag</div>
              <div className="text-xs text-muted-foreground">Geen boekingen mogelijk</div>
            </div>
            <Switch
              checked={draft.closed}
              onCheckedChange={(v) => setDraft({ ...draft, closed: v })}
            />
          </div>

          {!draft.closed && (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Open om</Label>
                <Input
                  type="time"
                  value={draft.opensAt ?? ""}
                  onChange={(e) => setDraft({ ...draft, opensAt: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Sluit om</Label>
                <Input
                  type="time"
                  value={draft.closesAt ?? ""}
                  onChange={(e) => setDraft({ ...draft, closesAt: e.target.value })}
                />
              </div>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label>Notitie (optioneel)</Label>
            <Input
              value={draft.note ?? ""}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              placeholder="Bijv. Feestdag, korte dag..."
            />
          </div>
        </div>
        <SheetFooter className="flex-row gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => onOpenChange(false)}>
            Annuleren
          </Button>
          <Button className="flex-1" onClick={() => onSave(draft)}>
            Opslaan
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/* -------- Blockade Sheet -------- */
function BlockadeSheet({
  value,
  onOpenChange,
  onSave,
}: {
  value: Blockade | "new" | null;
  onOpenChange: (o: boolean) => void;
  onSave: (b: Blockade) => void;
}) {
  const isNew = value === "new";
  const nowIso = new Date().toISOString().slice(0, 16);
  const initial: Blockade =
    value && value !== "new"
      ? value
      : {
          id: `bl${Date.now()}`,
          reason: "",
          start: nowIso,
          end: nowIso,
          allDay: false,
          type: "vakantie",
        };
  const [draft, setDraft] = useState<Blockade>(initial);

  const toInputVal = (iso: string) => iso.slice(0, 16);
  const toDateOnly = (iso: string) => iso.slice(0, 10);

  return (
    <Sheet
      open={!!value}
      onOpenChange={(o) => {
        if (o) setDraft(initial);
        onOpenChange(o);
      }}
    >
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isNew ? "Nieuwe blokkade" : "Blokkade bewerken"}</SheetTitle>
        </SheetHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-1.5">
            <Label>Reden</Label>
            <Input
              value={draft.reason}
              onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
              placeholder="Bijv. Zomervakantie"
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Type</Label>
            <Select
              value={draft.type ?? "overig"}
              onValueChange={(v) => setDraft({ ...draft, type: v as Blockade["type"] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BLOCKADE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <div className="text-sm font-medium">Hele dag(en)</div>
              <div className="text-xs text-muted-foreground">Blokkeer volledige datums</div>
            </div>
            <Switch
              checked={!!draft.allDay}
              onCheckedChange={(v) => setDraft({ ...draft, allDay: v })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Start</Label>
              <Input
                type={draft.allDay ? "date" : "datetime-local"}
                value={draft.allDay ? toDateOnly(draft.start) : toInputVal(draft.start)}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    start: draft.allDay ? `${e.target.value}T00:00:00` : `${e.target.value}:00`,
                  })
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Einde</Label>
              <Input
                type={draft.allDay ? "date" : "datetime-local"}
                value={draft.allDay ? toDateOnly(draft.end) : toInputVal(draft.end)}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    end: draft.allDay ? `${e.target.value}T23:59:00` : `${e.target.value}:00`,
                  })
                }
              />
            </div>
          </div>
        </div>
        <SheetFooter className="flex-row gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => onOpenChange(false)}>
            Annuleren
          </Button>
          <Button
            className="flex-1"
            disabled={!draft.reason.trim()}
            onClick={() => onSave(draft)}
          >
            Opslaan
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
