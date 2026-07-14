import { useRef, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Turnstile } from "@/components/Turnstile";
import type { Guest } from "@/lib/api/types";

export function GuestForm({
  onSubmit,
  submitLabel,
  disabled,
  initial,
}: {
  onSubmit: (guest: Guest, turnstile_token: string) => void;
  submitLabel: string;
  disabled?: boolean;
  initial?: Partial<Guest>;
}) {
  const [name, setName] = useState(initial?.full_name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone_e164 ?? "");
  const [whatsapp, setWhatsapp] = useState(!!initial?.whatsapp_opt_in);
  const [marketing, setMarketing] = useState(!!initial?.marketing_email_opt_in);
  const [terms, setTerms] = useState(false);
  const [token, setToken] = useState<string>("");
  const tokenRef = useRef("");
  const [err, setErr] = useState<string | null>(null);

  const phoneFilled = phone.trim().length >= 6;

  function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!name.trim()) return setErr("Vul je naam in.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setErr("Vul een geldig e-mailadres in.");
    if (!terms) return setErr("Ga akkoord met de voorwaarden om verder te gaan.");
    const turnstileToken = tokenRef.current || token;
    console.log("Submitting with token:", turnstileToken?.substring(0, 20));
    if (!turnstileToken) return setErr("Wacht op de beveiligingscheck.");
    onSubmit(
      {
        full_name: name.trim(),
        email: email.trim(),
        phone_e164: phoneFilled ? phone.trim() : undefined,
        whatsapp_opt_in: phoneFilled && whatsapp,
        marketing_email_opt_in: marketing,
        terms_accepted: true,
      },
      turnstileToken,
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div>
        <label className="text-xs uppercase tracking-widest text-brand-muted block mb-1">
          Naam *
        </label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-brand-surface border border-brand-text/15 px-4 py-3 text-sm focus:outline-none focus:border-brand-accent rounded"
        />
      </div>
      <div>
        <label className="text-xs uppercase tracking-widest text-brand-muted block mb-1">
          E-mailadres *
        </label>
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-brand-surface border border-brand-text/15 px-4 py-3 text-sm focus:outline-none focus:border-brand-accent rounded"
        />
      </div>
      <div>
        <label className="text-xs uppercase tracking-widest text-brand-muted block mb-1">
          Telefoon (optioneel)
        </label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+31 6 12345678"
          className="w-full bg-brand-surface border border-brand-text/15 px-4 py-3 text-sm focus:outline-none focus:border-brand-accent rounded"
        />
        <p className="text-[11px] text-brand-muted mt-1">Formaat: E.164 (bijv. +31612345678)</p>
      </div>
      <label
        className={`flex items-start gap-2 text-sm ${
          phoneFilled ? "" : "opacity-60 cursor-not-allowed"
        }`}
        title={phoneFilled ? undefined : "Vul je telefoonnummer in"}
      >
        <input
          type="checkbox"
          checked={whatsapp && phoneFilled}
          onChange={(e) => setWhatsapp(e.target.checked)}
          disabled={!phoneFilled}
          className="mt-1"
        />
        <span>Stuur mij bevestigingen via WhatsApp</span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={marketing}
          onChange={(e) => setMarketing(e.target.checked)}
          className="mt-1"
        />
        <span>Ik wil op de hoogte blijven van aanbiedingen en nieuws</span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={terms}
          onChange={(e) => setTerms(e.target.checked)}
          className="mt-1"
        />
        <span>
          Ik ga akkoord met de{" "}
          <Link to="/voorwaarden" target="_blank" className="underline text-brand-accent">
            algemene voorwaarden
          </Link>{" "}
          en het{" "}
          <Link to="/privacy" target="_blank" className="underline text-brand-accent">
            privacybeleid
          </Link>
          .
        </span>
      </label>

      <Turnstile
        onToken={(value) => {
          tokenRef.current = value;
          setToken(value);
        }}
      />

      {err && <p className="text-sm text-red-600">{err}</p>}

      <button
        type="submit"
        disabled={disabled}
        className="bg-brand-accent text-white px-6 py-4 text-xs font-bold uppercase tracking-widest hover:glow-accent transition disabled:opacity-50"
      >
        {submitLabel}
      </button>
    </form>
  );
}
