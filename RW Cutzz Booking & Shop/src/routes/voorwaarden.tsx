import { createFileRoute } from "@tanstack/react-router";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/voorwaarden")({
  head: () => ({ meta: [{ title: "Algemene voorwaarden - RW CUTZZ" }] }),
  component: () => (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      <SiteHeader />
      <article className="flex-1 pt-28 pb-20 px-6 max-w-3xl mx-auto">
        <h1 className="font-display text-4xl font-extrabold tracking-tighter mb-8">
          Algemene voorwaarden
        </h1>

        <h2 className="font-display text-xl mt-6 mb-2">Artikel 1 - Ondernemer</h2>
        <p className="text-brand-muted">
          Deze algemene voorwaarden zijn van toepassing op alle diensten, boekingen en
          webshopbestellingen van RWCUTZZ, een eenmanszaak gevestigd aan Mariëndaal 94, 1025 BW
          Amsterdam. RWCUTZZ is ingeschreven bij de Kamer van Koophandel onder nummer 94077991.
          Het vestigingsnummer is 000059578688. Contact verloopt via Chanoroch@outlook.com.
        </p>

        <h2 className="font-display text-xl mt-6 mb-2">Artikel 2 - Afspraken en aanbetaling</h2>
        <p className="text-brand-muted">
          Bij het maken van een online afspraak betaal je vooraf een aanbetaling. De aanbetaling
          wordt duidelijk getoond voordat je de afspraak bevestigt. Het restbedrag betaal je in de
          zaak.
        </p>

        <h2 className="font-display text-xl mt-6 mb-2">Artikel 3 - Annuleren en verzetten</h2>
        <p className="text-brand-muted">
          Annuleren of verzetten is kosteloos tot 24 uur voor de afspraak. Annuleer je binnen 24
          uur voor de afspraak of kom je niet opdagen, dan vervalt de aanbetaling.
        </p>

        <h2 className="font-display text-xl mt-6 mb-2">Artikel 4 - Betalingen</h2>
        <p className="text-brand-muted">
          Online betalingen verlopen via Stripe iDEAL. Voor afspraken betaal je vooraf de
          aanbetaling en het restbedrag in de zaak. Webshopbestellingen worden online afgerekend.
          Alle prijzen zijn inclusief btw. BTW-nummer volgt.
        </p>

        <h2 className="font-display text-xl mt-6 mb-2">Artikel 5 - Webshop en afhalen</h2>
        <p className="text-brand-muted">
          Producten uit de webshop worden klaargezet voor afhalen in de zaak. Je ontvangt bericht
          zodra je bestelling klaarligt.
        </p>

        <h2 className="font-display text-xl mt-6 mb-2">Artikel 6 - Herroepingsrecht webshop</h2>
        <p className="text-brand-muted">
          Voor webshopbestellingen geldt een herroepingsrecht van 14 dagen na ontvangst. Dit geldt
          niet voor verzegelde cosmetica of verzorgingsproducten waarvan de verzegeling is
          verbroken. Voor afspraken met een vaste datum en tijd geldt geen herroepingsrecht.
        </p>

        <h2 className="font-display text-xl mt-6 mb-2">Artikel 7 - Klachten</h2>
        <p className="text-brand-muted">
          Klachten kunnen per e-mail worden ingediend via Chanoroch@outlook.com. RWCUTZZ reageert
          zo snel mogelijk en uiterlijk binnen 14 dagen.
        </p>

        <h2 className="font-display text-xl mt-6 mb-2">Artikel 8 - Website en ontwikkeling</h2>
        <p className="text-brand-muted">
          De website van RWCUTZZ is https://rwcutzz.com. De website is ontwikkeld door Van Appiah,
          https://vanappiah.com.
        </p>

        <h2 className="font-display text-xl mt-6 mb-2">Artikel 9 - Toepasselijk recht</h2>
        <p className="text-brand-muted">
          Op deze voorwaarden is Nederlands recht van toepassing. De taal van deze voorwaarden is
          Nederlands.
        </p>
      </article>
      <SiteFooter />
    </div>
  ),
});
