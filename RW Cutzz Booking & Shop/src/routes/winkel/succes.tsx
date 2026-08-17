import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { routeHead } from "@/seo/metadata";

export const Route = createFileRoute("/winkel/succes")({
  head: () =>
    routeHead({
      title: "Bestelling geplaatst | RW CUTZZ",
      description: "Je bestelling is geplaatst.",
      path: "/winkel/succes",
      robots: "noindex, follow",
    }),
  component: () => (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      <SiteHeader />
      <section className="pt-32 pb-20 px-6 text-center max-w-2xl mx-auto">
        <CheckCircle2 className="w-16 h-16 text-brand-accent mx-auto mb-4" />
        <h1 className="font-display text-4xl font-extrabold tracking-tighter mb-4">
          Bedankt voor je bestelling
        </h1>
        <p className="text-brand-muted mb-8">
          Je ontvangt bericht zodra je bestelling klaarligt om af te halen in de zaak.
        </p>
        <Link
          to="/winkel"
          className="bg-brand-accent text-white px-6 py-3 text-xs font-bold uppercase tracking-widest hover:glow-accent transition"
        >
          Verder shoppen
        </Link>
      </section>
      <SiteFooter />
    </div>
  ),
});
