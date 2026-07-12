import React from "npm:react@18.3.1";
import { EmailRender, money, p, shell } from "./layout.tsx";

export function booking_cancelled(data: Record<string, any>): EmailRender {
  const outcome = data.credited
    ? `Je aanbetaling van ${money(data.deposit_cents ?? 0)} staat als tegoed op je account.`
    : data.refunded
      ? `Je terugbetaling wordt binnen 5 werkdagen op je rekening verwerkt.`
      : "De afspraak is binnen 24 uur geannuleerd; de aanbetaling is vervallen.";
  const html = shell("Je afspraak is geannuleerd", <>{p(outcome)}</>);
  return { subject: "Je afspraak is geannuleerd", html, text: outcome };
}
