import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createFileRoute("/cookies")({
  head: () => ({ meta: [{ title: "Cookiebeleid — RW CUTZZ" }] }),
  component: () => (
    <div className="min-h-screen bg-brand-bg">
      <SiteHeader />
      <article className="pt-28 pb-20 px-6 max-w-3xl mx-auto prose prose-slate">
        <h1 className="font-display text-4xl font-extrabold tracking-tighter mb-6">
          Cookiebeleid
        </h1>
        <h2 className="font-display text-xl mt-8 mb-2">Wat zijn cookies?</h2>
        <p>
          Cookies zijn kleine tekstbestanden die door je browser worden opgeslagen wanneer je een
          website bezoekt.
        </p>
        <h2 className="font-display text-xl mt-8 mb-2">Welke cookies gebruiken wij?</h2>
        <h3 className="font-display mt-4 mb-1">Functioneel</h3>
        <p>
          Noodzakelijk voor het functioneren van de website (bijv. het onthouden van je
          winkelwagen). Hiervoor is geen toestemming vereist.
        </p>
        <h3 className="font-display mt-4 mb-1">Analytisch</h3>
        <p>Alleen indien van toepassing en met jouw expliciete toestemming.</p>
        <h2 className="font-display text-xl mt-8 mb-2">Hoe beheer je cookies?</h2>
        <p>
          Je kunt cookies beheren en verwijderen via de instellingen van je browser.
        </p>
      </article>
      <SiteFooter />
    </div>
  ),
});
