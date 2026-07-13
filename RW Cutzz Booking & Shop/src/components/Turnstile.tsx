import { useEffect, useRef, useState } from "react";
import { TURNSTILE_SITE_KEY } from "@/lib/env";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: { sitekey: string; callback: (t: string) => void }) => string;
      reset: (id?: string) => void;
    };
  }
}

export function Turnstile({ onToken }: { onToken: (t: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) {
      // In mock mode, immediately return a mock token
      onToken("mock-turnstile-token");
      return;
    }
    const src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    let script = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    const tryRender = () => {
      if (window.turnstile && ref.current && !rendered) {
        window.turnstile.render(ref.current, {
          sitekey: TURNSTILE_SITE_KEY!,
          callback: (t: string) => onToken(t),
        });
        setRendered(true);
      } else if (!window.turnstile) {
        setTimeout(tryRender, 200);
      }
    };
    tryRender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!TURNSTILE_SITE_KEY) {
    return (
      <div className="border border-dashed border-brand-text/20 rounded p-4 bg-brand-surface text-xs text-brand-muted">
        Beveiligingscheck (Turnstile) — geconfigureerd na deploy.
      </div>
    );
  }
  return <div ref={ref} />;
}
