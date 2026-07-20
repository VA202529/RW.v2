import { createFileRoute } from "@tanstack/react-router";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/cookies")({
  head: () => ({ meta: [{ title: "Cookiebeleid - RW CUTZZ" }] }),
  component: () => (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      <SiteHeader />
      <article className="flex-1 pt-28 pb-20 px-6 max-w-3xl mx-auto">
        <h1 className="font-display text-4xl font-extrabold tracking-tighter mb-8">
          Cookiebeleid
        </h1>

        <h2 className="font-display text-xl mt-6 mb-2">Wat zijn cookies?</h2>
        <p className="text-brand-muted">
          Cookies zijn kleine bestanden die je browser opslaat om een website goed te laten
          werken.
        </p>

        <h2 className="font-display text-xl mt-6 mb-2">Welke cookies gebruikt RWCUTZZ?</h2>
        <p className="text-brand-muted">
          RWCUTZZ gebruikt alleen functionele cookies en vergelijkbare lokale opslag die nodig
          zijn om de website te laten werken. Denk aan de Supabase sessie voor inloggen en het
          onthouden van noodzakelijke accountstatus.
        </p>

        <h2 className="font-display text-xl mt-6 mb-2">Geen tracking of advertenties</h2>
        <p className="text-brand-muted">
          Wij gebruiken geen trackingcookies en geen advertentiecookies.
        </p>

        <h2 className="font-display text-xl mt-6 mb-2">Bewaartermijn</h2>
        <p className="text-brand-muted">
          De sessiecookie blijft bewaard tot je uitlogt of maximaal 7 dagen, afhankelijk van je
          browser en sessiestatus.
        </p>

        <h2 className="font-display text-xl mt-6 mb-2">Cookies beheren</h2>
        <p className="text-brand-muted">
          Je kunt cookies verwijderen via de instellingen van je browser. Als je functionele
          cookies verwijdert, moet je mogelijk opnieuw inloggen.
        </p>

        <h2 className="font-display text-xl mt-6 mb-2">Taal</h2>
        <p className="text-brand-muted">Dit cookiebeleid is opgesteld in het Nederlands.</p>
      </article>
      <SiteFooter />
    </div>
  ),
});
