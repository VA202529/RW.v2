import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { PageHeader } from "@/components/page-header";
import { FAB } from "@/components/fab";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
} from "lucide-react";
import { bookings as initialBookings, type Booking } from "@/lib/mock-data";
import { ManualBookingDialog } from "@/components/manual-booking-dialog";
import { BookingDetailSheet } from "@/components/booking-detail-sheet";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

export const Route = createFileRoute("/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda — BarberFlow" },
      { name: "description", content: "Bekijk je afspraken per dag, week, maand of jaar." },
      { property: "og:title", content: "Agenda — BarberFlow" },
      { property: "og:description", content: "Dag-, week-, maand- en jaaragenda van al je afspraken." },
    ],
  }),
  component: AgendaPage,
});

type ViewMode = "dag" | "week" | "maand" | "jaar";

const DAYS = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];
const MONTHS = ["Jan", "Feb", "Mrt", "Apr", "Mei", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];
const HOURS = Array.from({ length: 12 }, (_, i) => 8 + i);
const TODAY = new Date("2026-07-21");

const statusAccent: Record<Booking["status"], string> = {
  confirmed: "border-l-primary bg-primary/5",
  pending: "border-l-warning bg-warning/5",
  cancelled: "border-l-destructive bg-destructive/5",
  completed: "border-l-muted-foreground bg-muted/20",
};
const statusLabel: Record<Booking["status"], string> = {
  confirmed: "Bevestigd",
  pending: "In afwachting",
  cancelled: "Geannuleerd",
  completed: "Voltooid",
};

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}
function fmtDay(d: Date) {
  return d.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" });
}
function fmtMonth(d: Date) {
  return d.toLocaleDateString("nl-NL", { month: "long", year: "numeric" });
}

function AgendaPage() {
  const isMobile = useIsMobile();
  const [view, setView] = useState<ViewMode>("dag");
  const initedView = useRef(false);
  useEffect(() => {
    if (!initedView.current && typeof isMobile === "boolean") {
      setView(isMobile ? "dag" : "week");
      initedView.current = true;
    }
  }, [isMobile]);

  const [day, setDay] = useState<Date>(new Date(TODAY));
  const [manualOpen, setManualOpen] = useState(false);
  const [items, setItems] = useState<Booking[]>(initialBookings);
  const [selected, setSelected] = useState<Booking | null>(null);

  const shift = (n: number) => {
    const d = new Date(day);
    if (view === "dag") d.setDate(d.getDate() + n);
    else if (view === "week") d.setDate(d.getDate() + n * 7);
    else if (view === "maand") d.setMonth(d.getMonth() + n);
    else d.setFullYear(d.getFullYear() + n);
    setDay(d);
  };

  const goToday = () => setDay(new Date(TODAY));
  const updateBooking = (b: Booking) =>
    setItems((prev) => prev.map((x) => (x.id === b.id ? b : x)));

  const rangeLabel = useMemo(() => {
    if (view === "dag") return fmtDay(day);
    if (view === "week") {
      const s = startOfWeek(day);
      const e = new Date(s);
      e.setDate(s.getDate() + 6);
      return `${s.getDate()} ${MONTHS[s.getMonth()]} — ${e.getDate()} ${MONTHS[e.getMonth()]} ${e.getFullYear()}`;
    }
    if (view === "maand") return fmtMonth(day);
    return `${day.getFullYear()}`;
  }, [view, day]);

  // swipe handling for mobile day view
  const touchStart = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => (touchStart.current = e.touches[0].clientX);
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStart.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStart.current;
    if (Math.abs(dx) > 60) shift(dx < 0 ? 1 : -1);
    touchStart.current = null;
  };

  return (
    <>
      <AppHeader
        title="Agenda"
        large
        subtitle={rangeLabel}
        action={
          <button
            onClick={goToday}
            className="h-9 px-3 rounded-full bg-primary/15 text-primary text-xs font-semibold press"
          >
            Vandaag
          </button>
        }
      />

      <PageHeader
        title="Agenda"
        description={rangeLabel}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={goToday}>
              Vandaag
            </Button>
            <div className="flex items-center rounded-md border border-border">
              <button className="p-2 hover:bg-accent" onClick={() => shift(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                className="p-2 hover:bg-accent border-l border-border"
                onClick={() => shift(1)}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <Button size="sm" onClick={() => setManualOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Handmatige boeking
            </Button>
          </>
        }
      />

      {/* View switcher */}
      <div className="px-4 md:px-6 lg:px-8 pt-3">
        <div className="inline-flex rounded-full bg-muted p-1 text-xs font-semibold">
          {(["Dag", "Week", "Maand", "Jaar"] as const).map((label) => {
            const v = label.toLowerCase() as ViewMode;
            const active = view === v;
            return (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "px-4 py-1.5 rounded-full press transition-colors",
                  active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile day nav strip (only in dag view) */}
      {view === "dag" && (
        <div className="md:hidden px-4 pt-3 flex items-center gap-2">
          <button
            onClick={() => shift(-1)}
            className="h-10 w-10 rounded-full bg-card border border-border grid place-items-center press"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 overflow-x-auto no-scrollbar">
            <div className="flex gap-2">
              {Array.from({ length: 7 }, (_, i) => {
                const d = new Date(startOfWeek(day));
                d.setDate(d.getDate() + i);
                const active = sameDay(d, day);
                return (
                  <button
                    key={i}
                    onClick={() => setDay(d)}
                    className={cn(
                      "shrink-0 h-14 w-12 rounded-2xl border flex flex-col items-center justify-center press",
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card border-border",
                    )}
                  >
                    <span className="text-[10px] font-medium uppercase opacity-70">{DAYS[i]}</span>
                    <span className="text-base font-bold">{d.getDate()}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <button
            onClick={() => shift(1)}
            className="h-10 w-10 rounded-full bg-card border border-border grid place-items-center press"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}

      <div
        className="animate-fade-in"
        onTouchStart={view === "dag" ? onTouchStart : undefined}
        onTouchEnd={view === "dag" ? onTouchEnd : undefined}
      >
        {view === "dag" && (
          <DayView day={day} items={items} onSelect={setSelected} />
        )}
        {view === "week" && (
          <WeekView day={day} items={items} onSelect={setSelected} />
        )}
        {view === "maand" && (
          <MonthView
            day={day}
            items={items}
            onPickDay={(d) => {
              setDay(d);
              setView("dag");
            }}
          />
        )}
        {view === "jaar" && (
          <YearView
            day={day}
            items={items}
            onPickMonth={(d) => {
              setDay(d);
              setView("maand");
            }}
          />
        )}
      </div>

      <FAB onClick={() => setManualOpen(true)} label="Nieuwe boeking" />
      <ManualBookingDialog open={manualOpen} onOpenChange={setManualOpen} />
      <BookingDetailSheet
        booking={selected}
        onOpenChange={(o) => !o && setSelected(null)}
        onUpdate={updateBooking}
      />
    </>
  );
}

/* ------------------------------ DAG VIEW ------------------------------ */
function DayView({
  day,
  items,
  onSelect,
}: {
  day: Date;
  items: Booking[];
  onSelect: (b: Booking) => void;
}) {
  const dayBookings = useMemo(
    () =>
      items
        .filter((b) => sameDay(new Date(b.start), day))
        .sort((a, b) => a.start.localeCompare(b.start)),
    [items, day],
  );

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-3 max-w-3xl">
      {dayBookings.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 grid place-items-center mx-auto mb-3">
            <CalendarIcon className="h-6 w-6 text-primary" />
          </div>
          <div className="text-sm font-semibold">Geen afspraken</div>
          <div className="text-xs text-muted-foreground mt-1">
            Rustige dag — tik + om er een toe te voegen.
          </div>
        </div>
      ) : (
        dayBookings.map((b) => {
          const t = new Date(b.start);
          const end = new Date(t.getTime() + b.durationMin * 60000);
          return (
            <button
              key={b.id}
              onClick={() => onSelect(b)}
              className={cn(
                "w-full text-left rounded-2xl border border-border bg-card p-4 border-l-4 press",
                statusAccent[b.status],
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-mono font-medium text-muted-foreground">
                    {t.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })} —{" "}
                    {end.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <div className="text-sm font-bold mt-1 truncate">{b.customerName}</div>
                  <div className="text-xs text-muted-foreground truncate">{b.serviceName}</div>
                </div>
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {statusLabel[b.status]}
                </span>
              </div>
            </button>
          );
        })
      )}
    </div>
  );
}

/* ------------------------------ WEEK VIEW ------------------------------ */
function WeekView({
  day,
  items,
  onSelect,
}: {
  day: Date;
  items: Booking[];
  onSelect: (b: Booking) => void;
}) {
  return (
    <div className="p-4 md:p-6 lg:p-8 overflow-x-auto">
      <div className="rounded-2xl border border-border bg-card overflow-hidden min-w-[720px]">
        <div className="grid grid-cols-[60px_repeat(7,minmax(0,1fr))] border-b border-border">
          <div className="p-3 text-[11px] text-muted-foreground uppercase tracking-wide">Uur</div>
          {Array.from({ length: 7 }, (_, i) => {
            const d = new Date(startOfWeek(day));
            d.setDate(d.getDate() + i);
            const today = sameDay(d, TODAY);
            return (
              <div
                key={i}
                className={cn("p-3 text-xs border-l border-border", today && "bg-primary/10")}
              >
                <div className="text-muted-foreground">{DAYS[i]}</div>
                <div className={cn("text-sm font-semibold", today && "text-primary")}>
                  {d.getDate()}
                </div>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-[60px_repeat(7,minmax(0,1fr))]">
          <div className="border-r border-border">
            {HOURS.map((h) => (
              <div
                key={h}
                className="h-16 px-2 py-1 text-[10px] text-muted-foreground text-right"
              >
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>
          {Array.from({ length: 7 }, (_, i) => {
            const d = new Date(startOfWeek(day));
            d.setDate(d.getDate() + i);
            return (
              <div key={i} className="border-l border-border relative">
                {HOURS.map((h) => (
                  <div key={h} className="h-16 border-b border-border/60" />
                ))}
                {items
                  .filter((b) => sameDay(new Date(b.start), d))
                  .map((b) => {
                    const bd = new Date(b.start);
                    const startMin = bd.getHours() * 60 + bd.getMinutes() - HOURS[0] * 60;
                    const top = (startMin / 60) * 64;
                    const height = (b.durationMin / 60) * 64;
                    return (
                      <button
                        key={b.id}
                        onClick={() => onSelect(b)}
                        style={{ top, height }}
                        className={cn(
                          "absolute left-1 right-1 rounded-lg border-l-4 border-y border-r p-1.5 text-[11px] overflow-hidden text-left press",
                          statusAccent[b.status],
                        )}
                      >
                        <div className="font-semibold truncate">{b.customerName}</div>
                        <div className="truncate opacity-80">{b.serviceName}</div>
                      </button>
                    );
                  })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ MAAND VIEW ------------------------------ */
function MonthView({
  day,
  items,
  onPickDay,
}: {
  day: Date;
  items: Booking[];
  onPickDay: (d: Date) => void;
}) {
  const first = startOfMonth(day);
  const startGrid = startOfWeek(first);
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(startGrid);
    d.setDate(startGrid.getDate() + i);
    return d;
  });

  const countByDay = useMemo(() => {
    const m = new Map<string, number>();
    items.forEach((b) => {
      const k = new Date(b.start).toDateString();
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return m;
  }, [items]);

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border">
          {DAYS.map((d) => (
            <div
              key={d}
              className="p-2 text-center text-[10px] uppercase tracking-wide text-muted-foreground font-semibold"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => {
            const inMonth = d.getMonth() === day.getMonth();
            const today = sameDay(d, TODAY);
            const count = countByDay.get(d.toDateString()) ?? 0;
            return (
              <button
                key={i}
                onClick={() => onPickDay(d)}
                className={cn(
                  "aspect-square border-r border-b border-border/60 p-1.5 flex flex-col items-start gap-1 text-left press",
                  !inMonth && "opacity-40",
                  today && "bg-primary/10",
                )}
              >
                <span
                  className={cn(
                    "text-xs font-semibold h-6 w-6 grid place-items-center rounded-full",
                    today && "bg-primary text-primary-foreground",
                  )}
                >
                  {d.getDate()}
                </span>
                {count > 0 && (
                  <span className="mt-auto text-[10px] font-semibold text-primary bg-primary/10 rounded px-1.5 py-0.5">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ JAAR VIEW ------------------------------ */
function YearView({
  day,
  items,
  onPickMonth,
}: {
  day: Date;
  items: Booking[];
  onPickMonth: (d: Date) => void;
}) {
  const year = day.getFullYear();
  const daysWithBookings = useMemo(() => {
    const s = new Set<string>();
    items.forEach((b) => {
      const d = new Date(b.start);
      if (d.getFullYear() === year) s.add(d.toDateString());
    });
    return s;
  }, [items, year]);

  return (
    <div className="p-4 md:p-6 lg:p-8 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 12 }, (_, m) => {
        const monthDate = new Date(year, m, 1);
        const startGrid = startOfWeek(monthDate);
        const cells = Array.from({ length: 42 }, (_, i) => {
          const d = new Date(startGrid);
          d.setDate(startGrid.getDate() + i);
          return d;
        });
        return (
          <button
            key={m}
            onClick={() => onPickMonth(monthDate)}
            className="rounded-2xl border border-border bg-card p-3 text-left press"
          >
            <div className="text-sm font-bold mb-2">{MONTHS[m]}</div>
            <div className="grid grid-cols-7 gap-0.5 text-[9px]">
              {DAYS.map((d) => (
                <div key={d} className="text-center text-muted-foreground">
                  {d[0]}
                </div>
              ))}
              {cells.map((d, i) => {
                const inMonth = d.getMonth() === m;
                const has = daysWithBookings.has(d.toDateString());
                const today = sameDay(d, TODAY);
                return (
                  <div
                    key={i}
                    className={cn(
                      "aspect-square grid place-items-center rounded relative",
                      !inMonth && "opacity-25",
                      today && "bg-primary text-primary-foreground font-bold",
                    )}
                  >
                    <span>{d.getDate()}</span>
                    {has && !today && (
                      <span className="absolute bottom-0 h-1 w-1 rounded-full bg-primary" />
                    )}
                  </div>
                );
              })}
            </div>
          </button>
        );
      })}
    </div>
  );
}
