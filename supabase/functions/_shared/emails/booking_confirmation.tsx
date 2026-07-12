import React from "npm:react@18.3.1";
import { button, EmailRender, formatDateTime, icsAttachment, money, p, shell } from "./layout.tsx";

export function booking_confirmation(data: Record<string, any>): EmailRender {
  const cancelUrl = `${data.public_site_url}/annuleer?booking=${data.booking_id}&token=${data.cancel_token}`;
  const html = shell("Je afspraak is bevestigd", <>
    {p(`Je afspraak voor ${data.service_name} staat gepland op ${formatDateTime(data.starts_at)}.`)}
    {p(`Aanbetaling: ${money(data.deposit_cents ?? 0)}. Nog te voldoen in de zaak: ${money(data.remaining_cents ?? 0)}.`)}
    {button("Afspraak beheren of annuleren", cancelUrl)}
  </>);
  return {
    subject: "Je afspraak is bevestigd",
    html,
    text: `Je afspraak voor ${data.service_name} is bevestigd op ${formatDateTime(data.starts_at)}.`,
    attachments: [icsAttachment(data as any)],
  };
}
