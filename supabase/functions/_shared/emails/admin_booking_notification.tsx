import React from "npm:react@18.3.1";
import { EmailRender, money } from "./layout.tsx";

function durationMinutes(startsAt?: string, endsAt?: string) {
  if (!startsAt || !endsAt) return null;
  const minutes = Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000);
  return Number.isFinite(minutes) && minutes > 0 ? `${minutes} min` : null;
}

function formatDate(value?: string) {
  if (!value) return null;
  return new Intl.DateTimeFormat("nl-NL", {
    timeZone: "Europe/Amsterdam",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function formatTime(value?: string) {
  if (!value) return null;
  return new Intl.DateTimeFormat("nl-NL", {
    timeZone: "Europe/Amsterdam",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <tr>
      <td style={{ padding: "10px 0", borderBottom: "1px solid #ece7dc" }}>
        <p style={{ margin: "0 0 4px", fontSize: 12, lineHeight: "16px", color: "#7a715f", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0 }}>
          {label}
        </p>
        <p style={{ margin: 0, fontSize: 16, lineHeight: "22px", color: "#171717", fontWeight: 700 }}>
          {value}
        </p>
      </td>
    </tr>
  );
}

export function admin_booking_notification(data: Record<string, any>): EmailRender {
  const customerName = data.customer_name ?? "Onbekende klant";
  const priceCents = Number.isFinite(data.price_cents)
    ? data.price_cents
    : Number(data.deposit_cents ?? 0) + Number(data.remaining_cents ?? 0);
  const duration = data.duration_minutes ? `${data.duration_minutes} min` : durationMinutes(data.starts_at, data.ends_at);
  const date = formatDate(data.starts_at);
  const time = formatTime(data.starts_at);
  const phone = data.phone_e164 ? String(data.phone_e164) : null;
  const email = data.customer_email ? String(data.customer_email) : null;

  const html = (
    <html lang="nl">
      <body style={{ margin: 0, padding: 0, background: "#0b0b0b", fontFamily: "Arial, Helvetica, sans-serif", color: "#171717" }}>
        <table width="100%" cellPadding="0" cellSpacing="0" role="presentation" style={{ background: "#0b0b0b" }}>
          <tbody>
            <tr>
              <td align="center" style={{ padding: "24px 12px" }}>
                <table width="100%" cellPadding="0" cellSpacing="0" role="presentation" style={{ maxWidth: 560, width: "100%", background: "#ffffff", borderRadius: 14, overflow: "hidden" }}>
                  <tbody>
                    <tr>
                      <td style={{ background: "#111111", padding: "22px 22px 18px", borderBottom: "4px solid #d6a619" }}>
                        <p style={{ margin: 0, color: "#ffffff", fontSize: 24, lineHeight: "28px", fontWeight: 900, letterSpacing: 0 }}>
                          RW CUTZZ
                        </p>
                        <p style={{ margin: "12px 0 0", color: "#d6a619", fontSize: 13, lineHeight: "18px", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0 }}>
                          Nieuwe afspraak
                        </p>
                        <p style={{ margin: "4px 0 0", color: "#f6f1e6", fontSize: 15, lineHeight: "22px" }}>
                          Er is een nieuwe afspraak geboekt.
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: "22px" }}>
                        <table width="100%" cellPadding="0" cellSpacing="0" role="presentation" style={{ background: "#fff9e8", border: "1px solid #ead79d", borderRadius: 12 }}>
                          <tbody>
                            <tr>
                              <td style={{ padding: "18px" }}>
                                <p style={{ margin: "0 0 6px", color: "#7a5a00", fontSize: 12, lineHeight: "16px", fontWeight: 900, textTransform: "uppercase", letterSpacing: 0 }}>
                                  Datum & tijd
                                </p>
                                <p style={{ margin: 0, color: "#111111", fontSize: 22, lineHeight: "28px", fontWeight: 900 }}>
                                  {date ?? "Datum onbekend"}
                                </p>
                                {time ? (
                                  <p style={{ margin: "6px 0 0", color: "#111111", fontSize: 28, lineHeight: "34px", fontWeight: 900 }}>
                                    {time}
                                  </p>
                                ) : null}
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        <table width="100%" cellPadding="0" cellSpacing="0" role="presentation" style={{ marginTop: 12 }}>
                          <tbody>
                            <DetailRow label="Klant" value={customerName} />
                            <DetailRow label="Dienst" value={data.service_name} />
                            <DetailRow label="Duur" value={duration} />
                            <DetailRow label="Prijs" value={money(priceCents)} />
                            <DetailRow
                              label="Contact"
                              value={(
                                <>
                                  {phone ? <><a href={`tel:${phone}`} style={{ color: "#171717", textDecoration: "none" }}>{phone}</a><br /></> : null}
                                  {email ? <a href={`mailto:${email}`} style={{ color: "#171717", textDecoration: "underline" }}>{email}</a> : null}
                                </>
                              )}
                            />
                          </tbody>
                        </table>

                        <table width="100%" cellPadding="0" cellSpacing="0" role="presentation" style={{ marginTop: 22, borderTop: "1px solid #ece7dc" }}>
                          <tbody>
                            <tr>
                              <td style={{ paddingTop: 16 }}>
                                <p style={{ margin: 0, color: "#111111", fontSize: 14, lineHeight: "20px", fontWeight: 800 }}>
                                  BarberFlow
                                </p>
                                <p style={{ margin: "2px 0 0", color: "#7a715f", fontSize: 13, lineHeight: "19px" }}>
                                  Automatische boekingsmelding
                                </p>
                                <p style={{ margin: "12px 0 0", color: "#8a8170", fontSize: 12, lineHeight: "18px" }}>
                                  Dit systeem is ontwikkeld door{" "}
                                  <a href="http://geheeldigitaal.nl/" style={{ color: "#6f560c", textDecoration: "underline" }}>
                                    Geheel Digitaal
                                  </a>
                                </p>
                              </td>
                            </tr>
                          </tbody>
                        </table>
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

  return {
    subject: `Nieuwe afspraak - ${customerName}`,
    html,
    text: [
      "RW CUTZZ",
      "",
      "NIEUWE AFSPRAAK",
      "Er is een nieuwe afspraak geboekt.",
      "",
      date ? `Datum: ${date}` : null,
      time ? `Tijd: ${time}` : null,
      `Klant: ${customerName}`,
      data.service_name ? `Dienst: ${data.service_name}` : null,
      duration ? `Duur: ${duration}` : null,
      `Prijs: ${money(priceCents)}`,
      phone ? `Telefoon: ${phone}` : null,
      email ? `E-mail: ${email}` : null,
      "",
      "BarberFlow",
      "Automatische boekingsmelding",
      "Dit systeem is ontwikkeld door Geheel Digitaal: http://geheeldigitaal.nl/",
    ].filter((line) => line !== null).join("\n"),
  };
}
