import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { cancelBooking, dutchError } from "@/lib/api/client";

export const Route = createFileRoute("/annuleer")({
  validateSearch: (s: Record<string, unknown>) => ({
    token: typeof s.token === "string" ? s.token : undefined,
    booking: typeof s.booking === "string" ? s.booking : undefined,
  }),
  head: () => ({ meta: [{ title: "Afspraak annuleren — RW CUTZZ" }] }),
  component: Annuleer,
});

function Annuleer() {
  const { token, booking } = Route.useSearch();
  const [done, setDone] = useState<null | string>(null);

  async function go(action: "credit" | "refund") {
    if (!booking) return toast.error("Ongeldige link.");
    try {
      await cancelBooking({
        booking_id: booking,
        action,
        cancellation_token: token,
      });
      setDone(action === "credit" ? "Bewaard als tegoed." : "Terugbetaling aangevraagd.");
    } catch (e) {
      toast.error(dutchError(e));
    }
  }

  return (
    <div className="min-h-screen bg-brand-bg">
      <SiteHeader />
      <section className="pt-28 pb-20 px-6 max-w-2xl mx-auto">
        <h1 className="font-display text-4xl font-extrabold tracking-tighter mb-4">
          Afspraak annuleren
        </h1>
        {done ? (
          <p className="text-sm bg-brand-surface p-6 rounded border border-brand-text/10">
            {done}
          </p>
        ) : (
          <div className="grid gap-3">
            <p className="text-brand-muted mb-2">Kies wat je met de aanbetaling wil doen:</p>
            <button
              onClick={() => go("credit")}
              className="bg-brand-accent text-white px-6 py-3 text-xs font-bold uppercase tracking-widest hover:glow-accent transition"
            >
              Bewaar als tegoed
            </button>
            <button
              onClick={() => go("refund")}
              className="border border-brand-text/20 px-6 py-3 text-xs font-bold uppercase tracking-widest"
            >
              Terugbetaling aanvragen
            </button>
          </div>
        )}
      </section>
      <SiteFooter />
    </div>
  );
}
