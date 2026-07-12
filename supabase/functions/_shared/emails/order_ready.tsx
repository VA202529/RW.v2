import React from "npm:react@18.3.1";
import { EmailRender, p, shell } from "./layout.tsx";

export function order_ready(data: Record<string, any>): EmailRender {
  const hours = data.opening_hours ?? "Bekijk de actuele openingstijden op de website.";
  const html = shell("Je bestelling ligt klaar", <>
    {p("Je bestelling ligt klaar in de zaak. Neem je bevestiging mee bij het ophalen.")}
    {p(`Openingstijden: ${hours}`)}
  </>);
  return { subject: "Je bestelling ligt klaar", html, text: "Je bestelling ligt klaar om opgehaald te worden." };
}
