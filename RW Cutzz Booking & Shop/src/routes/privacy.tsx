import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacybeleid — RW CUTZZ" }] }),
  component: () => (
    <div className="min-h-screen bg-brand-bg">
      <SiteHeader />
      <article className="pt-28 pb-20 px-6 max-w-3xl mx-auto">
        <h1 className="font-display text-4xl font-extrabold tracking-tighter mb-8">
          Privacybeleid
        </h1>

        <h2 className="font-display text-xl mt-6 mb-2">Wie zijn wij</h2>
        <p className="text-brand-muted">
          Verwerkingsverantwoordelijke: [BEDRIJFSNAAM], KvK [KVK-NUMMER], [ADRES]. Contact:{" "}
          [CONTACT-EMAIL].
        </p>

        <h2 className="font-display text-xl mt-6 mb-2">Welke gegevens verzamelen wij</h2>
        <p className="text-brand-muted">
          Naam, e-mailadres, telefoonnummer (optioneel), boekingsgegevens en ordergegevens.
        </p>

        <h2 className="font-display text-xl mt-6 mb-2">Waarom verzamelen wij deze gegevens</h2>
        <p className="text-brand-muted">
          Voor de uitvoering van de overeenkomst (jouw boeking of bestelling), wettelijke
          verplichtingen (fiscale bewaarplicht) en ons gerechtvaardigd belang (bijvoorbeeld
          fraudepreventie).
        </p>

        <h2 className="font-display text-xl mt-6 mb-2">Hoe lang bewaren wij gegevens</h2>
        <p className="text-brand-muted">
          Boekings- en orderdata worden 7 jaar bewaard in verband met de fiscale bewaarplicht.
          Marketinggegevens worden bewaard tot je je uitschrijft.
        </p>

        <h2 className="font-display text-xl mt-6 mb-2">Delen met derden</h2>
        <p className="text-brand-muted">
          Wij delen gegevens alleen met verwerkers die noodzakelijk zijn voor onze dienst:
          Stripe (betalingen), Supabase (opslag), Resend (e-mail), en Meta (WhatsApp-notificaties
          — alleen met jouw expliciete toestemming).
        </p>

        <h2 className="font-display text-xl mt-6 mb-2">Jouw rechten</h2>
        <p className="text-brand-muted">
          Je hebt recht op inzage, rectificatie, verwijdering en bezwaar. Verzoeken kunnen worden
          gedaan via [CONTACT-EMAIL].
        </p>

        <h2 className="font-display text-xl mt-6 mb-2">Cookies</h2>
        <p className="text-brand-muted">
          Zie ons{" "}
          <Link to="/cookies" className="underline text-brand-accent">
            cookiebeleid
          </Link>
          .
        </p>
      </article>
      <SiteFooter />
    </div>
  ),
});
