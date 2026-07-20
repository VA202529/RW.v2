import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { unsubscribe } from "@/lib/api/client";

export const Route = createFileRoute("/uitschrijven")({
  validateSearch: (s: Record<string, unknown>) => ({
    token: typeof s.token === "string" ? s.token : undefined,
  }),
  head: () => ({ meta: [{ title: "Uitschrijven — RW CUTZZ" }] }),
  component: Unsub,
});

function Unsub() {
  const { token } = Route.useSearch();
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  useEffect(() => {
    if (!token) return setStatus("error");
    unsubscribe({ token })
      .then(() => setStatus("done"))
      .catch(() => setStatus("error"));
  }, [token]);
  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      <SiteHeader />
      <section className="pt-28 pb-20 px-6 max-w-2xl mx-auto text-center">
        <h1 className="font-display text-4xl font-extrabold tracking-tighter mb-4">
          Uitschrijven
        </h1>
        {status === "loading" && <p>Bezig...</p>}
        {status === "done" && (
          <p className="text-brand-muted">
            Je bent uitgeschreven voor onze nieuwsbrief. Je ontvangt geen marketingmails meer.
          </p>
        )}
        {status === "error" && (
          <p className="text-brand-muted">
            Kon je niet uitschrijven — ongeldige of verlopen link.
          </p>
        )}
        <Link
          to="/"
          className="inline-block mt-8 bg-brand-accent text-white px-6 py-3 text-xs font-bold uppercase tracking-widest hover:glow-accent transition"
        >
          Terug naar home
        </Link>
      </section>
      <SiteFooter />
    </div>
  );
}
