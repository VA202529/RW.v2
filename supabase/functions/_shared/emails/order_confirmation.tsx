import React from "npm:react@18.3.1";
import { EmailRender, money, p, shell } from "./layout.tsx";

export function order_confirmation(data: Record<string, any>): EmailRender {
  const items = data.items ?? [];
  const html = shell("Je bestelling is ontvangen", <>
    {p("We hebben je bestelling en betaling ontvangen. Je ontvangt een bericht zodra je bestelling klaarligt.")}
    <ul>{items.map((item: any) => <li key={item.name}>{item.name} x{item.quantity} - {money(item.unit_price_cents * item.quantity)}</li>)}</ul>
    {p(`Totaal: ${money(data.total_cents ?? 0)}.`)}
    {p("Annuleren kan binnen 14 dagen zolang de bestelling nog niet is opgehaald en niet onder uitgesloten verzegelde cosmetica valt.")}
  </>);
  return { subject: "Je bestelling is ontvangen", html, text: `Je bestelling is ontvangen. Totaal: ${money(data.total_cents ?? 0)}.` };
}
