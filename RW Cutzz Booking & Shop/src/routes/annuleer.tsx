import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { nl } from "date-fns/locale";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import {
  cancelBooking,
  dutchError,
  getBookingSummary,
  getSlots,
  rescheduleBooking,
} from "@/lib/api/client";
import { dutchDate, euros } from "@/lib/format";
import { routeHead } from "@/seo/metadata";

export const Route = createFileRoute("/annuleer")({
  validateSearch: (s: Record<string, unknown>) => ({
    token: typeof s.token === "string" ? s.token : undefined,
    booking: typeof s.booking === "string" ? s.booking : undefined,
  }),
  head: () =>
    routeHead({
      title: "Afspraak beheren | RW CUTZZ",
      description: "Beheer je afspraak bij RW CUTZZ.",
      path: "/annuleer",
      robots: "noindex, follow",
    }),
  component: ManageBookingPage,
});

function ManageBookingPage() {
  const { token, booking } = Route.useSearch();
  const [mode, setMode] = useState<"summary" | "reschedule" | "cancel">("summary");
  const [date, setDate] = useState(() => format(addDays(new Date(), 1), "yyyy-MM-dd"));
  const [slot, setSlot] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  const summaryQuery = useQuery({
    queryKey: ["manage-booking", booking, token],
    queryFn: () => getBookingSummary({ booking_id: booking!, cancellation_token: token }),
    enabled: Boolean(booking),
    retry: false,
  });

  const summary = summaryQuery.data;
  const slotsQuery = useQuery({
    queryKey: ["manage-slots", summary?.service_id, date, summary?.booking_id],
    queryFn: () =>
      getSlots({
        service_id: summary!.service_id,
        from: date,
        to: date,
        exclude_booking_id: summary!.booking_id,
      }),
    enabled: mode === "reschedule" && Boolean(summary?.service_id),
  });

  const stateText = useMemo(() => {
    if (!summary) return "";
    if (summary.already_cancelled) return "Deze afspraak is al geannuleerd.";
    if (summary.booking_status !== "confirmed") return "Deze afspraak kan niet online beheerd worden.";
    if (!summary.before_cancellation_deadline) {
      return "De 24-uursdeadline is verstreken. Neem contact op met RW CUTZZ voor wijzigingen.";
    }
    return "Je kunt deze afspraak nog verzetten of annuleren.";
  }, [summary]);

  async function submitReschedule() {
    if (!summary || !slot) return;
    setBusy(true);
    setMessage(undefined);
    try {
      const result = await rescheduleBooking({
        booking_id: summary.booking_id,
        new_starts_at: slot,
        cancellation_token: token,
      });
      setMessage(`Je afspraak is verzet naar ${dutchDate(result.starts_at ?? slot)}.`);
      setMode("summary");
      await summaryQuery.refetch();
    } catch (error) {
      toast.error(dutchError(error));
    } finally {
      setBusy(false);
    }
  }

  async function submitCancel() {
    if (!summary) return;
    setBusy(true);
    setMessage(undefined);
    try {
      const result = await cancelBooking({
        booking_id: summary.booking_id,
        action: "refund",
        cancellation_token: token,
      });
      const refundText =
        result.refund_status === "refunded"
          ? "De terugbetaling is gestart."
          : result.refund_status === "manual_required"
            ? "RW CUTZZ controleert de terugbetaling handmatig."
            : result.credited
              ? "De aanbetaling is als tegoed bewaard."
              : result.forfeited
                ? "De afspraak is geannuleerd; de aanbetaling valt buiten de kosteloze termijn."
                : "De afspraak is geannuleerd.";
      setMessage(refundText);
      setMode("summary");
      await summaryQuery.refetch();
    } catch (error) {
      toast.error(dutchError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-brand-bg text-brand-text flex flex-col">
      <SiteHeader />
      <main className="flex-1 px-5 pb-24 pt-28 sm:px-6 md:px-8">
        <section className="mx-auto grid w-full max-w-3xl gap-6">
          <div>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.25em] text-brand-accent">
              Afspraak beheren
            </p>
            <h1 className="font-display text-[clamp(2rem,8vw,3.75rem)] font-extrabold leading-none tracking-tight">
              Je afspraak
            </h1>
          </div>

          {!booking ? (
            <StateCard title="Ongeldige link" body="Deze beheerlink mist een afspraaknummer." />
          ) : summaryQuery.isLoading ? (
            <StateCard title="Afspraak laden" body="We halen je afspraak veilig op." />
          ) : summaryQuery.isError ? (
            <StateCard title="Link niet geldig" body="Deze link is ongeldig, verlopen of hoort niet bij deze afspraak." />
          ) : summary ? (
            <>
              {message && (
                <div className="rounded-lg border border-brand-accent/30 bg-brand-accent/10 p-4 text-sm">
                  {message}
                </div>
              )}

              <div className="rounded-xl border border-brand-text/10 bg-brand-surface p-5 shadow-xl sm:p-6">
                <div className="grid gap-4 text-sm sm:grid-cols-2">
                  <Info label="Dienst" value={summary.service_name} />
                  <Info label="Status" value={statusLabel(summary.booking_status)} />
                  <Info label="Datum en tijd" value={dutchDate(summary.starts_at)} />
                  <Info label="Duur" value={`${summary.duration_minutes} minuten`} />
                  <Info label="Aanbetaling" value={euros(summary.deposit_cents)} />
                  <Info label="Nog te voldoen" value={euros(summary.remaining_cents)} />
                </div>
                <p className="mt-5 rounded-lg bg-brand-bg p-4 text-sm text-brand-muted">{stateText}</p>
              </div>

              {summary.can_cancel || summary.can_reschedule ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setMode("reschedule")}
                    disabled={!summary.can_reschedule}
                    className="min-h-12 rounded bg-brand-accent px-5 py-3 text-xs font-bold uppercase tracking-widest text-white transition hover:glow-accent disabled:opacity-40"
                  >
                    Verzetten
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("cancel")}
                    disabled={!summary.can_cancel}
                    className="min-h-12 rounded border border-brand-text/20 px-5 py-3 text-xs font-bold uppercase tracking-widest transition hover:border-brand-accent disabled:opacity-40"
                  >
                    Afspraak annuleren
                  </button>
                </div>
              ) : null}

              {mode === "reschedule" && summary.can_reschedule && (
                <div className="rounded-xl border border-brand-text/10 bg-brand-surface p-5 sm:p-6">
                  <h2 className="font-display text-2xl font-bold">Nieuwe tijd kiezen</h2>
                  <label className="mt-5 grid gap-2 text-sm">
                    <span className="text-xs font-bold uppercase tracking-widest text-brand-muted">Datum</span>
                    <input
                      type="date"
                      min={format(new Date(), "yyyy-MM-dd")}
                      value={date}
                      onChange={(event) => {
                        setDate(event.target.value);
                        setSlot(undefined);
                      }}
                      className="min-h-12 rounded border border-brand-text/15 bg-brand-bg px-3"
                    />
                  </label>
                  <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {slotsQuery.isLoading ? (
                      <p className="col-span-full text-sm text-brand-muted">Beschikbare tijden laden...</p>
                    ) : (slotsQuery.data ?? []).length === 0 ? (
                      <p className="col-span-full text-sm text-brand-muted">Geen beschikbare tijden op deze dag.</p>
                    ) : (
                      slotsQuery.data!.map((candidate) => (
                        <button
                          key={candidate}
                          type="button"
                          onClick={() => setSlot(candidate)}
                          className={`min-h-11 rounded border px-3 py-2 text-sm font-medium ${
                            slot === candidate
                              ? "border-brand-accent bg-brand-accent text-white"
                              : "border-brand-text/10 bg-brand-bg"
                          }`}
                        >
                          {format(new Date(candidate), "HH:mm", { locale: nl })}
                        </button>
                      ))
                    )}
                  </div>
                  <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={submitReschedule}
                      disabled={!slot || busy}
                      className="min-h-12 rounded bg-brand-accent px-5 py-3 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-50"
                    >
                      {busy ? "Bezig..." : "Verzetten bevestigen"}
                    </button>
                    <button type="button" onClick={() => setMode("summary")} className="min-h-12 text-sm underline">
                      Terug
                    </button>
                  </div>
                </div>
              )}

              {mode === "cancel" && summary.can_cancel && (
                <div className="rounded-xl border border-brand-text/10 bg-brand-surface p-5 sm:p-6">
                  <h2 className="font-display text-2xl font-bold">Afspraak annuleren</h2>
                  <p className="mt-3 text-sm leading-relaxed text-brand-muted">
                    We annuleren je afspraak. Als er volgens de bestaande 24-uursregel een terugbetaling
                    nodig is, bevestigt de backend de status na verwerking.
                  </p>
                  <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={submitCancel}
                      disabled={busy}
                      className="min-h-12 rounded bg-brand-accent px-5 py-3 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-50"
                    >
                      {busy ? "Bezig..." : "Annuleren bevestigen"}
                    </button>
                    <button type="button" onClick={() => setMode("summary")} className="min-h-12 text-sm underline">
                      Terug
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">{label}</p>
      <p className="mt-1 break-words font-medium">{value}</p>
    </div>
  );
}

function StateCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-brand-text/10 bg-brand-surface p-6">
      <h2 className="font-display text-2xl font-bold">{title}</h2>
      <p className="mt-2 text-sm text-brand-muted">{body}</p>
    </div>
  );
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    pending_payment: "In afwachting van betaling",
    confirmed: "Bevestigd",
    completed: "Afgerond",
    cancelled: "Geannuleerd",
    no_show: "No-show",
    superseded: "Vervangen",
    refunded_conflict: "Refundcontrole nodig",
  };
  return labels[status] ?? status;
}
