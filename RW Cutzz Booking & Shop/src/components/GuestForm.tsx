import { useRef, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Turnstile } from "@/components/Turnstile";
import type { Guest } from "@/lib/api/types";

const PHONE_COUNTRIES = [
  { code: "NL", flag: "🇳🇱", dialCode: "+31", placeholder: "6 12345678" },
  { code: "BE", flag: "🇧🇪", dialCode: "+32", placeholder: "XX XXXX XXXX" },
  { code: "DE", flag: "🇩🇪", dialCode: "+49", placeholder: "XX XXXX XXXX" },
  { code: "GB", flag: "🇬🇧", dialCode: "+44", placeholder: "XX XXXX XXXX" },
  { code: "FR", flag: "🇫🇷", dialCode: "+33", placeholder: "XX XXXX XXXX" },
  { code: "US", flag: "🇺🇸", dialCode: "+1", placeholder: "XX XXXX XXXX" },
  { code: "SR", flag: "🇸🇷", dialCode: "+597", placeholder: "XX XXXX XXXX" },
  { code: "AW", flag: "🇦🇼", dialCode: "+297", placeholder: "XX XXXX XXXX" },
  { code: "CW", flag: "🇨🇼", dialCode: "+599", placeholder: "XX XXXX XXXX" },
  { code: "MA", flag: "🇲🇦", dialCode: "+212", placeholder: "XX XXXX XXXX" },
  { code: "TR", flag: "🇹🇷", dialCode: "+90", placeholder: "XX XXXX XXXX" },
  { code: "GH", flag: "🇬🇭", dialCode: "+233", placeholder: "XX XXXX XXXX" },
];

function normalizePhone(dialCode: string, localNumber: string): string | null {
  if (!localNumber || localNumber.trim() === "") return null;
  const digits = localNumber.replace(/[\s\-().]/g, "");
  if (digits.startsWith("+")) return digits;
  const local = digits.startsWith("0") ? digits.slice(1) : digits;
  return dialCode + local;
}

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
  const [countryCode, setCountryCode] = useState("NL");
  const [localPhoneNumber, setLocalPhoneNumber] = useState(initial?.phone_e164 ?? "");
  const [whatsapp, setWhatsapp] = useState(!!initial?.whatsapp_opt_in);
  const [marketing, setMarketing] = useState(!!initial?.marketing_email_opt_in);
  const [terms, setTerms] = useState(false);
  const [token, setToken] = useState<string>("");
  const tokenRef = useRef("");
  const [err, setErr] = useState<string | null>(null);

  const selectedCountry = PHONE_COUNTRIES.find((country) => country.code === countryCode) ?? PHONE_COUNTRIES[0];
  const normalizedPhone = normalizePhone(selectedCountry.dialCode, localPhoneNumber);
  const phoneIsEmpty = localPhoneNumber.trim() === "";
  const phoneIsValid = !normalizedPhone || /^\+[1-9]\d{6,14}$/.test(normalizedPhone);
  const canUseWhatsapp = Boolean(normalizedPhone && phoneIsValid);

  function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!name.trim()) return setErr("Vul je naam in.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setErr("Vul een geldig e-mailadres in.");
    if (!terms) return setErr("Ga akkoord met de voorwaarden om verder te gaan.");
    if (!phoneIsEmpty && !phoneIsValid) return setErr("Vul een geldig telefoonnummer in (bijv. 0612345678).");
    const turnstileToken = tokenRef.current || token;
    console.log("Submitting with token:", turnstileToken?.substring(0, 20));
    if (!turnstileToken) return setErr("Wacht op de beveiligingscheck.");
    onSubmit(
      {
        full_name: name.trim(),
        email: email.trim(),
        phone_e164: normalizedPhone ?? undefined,
        whatsapp_opt_in: canUseWhatsapp && whatsapp,
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
        <div className="flex gap-2">
          <select
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
            className="h-12 rounded border border-brand-text/15 bg-brand-surface px-3 text-sm focus:outline-none focus:border-brand-accent"
            aria-label="Landcode"
          >
            {PHONE_COUNTRIES.map((country) => (
              <option key={country.code} value={country.code}>
                {country.flag} {country.dialCode}
              </option>
            ))}
          </select>
          <input
            type="tel"
            value={localPhoneNumber}
            onChange={(e) => setLocalPhoneNumber(e.target.value)}
            placeholder={selectedCountry.placeholder}
            className="h-12 min-w-0 flex-1 rounded border border-brand-text/15 bg-brand-surface px-4 text-sm focus:outline-none focus:border-brand-accent"
          />
        </div>
        <p className="text-[11px] text-brand-muted mt-1">
          Optioneel — je ontvangt WhatsApp-berichten als je dit invult
        </p>
        {!phoneIsEmpty && !phoneIsValid && (
          <p className="text-[11px] text-red-600 mt-1">
            Vul een geldig telefoonnummer in (bijv. 0612345678)
          </p>
        )}
      </div>
      <label
        className={`flex items-start gap-2 text-sm ${
          canUseWhatsapp ? "" : "opacity-60 cursor-not-allowed"
        }`}
        title={canUseWhatsapp ? undefined : "Vul eerst je telefoonnummer in"}
      >
        <input
          type="checkbox"
          checked={whatsapp && canUseWhatsapp}
          onChange={(e) => setWhatsapp(e.target.checked)}
          disabled={!canUseWhatsapp}
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
