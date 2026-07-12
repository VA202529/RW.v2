import React from "npm:react@18.3.1";
import { EmailRender, money, p, shell } from "./layout.tsx";

export function platform_invoice(data: Record<string, any>): EmailRender {
  const html = shell("Maandelijkse platformkosten", <>
    {p(`Periode: ${data.period_start} t/m ${data.period_end}.`)}
    {p(`Totaal application fees: ${money(data.total_fee_cents ?? 0)}.`)}
  </>);
  return {
    subject: "BarberFlow platformkosten",
    html,
    text: `Platformkosten ${data.period_start} t/m ${data.period_end}: ${money(data.total_fee_cents ?? 0)}.`,
  };
}
