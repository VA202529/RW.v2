import React from "npm:react@18.3.1";

export type EmailRender = {
  subject: string;
  html: React.ReactNode;
  text: string;
  attachments?: Array<{ filename: string; content: string }>;
};

export function shell(title: string, body: React.ReactNode) {
  return (
    <html lang="nl">
      <body style={{ margin: 0, background: "#f7f4ef", fontFamily: "Arial, sans-serif", color: "#1f2933" }}>
        <table width="100%" cellPadding="0" cellSpacing="0" role="presentation">
          <tbody>
            <tr>
              <td align="center" style={{ padding: "28px 16px" }}>
                <table width="100%" cellPadding="0" cellSpacing="0" role="presentation" style={{ maxWidth: 620, background: "#fffdf9", border: "1px solid #ded7ca", borderRadius: 8 }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: 28 }}>
                        <p style={{ margin: "0 0 18px", color: "#0f766e", fontWeight: 700 }}>BarberFlow</p>
                        <h1 style={{ fontSize: 26, lineHeight: 1.2, margin: "0 0 18px" }}>{title}</h1>
                        {body}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}

export function p(children: React.ReactNode) {
  return <p style={{ fontSize: 16, lineHeight: 1.6, margin: "0 0 14px" }}>{children}</p>;
}

export function button(label: string, href: string) {
  return (
    <p style={{ margin: "22px 0" }}>
      <a href={href} style={{ background: "#0f766e", color: "#ffffff", padding: "12px 16px", borderRadius: 8, textDecoration: "none", fontWeight: 700 }}>
        {label}
      </a>
    </p>
  );
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    timeZone: "Europe/Amsterdam",
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(value));
}

export function money(cents: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function icsAttachment(data: { service_name: string; starts_at: string; ends_at?: string }) {
  const start = new Date(data.starts_at);
  const end = data.ends_at ? new Date(data.ends_at) : new Date(start.getTime() + 30 * 60_000);
  const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BarberFlow//Booking//NL",
    "BEGIN:VEVENT",
    `UID:${crypto.randomUUID()}@barberflow.local`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${data.service_name}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return { filename: "barberflow-afspraak.ics", content: btoa(ics) };
}
