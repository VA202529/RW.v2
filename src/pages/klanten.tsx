import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { PageHeader } from "@/components/page-header";
import { AvatarInitials } from "@/components/avatar-initials";
import { Input } from "@/components/ui/input";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { customers, type Customer } from "@/lib/mock-data";
import { GenericBadge } from "@/components/status-badge";
import { Search, Mail, Phone, Ban, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/klanten")({
  head: () => ({
    meta: [
      { title: "Klanten — BarberFlow" },
      { name: "description", content: "Beheer klantgegevens, historie en blokkeringen." },
      { property: "og:title", content: "Klanten — BarberFlow" },
      { property: "og:description", content: "Alle klanten van RW CUTZZ op één plek." },
    ],
  }),
  component: KlantenPage,
});

function KlantenPage() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Customer | null>(null);

  const filtered = useMemo(
    () =>
      customers.filter((c) =>
        (c.name + c.email).toLowerCase().includes(search.toLowerCase()),
      ),
    [search],
  );

  return (
    <>
      {/* MOBILE */}
      <AppHeader title="Klanten" large subtitle={`${filtered.length} klanten`} />
      <div className="md:hidden">
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Zoek klant..."
              className="pl-10 h-11 rounded-full bg-card border-border"
            />
          </div>
        </div>
        <div className="px-4 space-y-2">
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelected(c)}
              className="w-full rounded-2xl border border-border bg-card p-3 flex items-center gap-3 press"
            >
              <AvatarInitials name={c.name} />
              <div className="flex-1 min-w-0 text-left">
                <div className="text-sm font-semibold truncate">{c.name}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {c.visits} bezoeken · laatst {new Date(c.lastVisit).toLocaleDateString("nl-NL")}
                </div>
              </div>
              {c.blocked && <GenericBadge tone="danger">Geblokkeerd</GenericBadge>}
            </button>
          ))}
        </div>
      </div>

      {/* TABLET + DESKTOP */}
      <div className="hidden md:block">
        <PageHeader title="Klanten" description={`${filtered.length} klanten`} />
        <div className="p-4 lg:p-8 space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Zoek op naam of e-mail..." className="pl-9" />
          </div>
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Naam</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Telefoon</TableHead>
                  <TableHead>Bezoeken</TableHead>
                  <TableHead>Laatste</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => setSelected(c)}>
                    <TableCell>
                      <div className="flex items-center gap-2.5 font-medium">
                        <AvatarInitials name={c.name} size="sm" /> {c.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.email}</TableCell>
                    <TableCell className="text-muted-foreground">{c.phone}</TableCell>
                    <TableCell>{c.visits}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(c.lastVisit).toLocaleDateString("nl-NL")}</TableCell>
                    <TableCell>
                      {c.blocked ? <GenericBadge tone="danger">Geblokkeerd</GenericBadge> : <GenericBadge tone="success">Actief</GenericBadge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <Sheet open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[90vh] overflow-y-auto md:!inset-y-0 md:!right-0 md:!left-auto md:!h-full md:!max-h-full md:!w-[420px] md:!rounded-none md:!border-l">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.name}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-5">
                <div className="flex items-center gap-4">
                  <AvatarInitials name={selected.name} size="lg" />
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="flex items-center gap-2"><Mail className="h-3 w-3" /> {selected.email}</div>
                    <div className="flex items-center gap-2"><Phone className="h-3 w-3" /> {selected.phone}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <a href={`tel:${selected.phone}`} className="rounded-xl border border-border p-3 flex items-center justify-center gap-2 text-sm press">
                    <Phone className="h-4 w-4 text-primary" /> Bellen
                  </a>
                  <a href={`https://wa.me/${selected.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="rounded-xl border border-border p-3 flex items-center justify-center gap-2 text-sm press">
                    <MessageCircle className="h-4 w-4 text-success" /> WhatsApp
                  </a>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Bezoeken</div>
                    <div className="text-lg font-bold">{selected.visits}</div>
                  </div>
                  <div className="rounded-xl border border-border p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Laatste</div>
                    <div className="text-lg font-bold">{new Date(selected.lastVisit).toLocaleDateString("nl-NL")}</div>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground mb-2">Historie</div>
                  <ul className="space-y-2 text-sm">
                    {[1, 2, 3].map((i) => (
                      <li key={i} className="rounded-xl border border-border p-3 flex justify-between">
                        <span>Classic Cut</span>
                        <span className="text-muted-foreground text-xs">
                          {new Date(Date.now() - i * 21 * 86400000).toLocaleDateString("nl-NL")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground mb-2">Interne notities</div>
                  <Textarea defaultValue={selected.notes} rows={3} />
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Ban className="h-4 w-4 text-destructive" /> Klant blokkeren
                  </div>
                  <Switch defaultChecked={selected.blocked} onCheckedChange={(v) => toast.success(v ? "Geblokkeerd" : "Blokkering opgeheven")} />
                </div>

                <Button className="w-full" onClick={() => setSelected(null)}>Sluiten</Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
