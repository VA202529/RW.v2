import React from "npm:react@18.3.1";
import { button, EmailRender, formatDateTime, p, shell } from "./layout.tsx";

export function booking_reminder_48h(data: Record<string, any>): EmailRender {
  const manageUrl = `${data.public_site_url}/annuleer?booking=${data.booking_id}&token=${data.cancel_token ?? ""}`;
  const deadline = new Date(new Date(data.starts_at).getTime() - 24 * 60 * 60 * 1000).toISOString();
  const html = shell("Herinnering: je afspraak komt eraan", <>
    {p(`Je afspraak voor ${data.service_name} is op ${formatDateTime(data.starts_at)}.`)}
    {p(`Kosteloos verzetten kan tot ${formatDateTime(deadline)}.`)}
    {button("Afspraak verzetten of annuleren", manageUrl)}
  </>);
  return { subject: "Herinnering: je afspraak komt eraan", html, text: `Je afspraak is op ${formatDateTime(data.starts_at)}.` };
}
