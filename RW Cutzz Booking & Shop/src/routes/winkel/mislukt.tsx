import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createFileRoute("/winkel/mislukt")({
  head: () => ({ meta: [{ title: "Betaling mislukt — RW CUTZZ" }] }),
  component: () => (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      <SiteHeader />
      <section className="pt-32 pb-20 px-6 text-center max-w-2xl mx-auto">
        <AlertCircle className="w-16 h-16 text-brand-accent mx-auto mb-4" />
        <h1 className="font-display text-4xl font-extrabold tracking-tighter mb-4">
          Betaling mislukt
        </h1>
        <p className="text-brand-muted mb-8">
          Betaling mislukt of verlopen — je winkelwagen is bewaard.
        </p>
        <Link
          to="/winkel/checkout"
          className="bg-brand-accent text-white px-6 py-3 text-xs font-bold uppercase tracking-widest hover:glow-accent transition"
        >
          Opnieuw proberen
        </Link>
      </section>
      <SiteFooter />
    </div>
  ),
});
