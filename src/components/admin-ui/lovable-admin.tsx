import type { LucideIcon } from "lucide-react";
import { ArrowRight, LockKeyhole, LogOut, MoreHorizontal, Scissors, X } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

type NavItem = readonly [string, string, LucideIcon];

export function LovableLogin({
  email,
  sent,
  denied,
  checking,
  onEmailChange,
  onSubmit,
}: {
  email: string;
  sent: boolean;
  denied: boolean;
  checking: boolean;
  onEmailChange: (email: string) => void;
  onSubmit: () => void;
}) {
  return (
    <main className="lovableLogin" data-ui-source="lovable-admin-zip">
      <section className="loginHero">
        <div className="loginBrandMark">
          <Scissors size={28} />
        </div>
        <p className="loginEyebrow">BarberFlow Admin</p>
        <h1>Rustige controle over je zaak.</h1>
        <p>
          Beheer agenda, klanten, webshop en statistieken vanuit een dashboard dat is gemaakt
          voor dagelijkse snelheid.
        </p>
        <div className="loginStats">
          <span>Live Supabase</span>
          <span>Admin-only</span>
          <span>RW CUTZZ</span>
        </div>
      </section>

      <section className="loginCard" aria-label="Admin login">
        <div className="loginIcon">
          <LockKeyhole size={22} />
        </div>
        <h2>{checking ? "Admin controleren..." : "Inloggen"}</h2>
        <p>Gebruik je beheerdersmail. Na de magic link controleren we je admin-rol.</p>
        {denied ? <div className="notice dangerNotice">Geen toegang</div> : null}
        {sent ? (
          <div className="notice successNotice">Check je mail voor de magic link.</div>
        ) : (
          <div className="loginForm">
            <label htmlFor="admin-email">E-mailadres</label>
            <input
              id="admin-email"
              aria-label="E-mail"
              autoComplete="email"
              placeholder="owner@rwcutzz.nl"
              type="email"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && email && !checking) onSubmit();
              }}
            />
            <button className="primary loginSubmit" disabled={!email || checking} onClick={onSubmit}>
              Magic link sturen <ArrowRight size={18} />
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

export function AdminFrame({
  section,
  nav,
  children,
}: {
  section: string;
  nav: readonly NavItem[];
  children: ReactNode;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const primaryTabs = ["agenda", "boekingen", "klanten", "webshop"];
  const bottomTabs = nav.filter(([id]) => primaryTabs.includes(id));
  const moreItems = nav.filter(([id]) => !primaryTabs.includes(id));
  const moreActive = moreItems.some(([id]) => section === id);

  return (
    <div className="lovableAdminShell" data-ui-source="lovable-admin-zip">
      <aside className="lovableSidebar">
        <div className="lovableBrand">
          <span>
            <Scissors size={20} />
          </span>
          <div>
            <strong>BarberFlow</strong>
            <small>RW CUTZZ admin</small>
          </div>
        </div>
        <nav>
          {nav.map(([id, label, Icon]) => (
            <a
              key={id}
              className={section === id ? "lovableNavItem active" : "lovableNavItem"}
              href={id === "agenda" ? "/admin" : `/admin/${id}`}
            >
              <Icon size={18} />
              <span>{label}</span>
            </a>
          ))}
        </nav>
        <div className="sidebarProfile">
          <div className="profileAvatar">RW</div>
          <div>
            <strong>RW CUTZZ</strong>
            <small>owner@rwcutzz.nl</small>
          </div>
          <LogOut size={16} />
        </div>
      </aside>
      <main className="lovableMain">{children}</main>
      <nav className="lovableBottomNav">
        {bottomTabs.map(([id, label, Icon]) => (
          <a key={id} className={section === id ? "active" : ""} href={id === "agenda" ? "/admin" : `/admin/${id}`}>
            <Icon size={18} />
            <span>{label}</span>
          </a>
        ))}
        <button className={moreActive ? "active" : ""} onClick={() => setMoreOpen(true)}>
          <MoreHorizontal size={18} />
          <span>Meer</span>
        </button>
      </nav>
      {moreOpen ? (
        <div className="lovableMoreOverlay">
          <div className="moreHeader">
            <h2>Meer</h2>
            <button onClick={() => setMoreOpen(false)} aria-label="Sluiten">
              <X size={20} />
            </button>
          </div>
          <div className="moreList">
            {moreItems.map(([id, label, Icon]) => (
              <a key={id} href={id === "agenda" ? "/admin" : `/admin/${id}`} className="moreItem">
                <span><Icon size={20} /></span>
                <strong>{label}</strong>
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PagePanel({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="lovablePanel">
      <div className="lovableMobileHeader">
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <div className="lovablePanelHeader">
        <div>
          <p className="panelEyebrow">BarberFlow</p>
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {actions ? <div className="actions">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function StatusPill({ status }: { status: string }) {
  const labels: Record<string, string> = {
    confirmed: "Bevestigd",
    completed: "Voltooid",
    no_show: "No-show",
    cancelled: "Geannuleerd",
    pending_payment: "In afwachting",
    paid: "Betaald",
    ready_for_pickup: "Klaar",
    picked_up: "Opgehaald",
  };
  return <span className={`lovableStatus ${status}`}>{labels[status] ?? status}</span>;
}

export function EmptyPanel({ children = "Geen gegevens gevonden." }: { children?: ReactNode }) {
  return <div className="lovableEmpty">{children}</div>;
}

export function MetricCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="lovableMetric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
