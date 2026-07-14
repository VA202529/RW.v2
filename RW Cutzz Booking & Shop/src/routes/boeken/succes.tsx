import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createFileRoute("/boeken/succes")({
  head: () => ({ meta: [{ title: "Afspraak bevestigd — RW CUTZZ" }] }),
  component: Success,
});

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

declare global {
  interface Window {
    rwCutzzInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

function isInstalled() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function downloadIcs() {
  const start = new Date(Date.now() + 3 * 24 * 3600 * 1000);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//RW CUTZZ//NL
BEGIN:VEVENT
UID:${Date.now()}@rwcutzz
DTSTAMP:${fmt(new Date())}
DTSTART:${fmt(start)}
DTEND:${fmt(end)}
SUMMARY:Afspraak bij RW CUTZZ
LOCATION:RW CUTZZ, Nederland
END:VEVENT
END:VCALENDAR`;
  const blob = new Blob([ics], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "afspraak.ics";
  a.click();
  URL.revokeObjectURL(url);
}

function InstallPromptBanner() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || isInstalled()) return undefined;

    if (window.rwCutzzInstallPrompt) {
      setPromptEvent(window.rwCutzzInstallPrompt);
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      const installPrompt = event as BeforeInstallPromptEvent;
      window.rwCutzzInstallPrompt = installPrompt;
      setPromptEvent(installPrompt);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  async function promptInstall() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    await promptEvent.userChoice.catch(() => undefined);
    window.rwCutzzInstallPrompt = null;
    setPromptEvent(null);
  }

  if (!promptEvent) return null;

  return (
    <div className="mt-10 rounded border border-brand-accent/30 bg-brand-surface p-4 text-left">
      <p className="text-sm font-bold text-brand-text">Sneller boeken vanaf je beginscherm</p>
      <p className="mt-1 text-xs text-brand-muted">
        Installeer RW CUTZZ als app op je telefoon voor snelle toegang.
      </p>
      <button
        type="button"
        onClick={promptInstall}
        className="mt-4 w-full bg-brand-accent px-5 py-3 text-xs font-bold uppercase tracking-widest text-white transition hover:glow-accent sm:w-auto"
      >
        Zet RW CUTZZ op je beginscherm
      </button>
    </div>
  );
}

function Success() {
  return (
    <div className="min-h-screen bg-brand-bg">
      <SiteHeader />
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <CheckCircle2 className="w-16 h-16 text-brand-accent mx-auto mb-4" />
          <h1 className="font-display text-4xl md:text-5xl font-extrabold tracking-tighter mb-4">
            Afspraak bevestigd!
          </h1>
          <p className="text-brand-muted mb-8">
            Je ontvangt een bevestiging per e-mail. Tot binnenkort — Fresher Than Clean.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={downloadIcs}
              className="bg-brand-accent text-white px-6 py-3 text-xs font-bold uppercase tracking-widest hover:glow-accent transition"
            >
              Download .ics
            </button>
            <Link
              to="/account"
              className="border border-brand-text/20 px-6 py-3 text-xs font-bold uppercase tracking-widest"
            >
              Bekijk je afspraken
            </Link>
          </div>
          <p className="mt-10 text-xs text-brand-muted">
            💡 Tip: zet RW CUTZZ op je beginscherm voor sneller boeken.
          </p>
          <InstallPromptBanner />
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
