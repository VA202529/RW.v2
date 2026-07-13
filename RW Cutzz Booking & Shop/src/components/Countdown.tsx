import { useEffect, useState } from "react";

export function Countdown({
  until,
  onExpire,
}: {
  until: string;
  onExpire?: () => void;
}) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.floor((new Date(until).getTime() - Date.now()) / 1000)),
  );

  useEffect(() => {
    const t = setInterval(() => {
      const r = Math.max(0, Math.floor((new Date(until).getTime() - Date.now()) / 1000));
      setRemaining(r);
      if (r === 0) {
        clearInterval(t);
        onExpire?.();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [until, onExpire]);

  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  return (
    <span className="font-mono">
      {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  );
}
