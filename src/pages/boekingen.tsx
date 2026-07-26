import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { PageHeader } from "@/components/page-header";
import { AvatarInitials } from "@/components/avatar-initials";
import { FilterChips } from "@/components/filter-chips";
import { StatusBadge } from "@/components/status-badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { bookings as ALL, type Booking, type BookingStatus } from "@/lib/mock-data";
import { Search, MoreHorizontal, Check, X, Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/boekingen")({
  head: () => ({
    meta: [
      { title: "Boekingen — BarberFlow" },
      { name: "description", content: "Alle boekingen filteren, annuleren of herplannen." },
      { property: "og:title", content: "Boekingen — BarberFlow" },
      { property: "og:description", content: "Overzicht van alle klantboekingen." },
    ],
  }),
  component: BoekingenPage,
});

const TODAY = new Date("2026-07-21");

function BoekingenPage() {
  const [search, setSearch] = useState("");
  const [chip, setChip] = useState("all");
  const [selected, setSelected] = useState<Booking | null>(null);

  const filtered = useMemo(() => {
    return ALL.filter((b) => {
      const bd = new Date(b.start);
      if (chip === "today" && bd.toDateString() !== TODAY.toDateString()) return false;
      if (chip === "pending" && b.status !== "pending") return false;
      if (chip === "confirmed" && b.status !== "confirmed") return false;
      if (search && !b.customerName.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [search, chip]);

  const chips = [
    { value: "all", label: "Alle", count: ALL.length },
    { value: "today", label: "Vandaag" },
    { value: "pending", label: "In afwachting" },
    { value: "confirmed", label: "Bevestigd" },
  ];

  return (
    <>
      {/* MOBILE */}
      <AppHeader title="Boekingen" large subtitle={`${filtered.length} boekingen`} />
      <div className="md:hidden">
        <div className="px-4 pb-2 space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Zoek een klant..."
              className="pl-10 h-11 rounded-full bg-card border-border"
            />
          </div>
          <FilterChips chips={chips} value={chip} onChange={setChip} />
        </div>

        <div className="p-4 space-y-3">
          {filtered.map((b) => {
            const t = new Date(b.start);
            return (
              <button
                key={b.id}
                onClick={() => setSelected(b)}
                className="w-full text-left rounded-2xl border border-border bg-card p-4 press flex items-center gap-3"
              >
                <AvatarInitials name={b.customerName} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold truncate">{b.customerName}</div>
                    <StatusBadge status={b.status} />
                  </div>
                  <div className="text-xs text-muted-foreground truncate mt-0.5">{b.serviceName}</div>
                  <div className="text-[11px] font-mono text-muted-foreground mt-1">
                    {t.toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}
                    {" · "}
                    {t.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="rounded-2xl border border-border bg-card p-10 text-center">
              <div className="text-sm font-semibold">Geen boekingen gevonden</div>
              <div className="text-xs text-muted-foreground mt-1">Probeer een ander filter.</div>
            </div>
          )}
        </div>
      </div>

      {/* TABLET + DESKTOP */}
      <div className="hidden md:block">
        <PageHeader title="Boekingen" description={`${filtered.length} boekingen gevonden`} />
        <div className="p-4 lg:p-8 space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Zoek op klantnaam..." className="pl-9" />
            </div>
            <FilterChips chips={chips} value={chip} onChange={setChip} className="!mx-0 !px-0 flex-1" />
          </div>

          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Klant</TableHead>
                  <TableHead>Dienst</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Tijd</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aanbetaling</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((b) => {
                  const t = new Date(b.start);
                  return (
                    <TableRow key={b.id} className="cursor-pointer" onClick={() => setSelected(b)}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2.5">
                          <AvatarInitials name={b.customerName} size="sm" />
                          {b.customerName}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{b.serviceName}</TableCell>
                      <TableCell className="text-muted-foreground">{t.toLocaleDateString("nl-NL")}</TableCell>
                      <TableCell className="font-mono text-xs">{t.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}</TableCell>
                      <TableCell><StatusBadge status={b.status} /></TableCell>
                      <TableCell>€{b.deposit}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger className="p-1 rounded hover:bg-accent">
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => toast.success("Boeking bevestigd")}>Bevestigen</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toast.success("Boeking verzet")}>Verzetten</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toast.success("Boeking geannuleerd")}>Annuleren</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Detail sheet (bottom on mobile, side on tablet+) */}
      <Sheet open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl border-border max-h-[85vh] overflow-y-auto md:!inset-y-0 md:!right-0 md:!left-auto md:!h-full md:!max-h-full md:!w-[420px] md:!rounded-none md:!border-l">
          {selected && (() => {
            const t = new Date(selected.start);
            return (
              <>
                <SheetHeader>
                  <SheetTitle>Boeking</SheetTitle>
                </SheetHeader>
                <div className="mt-4 space-y-5">
                  <div className="flex items-center gap-3">
                    <AvatarInitials name={selected.customerName} size="lg" />
                    <div>
                      <div className="text-base font-bold">{selected.customerName}</div>
                      <div className="text-xs text-muted-foreground">{selected.serviceName}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <InfoTile label="Datum" value={t.toLocaleDateString("nl-NL", { day: "numeric", month: "long" })} icon={<CalendarIcon className="h-3.5 w-3.5" />} />
                    <InfoTile label="Tijd" value={t.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })} />
                    <InfoTile label="Duur" value={`${selected.durationMin} min`} />
                    <InfoTile label="Aanbetaling" value={`€${selected.deposit}`} />
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-border p-3">
                    <span className="text-xs text-muted-foreground">Status</span>
                    <StatusBadge status={selected.status} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-2">
                    <Button variant="outline" onClick={() => { toast.success("Verzet"); setSelected(null); }}>Verzet</Button>
                    <Button variant="outline" onClick={() => { toast.success("Geannuleerd"); setSelected(null); }} className="text-destructive">
                      <X className="h-4 w-4 mr-1" /> Annuleer
                    </Button>
                    <Button onClick={() => { toast.success("Voltooid"); setSelected(null); }}>
                      <Check className="h-4 w-4 mr-1" /> Klaar
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>
    </>
  );
}

function InfoTile({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        {icon} {label}
      </div>
      <div className="text-sm font-semibold mt-1">{value}</div>
    </div>
  );
}
