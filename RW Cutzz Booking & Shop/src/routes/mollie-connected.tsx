import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { routeHead } from "@/seo/metadata";

export const Route = createFileRoute("/mollie-connected")({
  head: () =>
    routeHead({
      title: "Mollie gekoppeld | RW CUTZZ",
      description: "Mollie is gekoppeld.",
      path: "/mollie-connected",
      robots: "noindex, follow",
    }),
  component: MollieConnected,
});

function MollieConnected() {
  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      <SiteHeader />
      <section className="flex-1 px-6 pt-32 pb-20">
        <div className="mx-auto max-w-2xl text-center">
          <CheckCircle2 className="mx-auto mb-5 h-16 w-16 text-brand-accent" />
          <h1 className="font-display text-4xl font-extrabold tracking-tight md:text-5xl">
            Mollie gekoppeld
          </h1>
          <p className="mt-5 text-lg text-brand-muted">
            Kapper succesvol gekoppeld aan BarberFlow. Je kunt nu aanbetalingen ontvangen.
          </p>
          <Link
            to="/boeken"
            className="mt-8 inline-flex items-center justify-center bg-brand-accent px-6 py-3 text-xs font-bold uppercase tracking-widest text-white transition hover:glow-accent"
          >
            Naar boeken
          </Link>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
