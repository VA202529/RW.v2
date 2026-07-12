import React from "npm:react@18.3.1";
import { EmailRender, formatDateTime, p, shell } from "./layout.tsx";

export function booking_rescheduled(data: Record<string, any>): EmailRender {
  const html = shell("Je afspraak is verzet", <>{p(`Je nieuwe afspraak voor ${data.service_name} is op ${formatDateTime(data.starts_at)}.`)}</>);
  return { subject: "Je afspraak is verzet", html, text: `Nieuwe afspraak: ${formatDateTime(data.starts_at)}.` };
}
