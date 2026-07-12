import React from "npm:react@18.3.1";
import { button, EmailRender, p, shell } from "./layout.tsx";

export function conflict_refund(data: Record<string, any>): EmailRender {
  const html = shell("Sorry, je tijdslot was niet meer beschikbaar", <>
    {p("Je betaling kwam binnen nadat het tijdslot opnieuw was geboekt. We hebben de volledige terugbetaling direct gestart.")}
    {button("Opnieuw boeken", `${data.public_site_url}/`)}
  </>);
  return { subject: "Terugbetaling bevestigd", html, text: "Je volledige terugbetaling is gestart. Boek gerust opnieuw." };
}
