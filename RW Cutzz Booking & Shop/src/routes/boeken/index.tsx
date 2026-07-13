import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useReducer, useState } from "react";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { nl } from "date-fns/locale";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { GuestForm } from "@/components/GuestForm";
import { Countdown } from "@/components/Countdown";
import { EmptyState } from "@/components/EmptyState";
import {
  getServices,
  getSlots,
  createBookingHold,
  createCheckout,
  dutchError,
} from "@/lib/api/client";
import { euros, depositCents, dutchDate } from "@/lib/format";
import type { Guest } from "@/lib/api/types";

export const Route = createFileRoute("/boeken/")({
  validateSearch: (s: Record<string, unknown>) => ({
    service: typeof s.service === "string" ? s.service : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Boek een afspraak — RW CUTZZ" },
      { name: "description", content: "Boek online in vier stappen." },
    ],
  }),
  component: Boeken,
});

type State = {
  step: 1 | 2 | 3 | 4;
  service_id?: string;
  date: string; // yyyy-mm-dd
  slot?: string; // ISO
  guest?: Guest;
  turnstile?: string;
  booking_id?: string;
  expires_at?: string;
  deposit_cents?: number;
};

type Action =
  | { type: "set_service"; id: string }
  | { type: "next" }
  | { type: "back" }
  | { type: "set_date"; d: string }
  | { type: "set_slot"; s: string }
  | { type: "set_guest"; g: Guest; t: string }
  | { type: "hold"; booking_id: string; expires_at: string; deposit_cents: number };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "set_service":
      return { ...state, service_id: action.id };
    case "next":
      return { ...state, step: Math.min(4, state.step + 1) as State["step"] };
    case "back":
      return { ...state, step: Math.max(1, state.step - 1) as State["step"] };
    case "set_date":
      return { ...state, date: action.d, slot: undefined };
    case "set_slot":
      return { ...state, slot: action.s };
    case "set_guest":
      return { ...state, guest: action.g, turnstile: action.t };
    case "hold":
      return {
        ...state,
        booking_id: action.booking_id,
        expires_at: action.expires_at,
        deposit_cents: action.deposit_cents,
      };
  }
}

function Boeken() {
  const search = Route.useSearch();
  const nav = useNavigate();
  const { data: services = [] } = useQuery({ queryKey: ["services"], queryFn: getServices });

  const [state, dispatch] = useReducer(reducer, {
    step: 1,
    service_id: search.service,
    date: new Date().toISOString().slice(0, 10),
  });

  const selectedService = services.find((s) => s.id === state.service_id);

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text">
      <SiteHeader />
      <section className="pt-28 pb-20 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-brand-accent text-xs font-bold tracking-[0.3em] uppercase mb-3">
            Boeken
          </p>
          <h1 className="font-display text-4xl md:text-5xl font-extrabold tracking-tighter mb-8">
            Reserveer je stoel
          </h1>

          {/* Progress */}
          <ol className="grid grid-cols-4 gap-2 mb-10 text-[11px] uppercase tracking-widest">
            {["Dienst", "Datum & tijd", "Gegevens", "Betaling"].map((label, i) => {
              const active = state.step === (i + 1);
              const done = state.step > (i + 1);
              return (
                <li
                  key={label}
                  className={`px-3 py-3 border-l-2 ${
                    active
                      ? "border-brand-accent text-brand-accent font-bold"
                      : done
                        ? "border-brand-accent/60 text-brand-text/70"
                        : "border-brand-text/15 text-brand-muted"
                  }`}
                >
                  <span className="block text-[10px] mb-1">Stap {i + 1}</span>
                  {label}
                </li>
              );
            })}
          </ol>

          {state.step === 1 && (
            <Step1
              services={services}
              value={state.service_id}
              onSelect={(id) => dispatch({ type: "set_service", id })}
              onNext={() => dispatch({ type: "next" })}
            />
          )}
          {state.step === 2 && selectedService && (
            <Step2
              serviceId={selectedService.id}
              date={state.date}
              slot={state.slot}
              onDate={(d) => dispatch({ type: "set_date", d })}
              onSlot={(s) => dispatch({ type: "set_slot", s })}
              onBack={() => dispatch({ type: "back" })}
              onNext={() => dispatch({ type: "next" })}
            />
          )}
          {state.step === 3 && selectedService && state.slot && (
            <Step3
              onBack={() => dispatch({ type: "back" })}
              onSubmit={async (g, t) => {
                try {
                  const res = await createBookingHold({
                    service_id: selectedService.id,
                    starts_at: state.slot!,
                    guest: g,
                    turnstile_token: t,
                  });
                  const dep = depositCents(
                    selectedService.price_cents,
                    selectedService.deposit_type,
                    selectedService.deposit_value,
                  );
                  dispatch({ type: "set_guest", g, t });
                  dispatch({
                    type: "hold",
                    booking_id: res.booking_id,
                    expires_at: res.expires_at,
                    deposit_cents: dep,
                  });
                  dispatch({ type: "next" });
                } catch (e) {
                  toast.error(dutchError(e));
                }
              }}
            />
          )}
          {state.step === 4 && selectedService && state.booking_id && state.expires_at && (
            <Step4
              service={selectedService.name}
              slot={state.slot!}
              deposit_cents={state.deposit_cents!}
              price_cents={selectedService.price_cents}
              booking_id={state.booking_id}
              expires_at={state.expires_at}
              onExpire={() => nav({ to: "/boeken/verlopen" })}
              onConfirm={async () => {
                try {
                  const res = await createCheckout({ booking_id: state.booking_id! });
                  if (res.checkout_url) {
                    window.location.href = res.checkout_url;
                  } else {
                    nav({ to: "/boeken/succes" });
                  }
                } catch (e) {
                  toast.error(dutchError(e));
                }
              }}
            />
          )}
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}

function Step1({
  services,
  value,
  onSelect,
  onNext,
}: {
  services: Awaited<ReturnType<typeof getServices>>;
  value?: string;
  onSelect: (id: string) => void;
  onNext: () => void;
}) {
  return (
    <div className="grid gap-4">
      {services.map((s) => {
        const active = s.id === value;
        const dep = depositCents(s.price_cents, s.deposit_type, s.deposit_value);
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            className={`text-left p-5 border rounded transition ${
              active
                ? "border-brand-accent bg-brand-surface glow-accent"
                : "border-brand-text/10 bg-brand-surface hover:border-brand-accent/40"
            }`}
          >
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1">
                <h3 className="font-display text-xl">{s.name}</h3>
                <p className="text-sm text-brand-muted mt-1">{s.description}</p>
                <div className="mt-2 flex gap-2 flex-wrap">
                  <span className="text-[11px] bg-brand-bg px-2 py-1 rounded">
                    {s.duration_minutes} min
                  </span>
                  <span className="text-[11px] bg-brand-bg px-2 py-1 rounded">
                    Aanbetaling {euros(dep)}
                  </span>
                </div>
              </div>
              <p className="text-brand-accent font-bold font-display text-xl">
                {euros(s.price_cents)}
              </p>
            </div>
          </button>
        );
      })}
      <div className="flex justify-end pt-4">
        <button
          onClick={onNext}
          disabled={!value}
          className="bg-brand-accent text-white px-6 py-3 text-xs font-bold uppercase tracking-widest disabled:opacity-40 hover:glow-accent transition"
        >
          Volgende →
        </button>
      </div>
    </div>
  );
}

function Step2({
  serviceId,
  date,
  slot,
  onDate,
  onSlot,
  onBack,
  onNext,
}: {
  serviceId: string;
  date: string;
  slot?: string;
  onDate: (d: string) => void;
  onSlot: (s: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date(date);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const calendarCells = useMemo(() => {
    const first = new Date(monthCursor);
    // Monday = 0
    const offset = (first.getDay() + 6) % 7;
    const start = addDays(first, -offset);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [monthCursor]);

  const from = new Date(date);
  from.setHours(0, 0, 0, 0);
  const to = new Date(date);
  to.setHours(23, 59, 59, 999);

  const { data: slots = [], isLoading } = useQuery({
    queryKey: ["slots", serviceId, date],
    queryFn: () =>
      getSlots({ service_id: serviceId, from: from.toISOString(), to: to.toISOString() }),
  });

  const weekdays = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs uppercase tracking-widest text-brand-muted">Datum</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const d = new Date(monthCursor);
                d.setMonth(d.getMonth() - 1);
                setMonthCursor(d);
              }}
              className="w-8 h-8 border border-brand-text/10 rounded hover:border-brand-accent/40 transition"
              aria-label="Vorige maand"
            >
              ‹
            </button>
            <span className="text-sm font-medium capitalize min-w-[110px] text-center">
              {format(monthCursor, "MMMM yyyy", { locale: nl })}
            </span>
            <button
              type="button"
              onClick={() => {
                const d = new Date(monthCursor);
                d.setMonth(d.getMonth() + 1);
                setMonthCursor(d);
              }}
              className="w-8 h-8 border border-brand-text/10 rounded hover:border-brand-accent/40 transition"
              aria-label="Volgende maand"
            >
              ›
            </button>
          </div>
        </div>

        <div className="bg-brand-surface border border-brand-text/10 rounded p-3">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekdays.map((w) => (
              <div
                key={w}
                className="text-[10px] uppercase tracking-widest text-brand-muted text-center py-1"
              >
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((d) => {
              const key = d.toISOString().slice(0, 10);
              const active = key === date;
              const past = d < today;
              const otherMonth = d.getMonth() !== monthCursor.getMonth();
              return (
                <button
                  type="button"
                  key={key}
                  disabled={past}
                  onClick={() => onDate(key)}
                  className={`aspect-square flex items-center justify-center text-sm rounded border transition ${
                    active
                      ? "bg-brand-accent text-white border-brand-accent glow-accent font-bold"
                      : "border-transparent hover:border-brand-accent/40"
                  } ${past ? "opacity-25 cursor-not-allowed" : ""} ${
                    otherMonth && !active ? "text-brand-muted/50" : ""
                  }`}
                >
                  {format(d, "d")}
                </button>
              );
            })}
          </div>
        </div>
      </div>


      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs uppercase tracking-widest text-brand-muted">Tijd</p>
          {slot && (
            <span className="text-xs text-brand-muted">
              {format(new Date(date), "EEEE d MMMM", { locale: nl })}
            </span>
          )}
        </div>
        {isLoading ? (
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-11 bg-brand-surface animate-pulse rounded" />
            ))}
          </div>
        ) : slots.length === 0 ? (
          <EmptyState title="Geen beschikbare tijden op deze dag." />
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {slots.map((s) => {
              const active = s === slot;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSlot(s)}
                  className={`py-3 text-sm font-medium border rounded transition ${
                    active
                      ? "bg-brand-accent text-white border-brand-accent glow-accent"
                      : "bg-brand-surface border-brand-text/10 hover:border-brand-accent/40"
                  }`}
                >
                  {format(new Date(s), "HH:mm")}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex justify-between pt-4 md:col-span-2">

        <button onClick={onBack} className="text-xs font-bold uppercase tracking-widest">
          ← Terug
        </button>
        <button
          onClick={onNext}
          disabled={!slot}
          className="bg-brand-accent text-white px-6 py-3 text-xs font-bold uppercase tracking-widest disabled:opacity-40 hover:glow-accent transition"
        >
          Volgende →
        </button>
      </div>
    </div>
  );
}

function Step3({
  onBack,
  onSubmit,
}: {
  onBack: () => void;
  onSubmit: (g: Guest, t: string) => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  return (
    <div className="grid gap-6">
      <GuestForm
        submitLabel="Bevestig & betaal →"
        disabled={submitting}
        onSubmit={async (g, t) => {
          setSubmitting(true);
          await onSubmit(g, t);
          setSubmitting(false);
        }}
      />
      <p className="text-xs text-brand-muted">
        Kosteloos annuleren of verzetten tot 24 uur voor je afspraak. Daarna vervalt de
        aanbetaling.
      </p>
      <button onClick={onBack} className="text-xs font-bold uppercase tracking-widest text-left">
        ← Terug
      </button>
    </div>
  );
}

function Step4({
  service,
  slot,
  deposit_cents,
  price_cents,
  expires_at,
  onExpire,
  onConfirm,
}: {
  service: string;
  slot: string;
  deposit_cents: number;
  price_cents: number;
  booking_id: string;
  expires_at: string;
  onExpire: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  return (
    <div className="grid gap-6">
      <div className="bg-brand-surface border border-brand-text/10 rounded p-6">
        <p className="text-xs uppercase tracking-widest text-brand-muted mb-3">Samenvatting</p>
        <div className="grid gap-2 text-sm">
          <div className="flex justify-between">
            <span>Dienst</span>
            <span className="font-medium">{service}</span>
          </div>
          <div className="flex justify-between">
            <span>Datum &amp; tijd</span>
            <span className="font-medium">{dutchDate(slot)}</span>
          </div>
          <div className="flex justify-between">
            <span>Locatie</span>
            <span className="font-medium">RW CUTZZ, [ADRES]</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-brand-text/10">
            <span>Aanbetaling</span>
            <span className="font-bold text-brand-accent">{euros(deposit_cents)}</span>
          </div>
          <div className="flex justify-between text-brand-muted">
            <span>Nog te voldoen in de zaak</span>
            <span>{euros(price_cents - deposit_cents)}</span>
          </div>
        </div>
      </div>

      <div className="bg-brand-dark text-white p-4 rounded flex items-center justify-between">
        <span className="text-sm">⏱ Je tijdslot is gereserveerd — nog</span>
        <span className="text-brand-accent font-bold text-lg">
          <Countdown until={expires_at} onExpire={onExpire} />
        </span>
      </div>

      <button
        onClick={async () => {
          setLoading(true);
          await onConfirm();
          setLoading(false);
        }}
        disabled={loading}
        className="bg-brand-accent text-white px-8 py-4 text-xs font-bold uppercase tracking-widest hover:glow-accent-lg transition disabled:opacity-50"
      >
        {loading ? "Bezig..." : `Betaal aanbetaling ${euros(deposit_cents)}`}
      </button>

      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-brand-bg border-t border-brand-text/10 p-4 z-30">
        <button
          onClick={async () => {
            setLoading(true);
            await onConfirm();
            setLoading(false);
          }}
          disabled={loading}
          className="w-full bg-brand-accent text-white px-6 py-3 text-xs font-bold uppercase tracking-widest"
        >
          {loading ? "Bezig..." : `Betaal ${euros(deposit_cents)}`}
        </button>
      </div>

      <Link to="/boeken" className="text-xs text-brand-muted underline">
        Annuleer en begin opnieuw
      </Link>
    </div>
  );
}
