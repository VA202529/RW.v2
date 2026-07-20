import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacybeleid - RW CUTZZ" }] }),
  component: () => (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      <SiteHeader />
      <article className="flex-1 pt-28 pb-20 px-6 max-w-3xl mx-auto">
        <h1 className="font-display text-4xl font-extrabold tracking-tighter mb-8">
          Privacybeleid
        </h1>

        <h2 className="font-display text-xl mt-6 mb-2">Verwerkingsverantwoordelijke</h2>
        <p className="text-brand-muted">
          RWCUTZZ, Mariëndaal 94, 1025 BW Amsterdam, KVK 94077991, is verantwoordelijk voor de
          verwerking van persoonsgegevens via deze website en in de zaak. Voor privacyvragen kun
          je mailen naar Chanoroch@outlook.com.
        </p>

        <h2 className="font-display text-xl mt-6 mb-2">Welke persoonsgegevens verwerken wij?</h2>
        <p className="text-brand-muted">
          Wij verwerken naam, e-mailadres, telefoonnummer, boekingsgegevens, betalingsgegevens,
          bestelgegevens, voorkeuren voor notificaties en eventuele reviews die je zelf invult.
        </p>

        <h2 className="font-display text-xl mt-6 mb-2">Doelen van de verwerking</h2>
        <p className="text-brand-muted">
          Wij gebruiken je gegevens voor de uitvoering van de overeenkomst, waaronder afspraken,
          aanbetalingen, webshopbestellingen en afhaalberichten. Daarnaast gebruiken wij gegevens
          voor noodzakelijke notificaties, herinneringen, klantenservice en reviews. Marketing per
          e-mail of WhatsApp gebeurt alleen wanneer je daar toestemming voor hebt gegeven.
        </p>

        <h2 className="font-display text-xl mt-6 mb-2">Bewaartermijn</h2>
        <p className="text-brand-muted">
          Boekings- en klantgegevens bewaren wij tot 2 jaar na je laatste bezoek, tenzij een
          langere wettelijke bewaartermijn verplicht is voor administratie of betalingen.
        </p>

        <h2 className="font-display text-xl mt-6 mb-2">Betalingen, e-mail en verwerkers</h2>
        <p className="text-brand-muted">
          Betalingen verlopen via Stripe. Lees meer op{" "}
          <a
            href="https://stripe.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-accent underline"
          >
            stripe.com/privacy
          </a>
          . Transactionele e-mail loopt via Resend. Resend wordt niet gebruikt voor marketing
          zonder toestemming. De website gebruikt Supabase voor authenticatie, database en
          opslag.
        </p>

        <h2 className="font-display text-xl mt-6 mb-2">Jouw rechten</h2>
        <p className="text-brand-muted">
          Je hebt recht op inzage, correctie, verwijdering, beperking en bezwaar. Je kunt
          gegevens beheren via je account of een verzoek sturen naar Chanoroch@outlook.com.
        </p>

        <h2 className="font-display text-xl mt-6 mb-2">Cookies</h2>
        <p className="text-brand-muted">
          Lees meer in ons{" "}
          <Link to="/cookies" className="underline text-brand-accent">
            cookiebeleid
          </Link>
          .
        </p>

        <h2 className="font-display text-xl mt-6 mb-2">Taal</h2>
        <p className="text-brand-muted">Dit privacybeleid is opgesteld in het Nederlands.</p>
      </article>
      <SiteFooter />
    </div>
  ),
});
