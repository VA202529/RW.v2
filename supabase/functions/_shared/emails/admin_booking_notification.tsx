import React from "npm:react@18.3.1";
import { EmailRender, formatDateTime, money, p, shell } from "./layout.tsx";

function line(label: string, value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return p(<><strong>{label}:</strong> {String(value)}</>);
}

function durationMinutes(startsAt?: string, endsAt?: string) {
  if (!startsAt || !endsAt) return null;
  const minutes = Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000);
  return Number.isFinite(minutes) && minutes > 0 ? `${minutes} min` : null;
}

export function admin_booking_notification(data: Record<string, any>): EmailRender {
  const customerName = data.customer_name ?? "Onbekende klant";
  const priceCents = Number.isFinite(data.price_cents)
    ? data.price_cents
    : Number(data.deposit_cents ?? 0) + Number(data.remaining_cents ?? 0);
  const duration = data.duration_minutes ? `${data.duration_minutes} min` : durationMinutes(data.starts_at, data.ends_at);
  const html = shell("Nieuwe afspraak", <>
    {p("Er is een nieuwe afspraak geboekt.")}
    {line("Klant", customerName)}
    {line("Datum en tijd", data.starts_at ? formatDateTime(data.starts_at) : null)}
    {line("Dienst", data.service_name)}
    {line("Duur", duration)}
    {line("Prijs", money(priceCents))}
    {line("Telefoon", data.phone_e164)}
    {line("E-mail", data.customer_email)}
  </>);

  return {
    subject: `Nieuwe afspraak - ${customerName}`,
    html,
    text: [
      "Er is een nieuwe afspraak geboekt.",
      `Klant: ${customerName}`,
      data.starts_at ? `Datum en tijd: ${formatDateTime(data.starts_at)}` : null,
      data.service_name ? `Dienst: ${data.service_name}` : null,
      duration ? `Duur: ${duration}` : null,
      `Prijs: ${money(priceCents)}`,
      data.phone_e164 ? `Telefoon: ${data.phone_e164}` : null,
      data.customer_email ? `E-mail: ${data.customer_email}` : null,
    ].filter(Boolean).join("\n"),
  };
}
