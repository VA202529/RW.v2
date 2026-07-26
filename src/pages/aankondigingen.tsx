import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { GenericBadge } from "@/components/status-badge";
import { announcements, type Announcement } from "@/lib/mock-data";
import { Megaphone, Plus, MessageSquare, Mail } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/aankondigingen")({
  head: () => ({
    meta: [
      { title: "Aankondigingen — BarberFlow" },
      {
        name: "description",
        content: "Stuur aankondigingen naar klanten via WhatsApp of e-mail.",
      },
      { property: "og:title", content: "Aankondigingen — BarberFlow" },
      { property: "og:description", content: "Communiceer met je klanten in één klik." },
    ],
  }),
  component: AankondigingenPage,
});

function AankondigingenPage() {
  const [items, setItems] = useState<Announcement[]>(announcements);
  const [selected, setSelected] = useState<Announcement | null>(announcements[0] ?? null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({
    title: "",
    message: "",
    channels: { whatsapp: true, email: false },
  });

  const send = () => {
    const ch: Announcement["channels"] = [];
    if (draft.channels.whatsapp) ch.push("whatsapp");
    if (draft.channels.email) ch.push("email");
    const a: Announcement = {
      id: `a${items.length + 1}`,
      title: draft.title || "Zonder titel",
      message: draft.message,
      date: new Date().toISOString().slice(0, 10),
      status: "sent",
      channels: ch,
    };
    setItems([a, ...items]);
    setSelected(a);
    setCreating(false);
    setDraft({ title: "", message: "", channels: { whatsapp: true, email: false } });
    toast.success("Aankondiging verstuurd");
  };

  return (
    <>
      <AppHeader title="Aankondigingen" large subtitle="Communiceer met klanten" />
      <PageHeader
        title="Aankondigingen"
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nieuwe aankondiging
          </Button>
        }
      />

      <div className="p-4 lg:p-8 grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-6">
        <div className="space-y-3">
          {items.map((a) => (
            <button
              key={a.id}
              onClick={() => {
                setSelected(a);
                setCreating(false);
              }}
              className={cn(
                "w-full text-left rounded-xl border p-4 transition-colors",
                selected?.id === a.id && !creating
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-primary/40",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{a.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {new Date(a.date).toLocaleDateString("nl-NL")}
                  </div>
                </div>
                {a.status === "sent" ? (
                  <GenericBadge tone="success">Verzonden</GenericBadge>
                ) : (
                  <GenericBadge tone="warning">Concept</GenericBadge>
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          {creating ? (
            <div className="space-y-4">
              <div className="text-sm font-semibold">Nieuwe aankondiging</div>
              <div className="grid gap-1.5">
                <Label>Titel</Label>
                <Input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="Bijv. Zomeractie 10%"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Bericht</Label>
                <Textarea
                  rows={5}
                  value={draft.message}
                  onChange={(e) => setDraft({ ...draft, message: e.target.value })}
                  placeholder="Typ je bericht..."
                />
              </div>
              <div className="grid gap-2">
                <Label>Verzenden naar</Label>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={draft.channels.whatsapp}
                      onCheckedChange={(v) =>
                        setDraft({
                          ...draft,
                          channels: { ...draft.channels, whatsapp: !!v },
                        })
                      }
                    />
                    <MessageSquare className="h-4 w-4" /> WhatsApp
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={draft.channels.email}
                      onCheckedChange={(v) =>
                        setDraft({
                          ...draft,
                          channels: { ...draft.channels, email: !!v },
                        })
                      }
                    />
                    <Mail className="h-4 w-4" /> E-mail
                  </label>
                </div>
              </div>

              <div className="rounded-md border border-dashed border-border p-4 bg-background/50">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
                  Preview
                </div>
                <div className="font-medium">{draft.title || "Titel"}</div>
                <div className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                  {draft.message || "Je bericht verschijnt hier..."}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setCreating(false)}>
                  Annuleren
                </Button>
                <Button onClick={send}>Verzenden</Button>
              </div>
            </div>
          ) : selected ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">{selected.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {new Date(selected.date).toLocaleDateString("nl-NL")}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selected.channels.includes("whatsapp") && (
                    <GenericBadge tone="info">
                      <MessageSquare className="h-3 w-3 mr-1" /> WhatsApp
                    </GenericBadge>
                  )}
                  {selected.channels.includes("email") && (
                    <GenericBadge tone="info">
                      <Mail className="h-3 w-3 mr-1" /> E-mail
                    </GenericBadge>
                  )}
                </div>
              </div>
              <div className="rounded-md border border-border p-4 text-sm whitespace-pre-wrap">
                {selected.message}
              </div>
            </div>
          ) : (
            <div className="text-center text-sm text-muted-foreground py-16">
              <Megaphone className="h-8 w-8 mx-auto mb-2 opacity-50" />
              Selecteer een aankondiging
            </div>
          )}
        </div>
      </div>
    </>
  );
}
