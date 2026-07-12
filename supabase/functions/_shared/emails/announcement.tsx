import React from "npm:react@18.3.1";
import { EmailRender, p, shell } from "./layout.tsx";

export function announcement(data: Record<string, any>): EmailRender {
  const html = shell(data.title ?? "Aankondiging", <>
    {p(<span dangerouslySetInnerHTML={{ __html: data.body ?? "" }} />)}
  </>);
  return {
    subject: data.title ?? "Aankondiging",
    html,
    text: String(data.body ?? "").replace(/<[^>]*>/g, ""),
  };
}
