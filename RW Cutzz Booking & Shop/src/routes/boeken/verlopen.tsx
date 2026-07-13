import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createFileRoute("/boeken/verlopen")({
  head: () => ({ meta: [{ title: "Reservering verlopen — RW CUTZZ" }] }),
  component: Expired,
});

function Expired() {
  return (
    <div className="min-h-screen bg-brand-bg">
      <SiteHeader />
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <AlertCircle className="w-16 h-16 text-brand-accent mx-auto mb-4" />
          <h1 className="font-display text-4xl md:text-5xl font-extrabold tracking-tighter mb-4">
            Reservering verlopen
          </h1>
          <p className="text-brand-muted mb-8">
            Je reservering is verlopen — het tijdslot is weer vrijgegeven.
          </p>
          <Link
            to="/boeken"
            className="bg-brand-accent text-white px-6 py-3 text-xs font-bold uppercase tracking-widest hover:glow-accent transition"
          >
            Probeer opnieuw
          </Link>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
