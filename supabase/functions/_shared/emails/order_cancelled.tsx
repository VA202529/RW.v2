import React from "npm:react@18.3.1";
import { EmailRender, p, shell } from "./layout.tsx";

export function order_cancelled(): EmailRender {
  const html = shell("Je bestelling is geannuleerd", <>
    {p("Je annulering is bevestigd. De terugbetaling wordt binnen 5 werkdagen verwerkt.")}
  </>);
  return { subject: "Je bestelling is geannuleerd", html, text: "Je annulering is bevestigd. De terugbetaling wordt binnen 5 werkdagen verwerkt." };
}
