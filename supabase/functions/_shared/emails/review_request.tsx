import React from "npm:react@18.3.1";
import { button, EmailRender, p, shell } from "./layout.tsx";

export function review_request(data: Record<string, any>): EmailRender {
  const url = `${data.public_site_url}/review/${data.booking_id}?token=${encodeURIComponent(data.review_token ?? "")}`;
  const html = shell("Hoe was je afspraak?", <>{p("Laat kort weten hoe je bezoek was. Dat helpt ons enorm.")}{button("Review plaatsen", url)}</>);
  return { subject: "Hoe was je afspraak?", html, text: `Plaats je review: ${url}` };
}
