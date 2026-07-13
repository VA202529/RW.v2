import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createFileRoute("/voorwaarden")({
  head: () => ({ meta: [{ title: "Algemene voorwaarden — RW CUTZZ" }] }),
  component: () => (
    <div className="min-h-screen bg-brand-bg">
      <SiteHeader />
      <article className="pt-28 pb-20 px-6 max-w-3xl mx-auto">
        <h1 className="font-display text-4xl font-extrabold tracking-tighter mb-8">
          Algemene voorwaarden
        </h1>

        <h2 className="font-display text-xl mt-6 mb-2">Artikel 1 · Algemeen</h2>
        <p className="text-brand-muted">
          Deze algemene voorwaarden zijn van toepassing op alle diensten en overeenkomsten van
          [BEDRIJFSNAAM], ingeschreven bij de Kamer van Koophandel onder nummer [KVK-NUMMER],
          gevestigd te [ADRES].
        </p>

        <h2 className="font-display text-xl mt-6 mb-2">
          Artikel 2 · Afspraken maken en aanbetaling
        </h2>
        <p className="text-brand-muted">
          Bij het maken van een online afspraak is een aanbetaling verplicht. Deze aanbetaling is
          een vast bedrag of een percentage van de dienstprijs en wordt duidelijk getoond bij het
          boeken.
        </p>

        <h2 className="font-display text-xl mt-6 mb-2">Artikel 3 · Annulering en verzetten</h2>
        <p className="text-brand-muted">
          Kosteloos annuleren of verzetten tot 24 uur voor aanvang van de afspraak. Bij annulering
          binnen 24 uur vervalt de aanbetaling. Bij een no-show vervalt de aanbetaling eveneens.
        </p>

        <h2 className="font-display text-xl mt-6 mb-2">Artikel 4 · Webshop en bestellingen</h2>
        <p className="text-brand-muted">
          Bestellingen via de webshop worden afgehaald in de zaak. Betaling verloopt via iDEAL.
        </p>

        <h2 className="font-display text-xl mt-6 mb-2">Artikel 5 · Herroepingsrecht</h2>
        <p className="text-brand-muted">
          Je hebt het recht om binnen 14 dagen na ontvangst je bestelling te retourneren.
          Uitzondering: verzegelde cosmetica en verzorgingsproducten waarvan de verzegeling is
          verbroken. Op afspraken met een vaste datum en tijd bestaat geen herroepingsrecht.
        </p>

        <h2 className="font-display text-xl mt-6 mb-2">Artikel 6 · Prijzen</h2>
        <p className="text-brand-muted">Alle prijzen zijn inclusief BTW.</p>

        <h2 className="font-display text-xl mt-6 mb-2">Artikel 7 · Klachten</h2>
        <p className="text-brand-muted">
          Klachten kunnen ingediend worden via e-mail naar [CONTACT-EMAIL]. Wij reageren binnen
          14 dagen.
        </p>

        <h2 className="font-display text-xl mt-6 mb-2">Artikel 8 · Toepasselijk recht</h2>
        <p className="text-brand-muted">Op deze voorwaarden is Nederlands recht van toepassing.</p>
      </article>
      <SiteFooter />
    </div>
  ),
});
