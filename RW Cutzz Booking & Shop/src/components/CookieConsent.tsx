import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("cookie_consent") !== "accepted") {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;
  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 bg-brand-dark text-white p-4 rounded shadow-2xl border border-brand-accent/30">
      <p className="text-sm">
        Wij gebruiken functionele cookies om de site goed te laten werken.{" "}
        <Link to="/cookies" className="underline text-brand-accent">
          Meer info
        </Link>
      </p>
      <div className="mt-3 flex justify-end">
        <button
          onClick={() => {
            localStorage.setItem("cookie_consent", "accepted");
            setVisible(false);
          }}
          className="bg-brand-accent text-white px-5 py-2 text-xs font-bold uppercase tracking-widest hover:glow-accent transition"
        >
          Akkoord
        </button>
      </div>
    </div>
  );
}
