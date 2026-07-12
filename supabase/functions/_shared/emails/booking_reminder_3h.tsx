import React from "npm:react@18.3.1";
import { EmailRender, formatDateTime, p, shell } from "./layout.tsx";

export function booking_reminder_3h(data: Record<string, any>): EmailRender {
  const html = shell("Tot straks", <>{p(`Vandaag om ${formatDateTime(data.starts_at)} staat ${data.service_name} voor je klaar.`)}</>);
  return { subject: "Tot straks bij BarberFlow", html, text: `Vandaag staat je afspraak gepland: ${formatDateTime(data.starts_at)}.` };
}
