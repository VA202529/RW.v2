import React from "npm:react@18.3.1";
import { EmailRender, money, p, shell } from "./layout.tsx";

export function monthly_invoice(data: Record<string, any>): EmailRender {
  const title = `Factuur ${data.month_label ?? ""}`.trim();
  const html = shell(title, <>
    {p(`Periode: ${data.period_label}.`)}
    {p(`Aantal boekingen: ${data.booking_count ?? 0}.`)}
    {p(`Totale omzet aanbetalingen: ${money(data.deposits_cents ?? 0)}.`)}
    {p(`Van Appiah platformfee excl. BTW: ${money(data.fee_ex_vat_cents ?? 0)}.`)}
    {p(`BTW 21%: ${money(data.vat_cents ?? 0)}.`)}
    {p(`Totaal incl. BTW: ${money(data.total_incl_vat_cents ?? 0)}.`)}
    {p("Reeds verwerkt via Mollie applicationFee.")}
    {p("Mogelijk gemaakt door Geheel Digitaal - geheeldigitaal.nl")}
  </>);

  return {
    subject: `Factuur ${data.month_label} - BarberFlow RW CUTZZ`,
    html,
    text: [
      `Periode: ${data.period_label}`,
      `Aantal boekingen: ${data.booking_count ?? 0}`,
      `Totale omzet aanbetalingen: ${money(data.deposits_cents ?? 0)}`,
      `Van Appiah platformfee excl. BTW: ${money(data.fee_ex_vat_cents ?? 0)}`,
      `BTW 21%: ${money(data.vat_cents ?? 0)}`,
      `Totaal incl. BTW: ${money(data.total_incl_vat_cents ?? 0)}`,
      "Reeds verwerkt via Mollie applicationFee",
      "Mogelijk gemaakt door Geheel Digitaal - geheeldigitaal.nl",
    ].join("\n"),
  };
}
