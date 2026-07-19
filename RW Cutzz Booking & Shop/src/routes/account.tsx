import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { EmptyState } from "@/components/EmptyState";
import { StarRating } from "@/components/StarRating";
import {
  getAccountData,
  cancelBooking,
  cancelOrder,
  updateNotificationPrefs,
  updateCustomerPhone,
  deleteAccount,
  dutchError,
} from "@/lib/api/client";
import { euros, dutchDate, dutchDateShort } from "@/lib/format";
import { useMockAuth } from "@/lib/auth";

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [{ title: "Account — RW CUTZZ" }] }),
  component: Account,
});

function Account() {
  const { signedIn, signIn, signOut, sendMagicLink, hasBackend } = useMockAuth();

  return (
    <div className="min-h-screen bg-brand-bg">
      <SiteHeader />
      <section className="pt-28 pb-20 px-6 max-w-4xl mx-auto">
        {!signedIn ? <SignInBlock onDemo={signIn} onMagicLink={sendMagicLink} hasBackend={hasBackend} /> : <Dashboard onSignOut={signOut} />}
      </section>
      <SiteFooter />
    </div>
  );
}

function SignInBlock({ onDemo, onMagicLink, hasBackend }: { onDemo: () => void; onMagicLink: (email: string) => Promise<void>; hasBackend: boolean }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <div className="max-w-md mx-auto text-center">
      <h1 className="font-display text-4xl font-extrabold tracking-tighter mb-4">Inloggen</h1>
      <p className="text-brand-muted mb-8">
        We sturen je een magische link — geen wachtwoord nodig.
      </p>

      {sent ? (
        <p className="text-sm bg-brand-surface p-6 rounded border border-brand-text/10">
          Check je mail — we hebben een link gestuurd naar <strong>{email}</strong>.
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
              toast.error("Vul een geldig e-mailadres in.");
              return;
            }
            onMagicLink(email)
              .then(() => setSent(true))
              .catch(() => toast.error("Inloglink sturen lukte niet."));
          }}
          className="grid gap-3"
        >
          <input
            type="email"
            required
            placeholder="jij@voorbeeld.nl"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-brand-surface border border-brand-text/15 px-4 py-3 rounded text-sm focus:outline-none focus:border-brand-accent"
          />
          <button
            type="submit"
            className="bg-brand-accent text-white px-6 py-3 text-xs font-bold uppercase tracking-widest hover:glow-accent transition"
          >
            Stuur inloglink
          </button>
        </form>
      )}

      {!hasBackend && (
        <>
          <div className="my-6 text-xs text-brand-muted">— of —</div>
          <button
            onClick={onDemo}
            className="text-xs underline text-brand-muted hover:text-brand-accent"
          >
            Bekijk demo dashboard (mock)
          </button>
        </>
      )}
    </div>
  );
}

function Dashboard({ onSignOut }: { onSignOut: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["account"], queryFn: getAccountData });

  if (isLoading) {
    return (
      <div className="h-96 bg-brand-surface animate-pulse rounded flex items-center justify-center text-sm text-brand-muted">
        Accountgegevens laden...
      </div>
    );
  }

  if (!data?.customer) {
    return <EmptyState title="We konden je accountgegevens niet laden." />;
  }

  const {
    customer,
    upcoming_bookings = [],
    past_bookings = [],
    credit_cents = 0,
    orders = [],
    reviews = [],
    notification_prefs = {
      whatsapp_opt_in: false,
      marketing_email_opt_in: false,
    },
  } = data;

  const upcomingCount = upcoming_bookings?.length ?? 0;
  const pastCount = past_bookings?.length ?? 0;
  const orderCount = orders?.length ?? 0;
  const reviewCount = reviews?.length ?? 0;

  return (
    <div className="grid gap-10">
      <header className="flex justify-between items-start flex-wrap gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-brand-muted">Welkom terug</p>
          <h1 className="font-display text-4xl font-extrabold tracking-tighter">
            {customer.full_name}
          </h1>
          <p className="text-sm text-brand-muted mt-1">
            Je bent {customer.visit_count} keer geweest ✂️
          </p>
        </div>
        <button
          onClick={onSignOut}
          className="text-xs font-bold uppercase tracking-widest border border-brand-text/20 px-4 py-2 rounded"
        >
          Uitloggen
        </button>
      </header>

      {/* Upcoming */}
      <section>
        <h2 className="font-display text-2xl font-bold mb-4">Aankomende afspraken</h2>
        {upcomingCount === 0 ? (
          <EmptyState title="Geen aankomende afspraken." />
        ) : (
          <div className="grid gap-3">
            {upcoming_bookings.map((b) => (
              <div
                key={b.id}
                className="bg-brand-surface border border-brand-text/10 rounded p-5 flex flex-col md:flex-row justify-between gap-3"
              >
                <div>
                  <p className="font-display text-lg">{b.service_name}</p>
                  <p className="text-sm text-brand-muted">{dutchDate(b.starts_at)}</p>
                  <p className="text-xs text-brand-muted mt-1">
                    Nog te betalen in de zaak: {euros(b.remaining_cents)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => toast.info("Verzetten flow (demo)")}
                    className="border border-brand-text/20 px-3 py-2 text-[10px] font-bold uppercase tracking-widest"
                  >
                    Verzetten
                  </button>
                  <button
                    onClick={async () => {
                      const choice = confirm(
                        "Bewaren als tegoed? (OK = tegoed, Annuleren = terugbetaling aanvragen)",
                      );
                      try {
                        await cancelBooking({
                          booking_id: b.id,
                          action: choice ? "credit" : "refund",
                        });
                        toast.success(choice ? "Bewaard als tegoed" : "Terugbetaling aangevraagd");
                        qc.invalidateQueries({ queryKey: ["account"] });
                      } catch (e) {
                        toast.error(dutchError(e));
                      }
                    }}
                    className="border border-brand-text/20 px-3 py-2 text-[10px] font-bold uppercase tracking-widest"
                  >
                    Annuleren
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Credit */}
      {credit_cents > 0 && (
        <section className="bg-brand-accent text-white p-5 rounded">
          <p className="text-xs uppercase tracking-widest opacity-80">Tegoed</p>
          <p className="text-2xl font-bold font-display">{euros(credit_cents)}</p>
          <p className="text-xs opacity-80 mt-1">
            Dit wordt automatisch verrekend bij je volgende boeking of bestelling.
          </p>
        </section>
      )}

      {/* History */}
      <section>
        <h2 className="font-display text-2xl font-bold mb-4">Bezoekhistorie</h2>
        {pastCount === 0 ? (
          <EmptyState title="Nog geen bezoeken." />
        ) : (
          <ul className="divide-y divide-brand-text/10 border border-brand-text/10 rounded bg-brand-surface">
            {past_bookings.map((b) => (
              <li key={b.id} className="p-4 flex justify-between items-center gap-4">
                <div>
                  <p className="text-sm font-medium">{b.service_name}</p>
                  <p className="text-xs text-brand-muted">{dutchDateShort(b.starts_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-widest text-brand-muted">
                    {b.status === "completed" ? "Afgerond ✓" : b.status}
                  </span>
                  {b.status === "completed" && !b.has_review && (
                    <button
                      onClick={() => (window.location.href = `/review/${b.id}?token=demo`)}
                      className="text-[10px] font-bold uppercase tracking-widest text-brand-accent"
                    >
                      Review
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Orders */}
      <section>
        <h2 className="font-display text-2xl font-bold mb-4">Bestellingen</h2>
        {orderCount === 0 ? (
          <EmptyState title="Nog geen bestellingen." />
        ) : (
          <div className="grid gap-3">
            {orders.map((o) => (
              <div
                key={o.id}
                className="bg-brand-surface border border-brand-text/10 rounded p-4 flex justify-between items-center gap-3"
              >
                <div>
                  <p className="text-sm">{o.items_summary}</p>
                  <p className="text-xs text-brand-muted">
                    {dutchDateShort(o.created_at)} · {euros(o.total_cents)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-widest">
                    {o.status === "paid" && "Betaald"}
                    {o.status === "ready_for_pickup" && "Klaar voor afhalen 📦"}
                    {o.status === "picked_up" && "Opgehaald ✓"}
                    {o.status === "cancelled" && "Geannuleerd"}
                  </span>
                  {o.cancellable && (
                    <button
                      onClick={async () => {
                        if (!confirm("Bestelling annuleren?")) return;
                        try {
                          await cancelOrder({ order_id: o.id });
                          toast.success("Bestelling geannuleerd");
                          qc.invalidateQueries({ queryKey: ["account"] });
                        } catch (e) {
                          toast.error(dutchError(e));
                        }
                      }}
                      className="text-[10px] font-bold uppercase tracking-widest text-red-600"
                    >
                      Annuleer
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Reviews */}
      <section>
        <h2 className="font-display text-2xl font-bold mb-4">Mijn reviews</h2>
        {reviewCount === 0 ? (
          <EmptyState title="Nog geen reviews geschreven." />
        ) : (
          <div className="grid gap-3">
            {reviews.map((r, i) => (
              <div key={i} className="bg-brand-surface border border-brand-text/10 rounded p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium">{r.service_name}</p>
                    <StarRating value={r.rating} readOnly size={14} />
                  </div>
                  <span className="text-[10px] uppercase tracking-widest text-brand-muted">
                    {r.is_visible ? "Gepubliceerd ✓" : "In behandeling"}
                  </span>
                </div>
                <p className="text-sm text-brand-muted mt-2">{r.body}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Prefs */}
      <NotificationPrefs
        initial={notification_prefs}
        phone={customer.phone_e164}
        onUpdated={() => qc.invalidateQueries({ queryKey: ["account"] })}
      />

      <section>
        <button
          onClick={async () => {
            if (!confirm("Weet je het zeker? Je boekingshistorie wordt geanonimiseerd. Dit kan niet ongedaan worden gemaakt.")) return;
            try {
              await deleteAccount();
              toast.success("Account verwijderd");
              onSignOut();
              window.location.href = "/";
            } catch (e) {
              toast.error(dutchError(e));
            }
          }}
          className="text-xs text-red-600 underline"
        >
          Verwijder mijn gegevens
        </button>
      </section>
    </div>
  );
}

function NotificationPrefs({
  initial,
  phone,
  onUpdated,
}: {
  initial: { whatsapp_opt_in: boolean; marketing_email_opt_in: boolean };
  phone?: string;
  onUpdated: () => void;
}) {
  const [wa, setWa] = useState(initial.whatsapp_opt_in);
  const [mk, setMk] = useState(initial.marketing_email_opt_in);
  const [newPhone, setNewPhone] = useState("");

  async function save(next: { whatsapp_opt_in: boolean; marketing_email_opt_in: boolean }) {
    try {
      await updateNotificationPrefs(next);
      toast.success("Voorkeuren opgeslagen");
    } catch (e) {
      toast.error(dutchError(e));
    }
  }

  return (
    <section>
      <h2 className="font-display text-2xl font-bold mb-4">Notificatievoorkeuren</h2>
      <div className="bg-brand-surface border border-brand-text/10 rounded p-5 grid gap-4">
        {!phone && (
          <div className="grid gap-2">
            <label className="text-xs uppercase tracking-widest text-brand-muted">
              Telefoon voor WhatsApp
            </label>
            <div className="flex gap-2">
              <input
                type="tel"
                placeholder="+31612345678"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="flex-1 bg-brand-bg border border-brand-text/15 px-3 py-2 rounded text-sm"
              />
              <button
                onClick={async () => {
                  try {
                    await updateCustomerPhone({ phone_e164: newPhone });
                    toast.success("Telefoon opgeslagen");
                    onUpdated();
                  } catch (e) {
                    toast.error(dutchError(e));
                  }
                }}
                className="bg-brand-accent text-white px-4 py-2 text-xs font-bold uppercase tracking-widest"
              >
                Opslaan
              </button>
            </div>
          </div>
        )}
        <label
          className={`flex justify-between items-center ${
            phone ? "" : "opacity-60"
          }`}
          title={phone ? undefined : "Vul je telefoonnummer in"}
        >
          <span>WhatsApp-berichten</span>
          <input
            type="checkbox"
            disabled={!phone}
            checked={wa}
            onChange={(e) => {
              setWa(e.target.checked);
              save({ whatsapp_opt_in: e.target.checked, marketing_email_opt_in: mk });
            }}
          />
        </label>
        <label className="flex justify-between items-center">
          <span>Nieuwsbrief en aanbiedingen</span>
          <input
            type="checkbox"
            checked={mk}
            onChange={(e) => {
              setMk(e.target.checked);
              save({ whatsapp_opt_in: wa, marketing_email_opt_in: e.target.checked });
            }}
          />
        </label>
      </div>
    </section>
  );
}
