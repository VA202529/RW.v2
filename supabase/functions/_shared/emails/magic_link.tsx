import React from "npm:react@18.3.1";
import { button, EmailRender, p, shell } from "./layout.tsx";

export function magic_link(data: Record<string, any>): EmailRender {
  const html = shell("Beheer je afspraken", <>
    {p("Maak je account aan of log in om je afspraken, tegoed en voorkeuren te beheren.")}
    {button("Open mijn account", data.magic_link)}
  </>);
  return { subject: "Beheer je afspraken", html, text: `Open je account: ${data.magic_link}` };
}
