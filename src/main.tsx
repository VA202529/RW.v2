import React from "react";
import ReactDOM from "react-dom/client";
import { createClient, type User } from "@supabase/supabase-js";
import {
  BarChart3,
  CalendarDays,
  Clock,
  Inbox,
  Loader2,
  LockKeyhole,
  RefreshCw,
  Scissors,
  ShoppingBag,
  Star,
  Users,
} from "lucide-react";
import { AppHeader } from "./components/app-header";
import { AvatarInitials } from "./components/avatar-initials";
import { BottomTabBar } from "./components/bottom-tab-bar";
import { FilterChips } from "./components/filter-chips";
import { FullSidebar, SideRail } from "./components/full-sidebar";
import { KPICard } from "./components/kpi-card";
import { PageHeader } from "./components/page-header";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { StatusBadge } from "./components/status-badge";
import "./styles.css";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
  },
});

const CACHE_TTL_MS = 5 * 60_000;
const LOGIN_ROUTE = "/admin/login";
const RESET_ROUTE = "/admin/reset-password";
const ADMIN_HOME = "/admin";

type Service = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  duration_minutes: number;
  deposit_type: "fixed" | "percentage";
  deposit_value: number;
};

type Product = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  stock: number;
  image_paths: string[] | null;
  category: "general" | "sealed_cosmetics";
  is_active?: boolean;
};

type AdminBooking = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  source: string;
  deposit_cents: number;
  customer_name: string | null;
  customer_email: string;
  phone_e164: string | null;
  service_id: string;
  service_name: string;
  price_cents: number;
};

type CacheEntry<T> = {
  data: T;
  fetchedAt: number;
};

type InvoiceSummary = {
  periodLabel: string;
  bookingCount: number;
  depositsCents: number;
  feeExVatCents: number;
  vatCents: number;
  totalInclVatCents: number;
};

const sectionCache = new Map<string, CacheEntry<unknown>>();
const eur = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });

function cents(value: number) {
  return eur.format(value / 100);
}

function isoDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function normalizePath(pathname: string) {
  if (pathname === "/") return ADMIN_HOME;
  if (!pathname.startsWith("/admin")) return ADMIN_HOME;
  return pathname;
}

function readCache<T>(key: string) {
  return sectionCache.get(key) as CacheEntry<T> | undefined;
}

function writeCache<T>(key: string, data: T) {
  sectionCache.set(key, { data, fetchedAt: Date.now() });
}

function isCacheFresh(entry?: CacheEntry<unknown>) {
  return Boolean(entry && Date.now() - entry.fetchedAt < CACHE_TTL_MS);
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function monthRange(date = new Date()) {
  return {
    start: new Date(date.getFullYear(), date.getMonth(), 1),
    end: new Date(date.getFullYear(), date.getMonth() + 1, 1),
  };
}

function buildInvoiceSummary(payments: Array<{ status: string; amount_cents?: number; platform_fee_cents?: number }>, date = new Date()): InvoiceSummary {
  const paidPayments = payments.filter((payment) => payment.status === "paid");
  const depositsCents = paidPayments.reduce((sum, payment) => sum + (payment.amount_cents ?? 0), 0);
  const feeExVatCents = paidPayments.reduce((sum, payment) => sum + (payment.platform_fee_cents ?? 0), 0);
  const vatCents = Math.round(feeExVatCents * 0.21);
  const formatter = new Intl.DateTimeFormat("nl-NL", { month: "long", year: "numeric" });

  return {
    periodLabel: formatter.format(date),
    bookingCount: paidPayments.length,
    depositsCents,
    feeExVatCents,
    vatCents,
    totalInclVatCents: feeExVatCents + vatCents,
  };
}

function App() {
  const [path, setPath] = React.useState(() => normalizePath(window.location.pathname));

  React.useEffect(() => {
    const normalized = normalizePath(window.location.pathname);
    if (normalized !== window.location.pathname) {
      window.history.replaceState({}, "", normalized);
      setPath(normalized);
    }

    const onPop = () => setPath(normalizePath(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function navigate(nextPath: string, replace = false) {
    const normalized = normalizePath(nextPath);
    if (normalized === path) return;
    window.history[replace ? "replaceState" : "pushState"]({}, "", normalized);
    setPath(normalized);
  }

  return <AdminPage path={path} navigate={navigate} />;
}

function AdminPage({ path, navigate }: { path: string; navigate: (nextPath: string, replace?: boolean) => void }) {
  const section = path.split("/")[2] || "agenda";
  const isLoginRoute = path === LOGIN_ROUTE;
  const isResetRoute = path === RESET_ROUTE;
  const [allowed, setAllowed] = React.useState(false);
  const [checking, setChecking] = React.useState(true);
  const [denied, setDenied] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [resetPassword, setResetPassword] = React.useState("");
  const [confirmResetPassword, setConfirmResetPassword] = React.useState("");
  const [authError, setAuthError] = React.useState("");
  const [authMessage, setAuthMessage] = React.useState("");
  const [authLoading, setAuthLoading] = React.useState(false);

  React.useEffect(() => {
    let active = true;

    function applyUser(user: User | null) {
      if (!active) return;
      if (!user) {
        setAllowed(false);
        setDenied(false);
        setChecking(false);
        return;
      }

      const role = (user.app_metadata as { app_role?: string } | undefined)?.app_role;
      if (role === "admin") {
        setAllowed(true);
        setDenied(false);
        if (isLoginRoute) navigate(ADMIN_HOME, true);
      } else {
        setAllowed(false);
        setDenied(true);
      }
      setChecking(false);
    }

    supabase.auth.getUser().then(({ data }) => applyUser(data.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      applyUser(session?.user ?? null);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [isLoginRoute, navigate]);

  async function signInWithPassword() {
    setAuthLoading(true);
    setAuthError("");
    setAuthMessage("");
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: { persistSession: true },
    } as any);
    if (error) {
      setAuthError("Inloggen mislukt. Controleer e-mailadres en wachtwoord.");
    }
    setAuthLoading(false);
  }

  async function sendResetEmail() {
    if (!email) {
      setAuthError("Vul eerst je e-mailadres in.");
      return;
    }

    setAuthLoading(true);
    setAuthError("");
    setAuthMessage("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://admin.rwcutzz.com/admin/reset-password",
    });
    if (error) {
      setAuthError("Resetlink verzenden is niet gelukt.");
    } else {
      setAuthMessage("We hebben een resetlink gestuurd naar dit e-mailadres.");
    }
    setAuthLoading(false);
  }

  async function updatePassword() {
    if (!resetPassword || resetPassword.length < 8) {
      setAuthError("Gebruik een wachtwoord van minimaal 8 tekens.");
      return;
    }
    if (resetPassword !== confirmResetPassword) {
      setAuthError("De wachtwoorden komen niet overeen.");
      return;
    }

    setAuthLoading(true);
    setAuthError("");
    setAuthMessage("");
    const { error } = await supabase.auth.updateUser({ password: resetPassword });
    if (error) {
      setAuthError("Wachtwoord bijwerken is niet gelukt.");
    } else {
      setAuthMessage("Wachtwoord bijgewerkt. Log opnieuw in.");
      await supabase.auth.signOut();
      navigate(LOGIN_ROUTE, true);
      setAllowed(false);
      setPassword("");
      setResetPassword("");
      setConfirmResetPassword("");
    }
    setAuthLoading(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    setAllowed(false);
    setDenied(false);
    setPassword("");
    navigate(LOGIN_ROUTE, true);
  }

  if (checking && !isResetRoute) {
    return <AuthShell title="Bezig met controleren" subtitle="Even je sessie ophalen." loading />;
  }

  if (isResetRoute) {
    return (
      <ResetPasswordScreen
        password={resetPassword}
        confirmPassword={confirmResetPassword}
        error={authError}
        message={authMessage}
        loading={authLoading}
        onPasswordChange={setResetPassword}
        onConfirmPasswordChange={setConfirmResetPassword}
        onSubmit={updatePassword}
        onBack={() => navigate(LOGIN_ROUTE, true)}
      />
    );
  }

  if (denied || !allowed || isLoginRoute) {
    return (
      <AdminLogin
        email={email}
        password={password}
        error={denied ? "Dit account heeft geen admin-toegang." : authError}
        message={authMessage}
        loading={authLoading}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onSubmit={signInWithPassword}
        onForgotPassword={sendResetEmail}
      />
    );
  }

  return (
    <AdminFrame path={path} onNavigate={navigate} onLogout={logout}>
      {(section === "agenda" || section === "boekingen") && <AdminAgenda />}
      {section === "beschikbaarheid" && <AdminAvailability />}
      {section === "diensten" && <AdminServices />}
      {section === "klanten" && <AdminClients />}
      {section === "aankondigingen" && <AdminAnnouncements />}
      {section === "reviews" && <AdminReviews />}
      {section === "statistieken" && <AdminStats />}
      {section === "webshop" && <AdminWebshop />}
    </AdminFrame>
  );
}

function AuthShell({
  title,
  subtitle,
  children,
  loading,
}: {
  title: string;
  subtitle: string;
  children?: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <main className="h-[100dvh] overflow-hidden bg-background text-foreground grid place-items-center p-4">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="h-12 w-12 rounded-xl bg-primary/15 text-primary grid place-items-center mb-4">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <LockKeyhole className="h-5 w-5" />}
        </div>
        <h1 className="text-2xl font-black tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground mt-2">{subtitle}</p>
        {children}
      </section>
    </main>
  );
}

function AdminLogin({
  email,
  password,
  error,
  message,
  loading,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onForgotPassword,
}: {
  email: string;
  password: string;
  error: string;
  message: string;
  loading: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
  onForgotPassword: () => void;
}) {
  return (
    <AuthShell title="BarberFlow Admin" subtitle="Log in met e-mailadres en wachtwoord.">
      {error ? <div className="notice dangerNotice mt-5">{error}</div> : null}
      {message ? <div className="notice successNotice mt-5">{message}</div> : null}
      <div className="grid gap-3 mt-5">
        <Input value={email} onChange={(event) => onEmailChange(event.target.value)} type="email" placeholder="owner@rwcutzz.nl" />
        <Input value={password} onChange={(event) => onPasswordChange(event.target.value)} type="password" placeholder="Wachtwoord" />
        <Button disabled={!email || !password || loading} onClick={onSubmit}>
          {loading ? "Bezig met inloggen..." : "Inloggen"}
        </Button>
        <button type="button" className="secondary w-full" onClick={onForgotPassword} disabled={loading}>
          Wachtwoord vergeten?
        </button>
      </div>
    </AuthShell>
  );
}

function ResetPasswordScreen({
  password,
  confirmPassword,
  error,
  message,
  loading,
  onPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
  onBack,
}: {
  password: string;
  confirmPassword: string;
  error: string;
  message: string;
  loading: boolean;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
}) {
  return (
    <AuthShell title="Nieuw wachtwoord" subtitle="Stel direct een nieuw admin-wachtwoord in.">
      {error ? <div className="notice dangerNotice mt-5">{error}</div> : null}
      {message ? <div className="notice successNotice mt-5">{message}</div> : null}
      <div className="grid gap-3 mt-5">
        <Input value={password} onChange={(event) => onPasswordChange(event.target.value)} type="password" placeholder="Nieuw wachtwoord" />
        <Input value={confirmPassword} onChange={(event) => onConfirmPasswordChange(event.target.value)} type="password" placeholder="Herhaal wachtwoord" />
        <Button disabled={!password || !confirmPassword || loading} onClick={onSubmit}>
          {loading ? "Bezig met opslaan..." : "Wachtwoord opslaan"}
        </Button>
        <button type="button" className="secondary w-full" onClick={onBack}>
          Terug naar login
        </button>
      </div>
    </AuthShell>
  );
}

function AdminFrame({
  path,
  onNavigate,
  onLogout,
  children,
}: {
  path: string;
  onNavigate: (to: string, replace?: boolean) => void;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="h-[100dvh] overflow-hidden bg-background text-foreground flex">
      <FullSidebar path={path} onNavigate={onNavigate} onLogout={onLogout} />
      <SideRail path={path} onNavigate={onNavigate} />
      <main className="flex-1 min-w-0 flex flex-col h-[100dvh] overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-[calc(82px+env(safe-area-inset-bottom))] md:pb-0">
          <div className="min-h-full animate-page-in">{children}</div>
        </div>
      </main>
      <BottomTabBar path={path} onNavigate={onNavigate} />
    </div>
  );
}

function PagePanel({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <AppHeader title={title} large subtitle={subtitle} action={actions} />
      <PageHeader title={title} description={subtitle} actions={actions} />
      <div className="p-4 lg:p-8 space-y-4">{children}</div>
    </>
  );
}

function EmptyPanel({ children = "Geen gegevens gevonden." }: { children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/50 p-10 flex flex-col items-center justify-center text-center gap-3">
      <div className="h-12 w-12 rounded-full bg-muted grid place-items-center text-muted-foreground">
        <Inbox className="h-5 w-5" />
      </div>
      <div className="text-sm font-semibold">{children}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return <StatusBadge status={status} />;
}

function RefreshButton({ loading, onClick }: { loading?: boolean; onClick: () => void }) {
  return (
    <button type="button" className="secondary" onClick={onClick} disabled={loading}>
      <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
      Vernieuwen
    </button>
  );
}

function AdminAgenda() {
  const [view, setView] = React.useState<"day" | "week">("day");
  const [date, setDate] = React.useState(isoDate());
  const cacheKey = `agenda:${view}:${date}`;
  const cached = readCache<{ bookings: AdminBooking[]; blocked_slots: any[]; services: Service[] }>(cacheKey);
  const [data, setData] = React.useState<{ bookings: AdminBooking[]; blocked_slots: any[]; services: Service[] }>(
    () => cached?.data ?? { bookings: [], blocked_slots: [], services: [] },
  );
  const [detail, setDetail] = React.useState<AdminBooking | null>(null);
  const [manual, setManual] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [lastLoadedAt, setLastLoadedAt] = React.useState(cached?.fetchedAt ?? 0);

  React.useEffect(() => {
    const entry = readCache<typeof data>(cacheKey);
    if (entry) {
      setData(entry.data);
      setLastLoadedAt(entry.fetchedAt);
    }
    void load(false);
  }, [cacheKey]);

  async function load(force = false) {
    const entry = readCache<typeof data>(cacheKey);
    if (!force && isCacheFresh(entry)) return;
    setLoading(true);
    try {
      const from = new Date(`${date}T00:00:00`).toISOString();
      const toDate = new Date(`${date}T00:00:00`);
      toDate.setDate(toDate.getDate() + (view === "week" ? 7 : 1));
      const { data: payload } = await supabase.functions.invoke("admin-dashboard-data", {
        body: { from, to: toDate.toISOString() },
      });
      if (payload?.status === 200) {
        const nextData = {
          bookings: payload.bookings ?? [],
          blocked_slots: payload.blocked_slots ?? [],
          services: payload.services ?? [],
        };
        setData(nextData);
        writeCache(cacheKey, nextData);
        setLastLoadedAt(Date.now());
      }
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(booking: AdminBooking, newStatus: string, refundPolicy = "none") {
    const { data: result } = await supabase.functions.invoke("admin-update-booking-status", {
      body: { booking_id: booking.id, new_status: newStatus, refund_policy: refundPolicy },
    });
    setMessage(result?.status === 200 ? "Boeking bijgewerkt." : "Bijwerken lukte niet.");
    setDetail(null);
    await load(true);
  }

  return (
    <PagePanel
      title="Agenda"
      subtitle={`Dag- en weekplanning met live boekingen en blokkades${lastLoadedAt ? ` · laatst bijgewerkt ${new Intl.DateTimeFormat("nl-NL", { timeStyle: "short" }).format(lastLoadedAt)}` : ""}.`}
      actions={
        <>
          <FilterChips
            chips={[
              { value: "day", label: "Dag" },
              { value: "week", label: "Week" },
            ]}
            value={view}
            onChange={(next) => setView(next as "day" | "week")}
            className="adminChips"
          />
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          <RefreshButton loading={loading} onClick={() => void load(true)} />
          <button className="primary" onClick={() => setManual(true)}>Handmatige boeking</button>
        </>
      }
    >
      {message && <div className="notice">{message}</div>}
      <div className="calendarList">
        {data.blocked_slots.map((blocked) => (
          <div className="blockedBar" key={blocked.id}>
            {formatLocal(blocked.starts_at)} - blokkade: {blocked.reason}
          </div>
        ))}
        {data.bookings.length === 0 && data.blocked_slots.length === 0 ? <EmptyPanel>Geen boekingen of blokkades in deze periode.</EmptyPanel> : null}
        {data.bookings.map((booking) => {
          const name = booking.customer_name || booking.customer_email;
          return (
            <button className="bookingBlock lovableBookingCard lovableBookingRow" key={booking.id} onClick={() => setDetail(booking)}>
              <AvatarInitials name={name} />
              <span className="bookingCopy">
                <strong>{name}</strong>
                <small>{booking.service_name} - {formatLocal(booking.starts_at)}</small>
              </span>
              <StatusBadge status={booking.status} />
            </button>
          );
        })}
      </div>

      {detail && (
        <div className="modal">
          <div className="modalPanel">
            <h2>{detail.customer_name || detail.customer_email}</h2>
            <p>{detail.service_name} - {formatLocal(detail.starts_at)}</p>
            <p>Aanbetaling betaald: {cents(detail.deposit_cents)} - Restbedrag: {cents(Math.max(detail.price_cents - detail.deposit_cents, 0))}</p>
            <StatusBadge status={detail.status} />
            <div className="actions">
              <button className="primary" onClick={() => void updateStatus(detail, "completed")}>Afgerond</button>
              <button className="secondary" onClick={() => void updateStatus(detail, "no_show")}>No-show</button>
              <button className="danger" onClick={() => void updateStatus(detail, "cancelled", detail.source === "manual" ? "none" : "credit")}>Annuleren</button>
              <button className="secondary" onClick={() => setDetail(null)}>Sluiten</button>
            </div>
          </div>
        </div>
      )}

      {manual && (
        <ManualBooking
          services={data.services}
          onClose={() => setManual(false)}
          onDone={() => {
            setManual(false);
            void load(true);
          }}
        />
      )}
    </PagePanel>
  );
}

function ManualBooking({ services, onClose, onDone }: { services: Service[]; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = React.useState({
    service_id: services[0]?.id ?? "",
    starts_at: "",
    full_name: "",
    email: "",
    phone_e164: "",
  });
  const [message, setMessage] = React.useState("");

  async function createManual() {
    const { data } = await supabase.functions.invoke("admin-manual-booking", { body: form });
    if (data?.status === 201) onDone();
    else setMessage("Tijdstip is al bezet");
  }

  return (
    <div className="modal">
      <div className="modalPanel lovableSheet">
        <h2>Handmatige boeking</h2>
        {message && <div className="notice">{message}</div>}
        <select value={form.service_id} onChange={(event) => setForm({ ...form, service_id: event.target.value })}>
          {services.map((service) => (
            <option value={service.id} key={service.id}>{service.name}</option>
          ))}
        </select>
        <input type="datetime-local" onChange={(event) => setForm({ ...form, starts_at: new Date(event.target.value).toISOString() })} />
        <input placeholder="Naam" onChange={(event) => setForm({ ...form, full_name: event.target.value })} />
        <input placeholder="E-mail" onChange={(event) => setForm({ ...form, email: event.target.value })} />
        <input placeholder="Telefoon" onChange={(event) => setForm({ ...form, phone_e164: event.target.value })} />
        <div className="actions">
          <button className="secondary" onClick={onClose}>Sluiten</button>
          <button className="primary" onClick={() => void createManual()}>Opslaan</button>
        </div>
      </div>
    </div>
  );
}

function AdminAvailability() {
  const cacheKey = "availability";
  const cached = readCache<{ rules: any[]; blocked_slots: any[]; day_overrides: any[] }>(cacheKey);
  const [data, setData] = React.useState(() => cached?.data ?? { rules: [], blocked_slots: [], day_overrides: [] });
  const [rule, setRule] = React.useState({ id: "", weekday: 1, opens_at: "09:00", closes_at: "18:00", is_active: true, max_bookings_per_day: "" });
  const [block, setBlock] = React.useState({ date: isoDate(), start_time: "", end_time: "", note: "" });
  const [override, setOverride] = React.useState({ date: isoDate(), is_closed: false, opens_at: "", closes_at: "", max_bookings: "", note: "" });
  const [range, setRange] = React.useState({ date_from: isoDate(), date_to: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) });
  const [conflicts, setConflicts] = React.useState<any[]>([]);
  const [blockMessage, setBlockMessage] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [lastLoadedAt, setLastLoadedAt] = React.useState(cached?.fetchedAt ?? 0);
  const weekdays = ["Zo", "Ma", "Di", "Wo", "Do", "Vr", "Za"];
  const blockCutoff = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const upcomingBlocks = data.blocked_slots.filter((item) => new Date(item.starts_at).getTime() <= blockCutoff);

  React.useEffect(() => {
    const entry = readCache<typeof data>(cacheKey);
    if (entry) {
      setData(entry.data);
      setLastLoadedAt(entry.fetchedAt);
    }
    void load(false);
  }, []);

  async function load(force = false) {
    const entry = readCache<typeof data>(cacheKey);
    if (!force && isCacheFresh(entry)) return;
    setLoading(true);
    try {
      const { data: payload } = await supabase.functions.invoke("admin-manage-availability", { body: { action: "list", payload: range } });
      if (payload?.status === 200) {
        const nextData = {
          rules: payload.rules ?? [],
          blocked_slots: payload.blocked_slots ?? [],
          day_overrides: payload.day_overrides ?? [],
        };
        setData(nextData);
        writeCache(cacheKey, nextData);
        setLastLoadedAt(Date.now());
      }
    } finally {
      setLoading(false);
    }
  }

  async function saveRule() {
    const existing = data.rules.find((item) => item.id === rule.id || item.weekday === rule.weekday);
    const payload = {
      ...rule,
      id: existing?.id ?? rule.id,
      max_bookings_per_day: rule.max_bookings_per_day === "" ? null : Number(rule.max_bookings_per_day),
    };
    await supabase.functions.invoke("admin-manage-availability", {
      body: { action: existing ? "update_rule" : "create_rule", payload },
    });
    setRule({ id: "", weekday: 1, opens_at: "09:00", closes_at: "18:00", is_active: true, max_bookings_per_day: "" });
    await load(true);
  }

  async function setMaxBookings(weekday: number, value: string) {
    await supabase.functions.invoke("admin-manage-availability", {
      body: { action: "set_max_bookings", weekday, max_bookings_per_day: value === "" ? null : Number(value) },
    });
    await load(true);
  }

  async function addBlock() {
    setBlockMessage("");
    if (!block.date || !block.start_time || !block.end_time) {
      setBlockMessage("Vul een datum, begintijd en eindtijd in.");
      return;
    }
    const { data: result, error } = await supabase.functions.invoke("admin-manage-availability", {
      body: { action: "add_block", ...block },
    });
    if (error || result?.status !== 201) {
      setBlockMessage(result?.code === "INVALID_TIME_RANGE" ? "De eindtijd moet na de begintijd liggen." : "Blokkade opslaan is niet gelukt.");
      return;
    }
    setConflicts(result.conflicts ?? []);
    setBlock({ date: isoDate(), start_time: "", end_time: "", note: "" });
    setBlockMessage("Tijdslot geblokkeerd.");
    await load(true);
  }

  async function deleteBlock(id: string) {
    await supabase.functions.invoke("admin-manage-availability", { body: { action: "delete_block", id } });
    await load(true);
  }

  async function saveOverride() {
    await supabase.functions.invoke("admin-manage-availability", {
      body: {
        action: "set_override",
        date: override.date,
        is_closed: override.is_closed,
        opens_at: override.opens_at || undefined,
        closes_at: override.closes_at || undefined,
        max_bookings: override.max_bookings === "" ? null : Number(override.max_bookings),
        note: override.note || undefined,
      },
    });
    await load(true);
  }

  async function deleteOverride(date: string) {
    await supabase.functions.invoke("admin-manage-availability", { body: { action: "delete_override", date } });
    await load(true);
  }

  return (
    <PagePanel
      title="Beschikbaarheid"
      subtitle={`Beheer weekrooster, dag-overrides, maximale boekingen per dag en blokkades${lastLoadedAt ? ` · laatst bijgewerkt ${new Intl.DateTimeFormat("nl-NL", { timeStyle: "short" }).format(lastLoadedAt)}` : ""}.`}
      actions={<RefreshButton loading={loading} onClick={() => void load(true)} />}
    >
      <h2>Weekrooster</h2>
      <div className="actions">
        <select value={rule.weekday} onChange={(event) => setRule({ ...rule, weekday: Number(event.target.value) })}>
          {weekdays.map((day, index) => <option key={day} value={index}>{day}</option>)}
        </select>
        <input type="time" value={rule.opens_at} onChange={(event) => setRule({ ...rule, opens_at: event.target.value })} />
        <input type="time" value={rule.closes_at} onChange={(event) => setRule({ ...rule, closes_at: event.target.value })} />
        <input type="number" min="0" placeholder="Max boekingen/dag" value={rule.max_bookings_per_day} onChange={(event) => setRule({ ...rule, max_bookings_per_day: event.target.value })} />
        <label><input type="checkbox" checked={rule.is_active} onChange={(event) => setRule({ ...rule, is_active: event.target.checked })} /> Actief</label>
        <button className="primary" onClick={() => void saveRule()}>Regel opslaan</button>
      </div>

      <div className="table">
        {data.rules.map((currentRule) => (
          <div className="tableRow lovableDataRow" key={currentRule.id}>
            <span>{weekdays[currentRule.weekday] ?? `Dag ${currentRule.weekday}`}</span>
            <span>{currentRule.opens_at} - {currentRule.closes_at}</span>
            <StatusPill status={currentRule.is_active ? "confirmed" : "cancelled"} />
            <span>Max: {currentRule.max_bookings_per_day ?? "geen limiet"}</span>
            <input type="number" min="0" placeholder="Nieuw max" onBlur={(event) => void setMaxBookings(currentRule.weekday, event.target.value)} />
            <button className="secondary" onClick={() => setRule({ id: currentRule.id, weekday: currentRule.weekday, opens_at: currentRule.opens_at?.slice(0, 5), closes_at: currentRule.closes_at?.slice(0, 5), is_active: currentRule.is_active, max_bookings_per_day: currentRule.max_bookings_per_day ?? "" })}>Bewerk</button>
          </div>
        ))}
      </div>

      <h2>Dag-overrides</h2>
      <div className="actions">
        <input type="date" value={range.date_from} onChange={(event) => setRange({ ...range, date_from: event.target.value })} />
        <input type="date" value={range.date_to} onChange={(event) => setRange({ ...range, date_to: event.target.value })} />
        <button className="secondary" onClick={() => void load(true)}>Periode laden</button>
      </div>

      <div className="formGrid">
        <input type="date" value={override.date} onChange={(event) => setOverride({ ...override, date: event.target.value })} />
        <input type="time" value={override.opens_at} disabled={override.is_closed} onChange={(event) => setOverride({ ...override, opens_at: event.target.value })} />
        <input type="time" value={override.closes_at} disabled={override.is_closed} onChange={(event) => setOverride({ ...override, closes_at: event.target.value })} />
        <input type="number" min="0" placeholder="Max boekingen" value={override.max_bookings} onChange={(event) => setOverride({ ...override, max_bookings: event.target.value })} />
        <input placeholder="Notitie" value={override.note} onChange={(event) => setOverride({ ...override, note: event.target.value })} />
        <label><input type="checkbox" checked={override.is_closed} onChange={(event) => setOverride({ ...override, is_closed: event.target.checked })} /> Gesloten</label>
      </div>
      <button className="primary" onClick={() => void saveOverride()}>Override opslaan</button>

      <div className="table">
        {data.day_overrides.length === 0 ? <EmptyPanel>Geen dag-overrides in deze periode.</EmptyPanel> : data.day_overrides.map((currentOverride) => (
          <div className="tableRow lovableDataRow" key={currentOverride.id}>
            <span>{currentOverride.override_date}</span>
            <span>{currentOverride.is_closed ? "Gesloten" : `${currentOverride.opens_at ?? "-"} - ${currentOverride.closes_at ?? "-"}`}</span>
            <span>Max: {currentOverride.max_bookings ?? "geen limiet"}</span>
            <span>{currentOverride.note ?? ""}</span>
            <button className="danger" onClick={() => void deleteOverride(currentOverride.override_date)}>Verwijder</button>
          </div>
        ))}
      </div>

      <h2>Tijdslot blokkeren</h2>
      <div className="formGrid">
        <input aria-label="Datum" type="date" value={block.date} onChange={(event) => setBlock({ ...block, date: event.target.value })} />
        <input aria-label="Begintijd" type="time" value={block.start_time} onChange={(event) => setBlock({ ...block, start_time: event.target.value })} />
        <input aria-label="Eindtijd" type="time" value={block.end_time} onChange={(event) => setBlock({ ...block, end_time: event.target.value })} />
        <input aria-label="Notitie" placeholder="Notitie, bijvoorbeeld Pauze" value={block.note} onChange={(event) => setBlock({ ...block, note: event.target.value })} />
      </div>
      <button className="primary" onClick={() => void addBlock()}>Tijdslot opslaan</button>
      {blockMessage && <div className="notice">{blockMessage}</div>}
      {conflicts.length > 0 && <div className="notice">Conflicten gevonden: {conflicts.map((conflict) => conflict.customer_name).join(", ")}. Los deze op via boekingsdetails.</div>}

      <h3>Blokkades komende 30 dagen</h3>
      <div className="table">
        {upcomingBlocks.length === 0 ? <EmptyPanel>Geen blokkades in de komende 30 dagen.</EmptyPanel> : upcomingBlocks.map((blocked) => (
          <div className="tableRow lovableDataRow" key={blocked.id}>
            <span>{formatLocal(blocked.starts_at)}</span>
            <span>{formatLocal(blocked.ends_at)}</span>
            <span>{blocked.reason || "Geen notitie"}</span>
            <button className="danger" onClick={() => void deleteBlock(blocked.id)}>Verwijder</button>
          </div>
        ))}
      </div>
    </PagePanel>
  );
}

function AdminServices() {
  const cacheKey = "services";
  const cached = readCache<any[]>(cacheKey);
  const [services, setServices] = React.useState<any[]>(() => cached?.data ?? []);
  const [form, setForm] = React.useState<any>({ name: "", description: "", price_cents: 0, duration_minutes: 30, buffer_minutes: 0, deposit_type: "fixed", deposit_value: 0, is_active: true });
  const [loading, setLoading] = React.useState(false);
  const [lastLoadedAt, setLastLoadedAt] = React.useState(cached?.fetchedAt ?? 0);

  React.useEffect(() => {
    const entry = readCache<any[]>(cacheKey);
    if (entry) {
      setServices(entry.data);
      setLastLoadedAt(entry.fetchedAt);
    }
    void load(false);
  }, []);

  async function load(force = false) {
    const entry = readCache<any[]>(cacheKey);
    if (!force && isCacheFresh(entry)) return;
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("admin-manage-services", { body: { action: "list" } });
      if (data?.status === 200) {
        setServices(data.services);
        writeCache(cacheKey, data.services);
        setLastLoadedAt(Date.now());
      }
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    await supabase.functions.invoke("admin-manage-services", { body: { action: "upsert", payload: form } });
    setForm({ name: "", description: "", price_cents: 0, duration_minutes: 30, buffer_minutes: 0, deposit_type: "fixed", deposit_value: 0, is_active: true });
    await load(true);
  }

  return (
    <PagePanel title="Diensten" subtitle={`Beheer behandelingen, prijzen en aanbetalingen${lastLoadedAt ? ` · laatst bijgewerkt ${new Intl.DateTimeFormat("nl-NL", { timeStyle: "short" }).format(lastLoadedAt)}` : ""}.`} actions={<RefreshButton loading={loading} onClick={() => void load(true)} />}>
      <div className="formGrid">
        <input placeholder="Naam" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <input placeholder="Prijs in centen" type="number" value={form.price_cents} onChange={(event) => setForm({ ...form, price_cents: Number(event.target.value) })} />
        <input placeholder="Duur" type="number" value={form.duration_minutes} onChange={(event) => setForm({ ...form, duration_minutes: Number(event.target.value) })} />
      </div>
      <div className="actions">
        <select value={form.deposit_type} onChange={(event) => setForm({ ...form, deposit_type: event.target.value })}>
          <option value="fixed">Vast</option>
          <option value="percentage">Percentage</option>
        </select>
        <input placeholder="Aanbetaling" type="number" value={form.deposit_value} onChange={(event) => setForm({ ...form, deposit_value: Number(event.target.value) })} />
        <label><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} /> Actief</label>
        <button className="primary" onClick={() => void save()}>Opslaan</button>
      </div>
      <div className="table">
        {services.length === 0 ? <EmptyPanel>Geen diensten gevonden.</EmptyPanel> : services.map((service) => (
          <button className="tableRow lovableDataRow" key={service.id} onClick={() => setForm(service)}>
            <span>{service.name}</span>
            <span>{cents(service.price_cents)}</span>
            <span>{service.upcoming_count} aankomend</span>
            <StatusPill status={service.is_active ? "confirmed" : "cancelled"} />
          </button>
        ))}
      </div>
    </PagePanel>
  );
}

function AdminClients() {
  const [q, setQ] = React.useState("");
  const cacheKey = `clients:${q.trim().toLowerCase()}`;
  const cached = readCache<any[]>(cacheKey);
  const [customers, setCustomers] = React.useState<any[]>(() => cached?.data ?? []);
  const [loading, setLoading] = React.useState(false);
  const [lastLoadedAt, setLastLoadedAt] = React.useState(cached?.fetchedAt ?? 0);

  React.useEffect(() => {
    const entry = readCache<any[]>(cacheKey);
    if (entry) {
      setCustomers(entry.data);
      setLastLoadedAt(entry.fetchedAt);
    }
    void load(false, q);
  }, [cacheKey]);

  async function load(force = false, nextQ = q) {
    const nextKey = `clients:${nextQ.trim().toLowerCase()}`;
    const entry = readCache<any[]>(nextKey);
    if (!force && isCacheFresh(entry)) return;
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("admin-client-data", {
        body: { action: "list", payload: { q: nextQ } },
      });
      if (data?.status === 200) {
        setCustomers(data.customers);
        writeCache(nextKey, data.customers);
        setLastLoadedAt(Date.now());
      }
    } finally {
      setLoading(false);
    }
  }

  async function update(customer: any, patch: any) {
    await supabase.functions.invoke("admin-client-data", { body: { action: "update", payload: { id: customer.id, ...patch } } });
    await load(true);
  }

  return (
    <PagePanel title="Klanten" subtitle={`Zoek klanten, tegoeden, notities en blokkades${lastLoadedAt ? ` · laatst bijgewerkt ${new Intl.DateTimeFormat("nl-NL", { timeStyle: "short" }).format(lastLoadedAt)}` : ""}.`} actions={<><input placeholder="Zoeken" value={q} onChange={(event) => setQ(event.target.value)} /><RefreshButton loading={loading} onClick={() => void load(true)} /></>}>
      <div className="table">
        {customers.length === 0 ? <EmptyPanel>Geen klanten gevonden.</EmptyPanel> : customers.map((customer) => {
          const name = customer.full_name || customer.email;
          return (
            <div className="tableRow clientRow lovableDataRow" key={customer.id}>
              <span className="clientIdentity"><AvatarInitials name={name} size="sm" /><strong>{name}</strong></span>
              <span>{customer.email}</span>
              <span>{customer.phone_e164 || "-"}</span>
              <span>{customer.visit_count} bezoeken</span>
              <span>{customer.last_visit_at ? formatLocal(customer.last_visit_at) : "-"}</span>
              <span>{cents(customer.credit_cents)}</span>
              <label><input type="checkbox" checked={customer.is_blocked} onChange={(event) => void update(customer, { is_blocked: event.target.checked })} /> Geblokkeerd</label>
              <input defaultValue={customer.notes || ""} onBlur={(event) => void update(customer, { notes: event.target.value })} />
            </div>
          );
        })}
      </div>
    </PagePanel>
  );
}

function AdminAnnouncements() {
  const month = new Intl.DateTimeFormat("nl-NL", { month: "long" }).format(new Date());
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [message, setMessage] = React.useState("");

  async function send() {
    const { data } = await supabase.functions.invoke("send-broadcast", { body: { title, body } });
    setMessage(`Verzonden: ${data?.sent ?? 0}, mislukt: ${data?.failed ?? 0}`);
  }

  return (
    <PagePanel title="Aankondigingen" subtitle="Maak broadcasts met preview en stuur naar opt-in klanten." actions={<button className="secondary" onClick={() => { setTitle(`De agenda voor ${month} staat open`); setBody(`Je kunt nu boeken via ${window.location.origin}`); }}>Agenda open</button>}>
      {message && <div className="notice">{message}</div>}
      <div className="actions">
        <RefreshButton onClick={() => setMessage("")} />
        <button className="primary" onClick={() => void send()}>Broadcast versturen</button>
      </div>
      <input placeholder="Titel" value={title} onChange={(event) => setTitle(event.target.value)} />
      <div className="editorToolbar">
        <button type="button" onClick={() => document.execCommand("bold")}>B</button>
        <button type="button" onClick={() => document.execCommand("italic")}>I</button>
      </div>
      <div className="editor" contentEditable onInput={(event) => setBody(event.currentTarget.innerHTML)}>{body}</div>
      <h2>Preview</h2>
      <div className="preview lovablePreview">
        <h3>{title}</h3>
        <div dangerouslySetInnerHTML={{ __html: body }} />
      </div>
    </PagePanel>
  );
}

function AdminReviews() {
  const [reviews, setReviews] = React.useState<any[]>([]);
  const [filter, setFilter] = React.useState("all");
  const [loading, setLoading] = React.useState(false);
  const cacheKey = `reviews:${filter}`;
  const cached = readCache<any[]>(cacheKey);
  const [lastLoadedAt, setLastLoadedAt] = React.useState(cached?.fetchedAt ?? 0);

  React.useEffect(() => {
    const entry = readCache<any[]>(cacheKey);
    if (entry) {
      setReviews(entry.data);
      setLastLoadedAt(entry.fetchedAt);
    }
    void load(false);
  }, [cacheKey]);

  async function load(force = false) {
    const entry = readCache<any[]>(cacheKey);
    if (!force && isCacheFresh(entry)) return;
    setLoading(true);
    try {
      const payload = filter === "all" ? {} : { is_visible: filter === "visible" };
      const { data } = await supabase.functions.invoke("admin-manage-reviews", { body: { action: "list", payload } });
      if (data?.status === 200) {
        setReviews(data.reviews);
        writeCache(cacheKey, data.reviews);
        setLastLoadedAt(Date.now());
      }
    } finally {
      setLoading(false);
    }
  }

  async function toggle(review: any) {
    await supabase.functions.invoke("admin-manage-reviews", {
      body: { action: "toggle", payload: { id: review.id, is_visible: !review.is_visible } },
    });
    await load(true);
  }

  return (
    <PagePanel title="Reviews" subtitle={`Publiceer of verberg klantbeoordelingen${lastLoadedAt ? ` · laatst bijgewerkt ${new Intl.DateTimeFormat("nl-NL", { timeStyle: "short" }).format(lastLoadedAt)}` : ""}.`} actions={<><FilterChips chips={[{ value: "all", label: "Alle reviews" }, { value: "visible", label: "Gepubliceerd" }, { value: "hidden", label: "In behandeling" }]} value={filter} onChange={setFilter} className="adminChips" /><RefreshButton loading={loading} onClick={() => void load(true)} /></>}>
      <div className="table">
        {reviews.length === 0 ? <EmptyPanel>Geen reviews gevonden.</EmptyPanel> : reviews.map((review) => (
          <div className="tableRow reviewRow lovableDataRow" key={review.id}>
            <span>{review.full_name || review.email}</span>
            <span>{review.service_name} - {formatLocal(review.starts_at)}</span>
            <span><Stars value={review.rating} /></span>
            <p>{review.body}</p>
            <label><input type="checkbox" checked={review.is_visible} onChange={() => void toggle(review)} /> Gepubliceerd</label>
          </div>
        ))}
      </div>
    </PagePanel>
  );
}

function AdminStats() {
  const now = new Date();
  const defaultRange = monthRange(now);
  const [from, setFrom] = React.useState(defaultRange.start.toISOString().slice(0, 10));
  const [to, setTo] = React.useState(defaultRange.end.toISOString().slice(0, 10));
  const cacheKey = `stats:${from}:${to}`;
  const cached = readCache<{ stats: any; mollie: any }>(cacheKey);
  const [stats, setStats] = React.useState<any>(cached?.data?.stats ?? null);
  const [mollie, setMollie] = React.useState<any>(cached?.data?.mollie ?? null);
  const [loading, setLoading] = React.useState(false);
  const [invoiceSending, setInvoiceSending] = React.useState(false);
  const [invoiceMessage, setInvoiceMessage] = React.useState("");
  const [lastLoadedAt, setLastLoadedAt] = React.useState(cached?.fetchedAt ?? 0);

  React.useEffect(() => {
    const entry = readCache<{ stats: any; mollie: any }>(cacheKey);
    if (entry) {
      setStats(entry.data.stats);
      setMollie(entry.data.mollie);
      setLastLoadedAt(entry.fetchedAt);
    }
    void load(false);
  }, [cacheKey]);

  async function load(force = false) {
    const entry = readCache<{ stats: any; mollie: any }>(cacheKey);
    if (!force && isCacheFresh(entry)) return;
    setLoading(true);
    try {
      const body = { date_from: new Date(from).toISOString(), date_to: new Date(to).toISOString() };
      const [{ data: statsData }, { data: mollieData }] = await Promise.all([
        supabase.functions.invoke("admin-stats", { body }),
        supabase.functions.invoke("admin-mollie-payments", { body }),
      ]);
      if (statsData?.status === 200 || mollieData?.status === 200) {
        const nextData = { stats: statsData, mollie: mollieData };
        if (statsData?.status === 200) setStats(statsData);
        if (mollieData?.status === 200) setMollie(mollieData);
        writeCache(cacheKey, nextData);
        setLastLoadedAt(Date.now());
      }
    } finally {
      setLoading(false);
    }
  }

  async function sendMonthlyInvoice() {
    setInvoiceSending(true);
    setInvoiceMessage("");
    try {
      const { data, error } = await supabase.functions.invoke("send-monthly-invoice", { body: {} });
      if (error || data?.success !== true) {
        throw error ?? new Error(data?.code ?? "SEND_FAILED");
      }
      setInvoiceMessage(`Maandfactuur verstuurd voor ${data.period_label}.`);
    } catch (error) {
      setInvoiceMessage(getErrorMessage(error, "Versturen van de maandfactuur is niet gelukt."));
    } finally {
      setInvoiceSending(false);
    }
  }

  const paidPayments = (mollie?.payments ?? []).filter((payment: any) => payment.status === "paid");
  const totals = paidPayments.reduce((result: { collected: number; mollieFees: number; platformFees: number }, payment: any) => {
    result.collected += payment.amount_cents ?? 0;
    result.mollieFees += Math.round(29 + (payment.amount_cents ?? 0) * 0.012);
    result.platformFees += payment.platform_fee_cents ?? 0;
    return result;
  }, { collected: 0, mollieFees: 0, platformFees: 0 });
  const netToBarber = Math.max(totals.collected - totals.mollieFees - totals.platformFees, 0);
  const invoiceSummary = buildInvoiceSummary(paidPayments, new Date(from));

  return (
    <PagePanel title="Statistieken" subtitle={`Live omzet, boekingen en klanttrends${lastLoadedAt ? ` · laatst bijgewerkt ${new Intl.DateTimeFormat("nl-NL", { timeStyle: "short" }).format(lastLoadedAt)}` : ""}.`} actions={<><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /><RefreshButton loading={loading} onClick={() => void load(true)} /></>}>
      {stats ? (
        <div className="metrics adminMetrics lovableMetrics">
          <KPICard label="Boekingen" value={String(stats.bookings.total)} icon={CalendarDays} />
          <KPICard label="No-show" value={`${stats.no_show_pct}%`} icon={Clock} positive={false} />
          <KPICard label="Aanbetalingen" value={cents(stats.deposit_revenue_cents)} icon={ShoppingBag} />
          <KPICard label="Platform fee" value={cents(stats.platform_fee_cents)} icon={BarChart3} />
          <KPICard label="Terugkeer" value={`${stats.return_rate_pct}%`} icon={Users} />
          <KPICard label="Nieuwe klanten" value={String(stats.new_customers)} icon={Users} />
        </div>
      ) : <EmptyPanel>Statistieken laden...</EmptyPanel>}

      {mollie ? (
        <>
          <h2 className="sectionTitle">Maandoverzicht Mollie</h2>
          <div className="metrics adminMetrics lovableMetrics">
            <KPICard label="Totaal ontvangen deze maand" value={cents(totals.collected)} icon={ShoppingBag} />
            <KPICard label="Mollie-kosten deze maand" value={cents(totals.mollieFees)} icon={BarChart3} />
            <KPICard label="Van Appiah-fee deze maand" value={cents(totals.platformFees)} icon={BarChart3} />
            <KPICard label="Netto naar kapper deze maand" value={cents(netToBarber)} icon={Users} />
          </div>

          <h2 className="sectionTitle">Maandfactuur</h2>
          <div className="table">
            <div className="tableRow lovableDataRow">
              <span>Periode</span>
              <strong>{invoiceSummary.periodLabel}</strong>
            </div>
            <div className="tableRow lovableDataRow">
              <span>Aantal bevestigde boekingen</span>
              <strong>{invoiceSummary.bookingCount}</strong>
            </div>
            <div className="tableRow lovableDataRow">
              <span>Totale aanbetalingen ontvangen</span>
              <strong>{cents(invoiceSummary.depositsCents)}</strong>
            </div>
            <div className="tableRow lovableDataRow">
              <span>Van Appiah fee excl. BTW</span>
              <strong>{cents(invoiceSummary.feeExVatCents)}</strong>
            </div>
            <div className="tableRow lovableDataRow">
              <span>BTW 21%</span>
              <strong>{cents(invoiceSummary.vatCents)}</strong>
            </div>
            <div className="tableRow lovableDataRow">
              <span>Totaal incl. BTW</span>
              <strong>{cents(invoiceSummary.totalInclVatCents)}</strong>
            </div>
          </div>
          <div className="actions">
            <button className="primary" onClick={() => void sendMonthlyInvoice()} disabled={invoiceSending}>
              {invoiceSending ? "Factuur wordt verstuurd..." : "Verstuur maandfactuur"}
            </button>
          </div>
          {invoiceMessage ? <div className="notice">{invoiceMessage}</div> : null}

          <h2 className="sectionTitle">Mollie-betalingen</h2>
          <div className="table molliePaymentsTable">
            {mollie.payments.length === 0 ? <EmptyPanel>Geen Mollie-betalingen in deze periode.</EmptyPanel> : <>
              <div className="tableRow lovableDataRow molliePaymentRow molliePaymentHeader text-white">
                <span>Klant</span><span>Dienst</span><span>Aanbetaling</span><span>Mollie-kosten</span><span>Van Appiah-fee</span><span>Netto kapper</span><span>Modus</span><span>Status</span>
              </div>
              {mollie.payments.map((payment: any) => {
                const mollieFee = payment.status === "paid" ? Math.round(29 + (payment.amount_cents ?? 0) * 0.012) : 0;
                const platformFee = payment.status === "paid" ? payment.platform_fee_cents ?? 0 : 0;
                const net = Math.max((payment.amount_cents ?? 0) - mollieFee - platformFee, 0);
                return (
                  <div className="tableRow lovableDataRow molliePaymentRow text-white" key={payment.id}>
                    <span>{payment.customer_name || payment.customer_email}</span>
                    <span>{payment.service_name}</span>
                    <span>{cents(payment.amount_cents)}</span>
                    <span>{cents(mollieFee)} <small>(schatting)</small></span>
                    <span>{cents(platformFee)}</span>
                    <span>{cents(net)}</span>
                    <span>{payment.payment_mode === "live" ? "Live" : "Test"}</span>
                    <StatusPill status={payment.status} />
                  </div>
                );
              })}
            </>}
          </div>
        </>
      ) : null}
    </PagePanel>
  );
}

function AdminWebshop() {
  const [tab, setTab] = React.useState<"products" | "orders">("products");
  const productsCacheKey = "webshop:products";
  const ordersCacheKey = "webshop:orders";
  const cachedProducts = readCache<Product[]>(productsCacheKey);
  const cachedOrders = readCache<any[]>(ordersCacheKey);
  const [products, setProducts] = React.useState<Product[]>(() => cachedProducts?.data ?? []);
  const [orders, setOrders] = React.useState<any[]>(() => cachedOrders?.data ?? []);
  const [form, setForm] = React.useState<any>({ name: "", description: "", price_cents: 0, stock: 0, stock_adjustment: 0, is_active: true, category: "general", image_paths: [] });
  const [message, setMessage] = React.useState("");
  const [loadingProducts, setLoadingProducts] = React.useState(false);
  const [loadingOrders, setLoadingOrders] = React.useState(false);
  const [lastLoadedAt, setLastLoadedAt] = React.useState(Math.max(cachedProducts?.fetchedAt ?? 0, cachedOrders?.fetchedAt ?? 0));

  React.useEffect(() => {
    const productEntry = readCache<Product[]>(productsCacheKey);
    const orderEntry = readCache<any[]>(ordersCacheKey);
    if (productEntry) setProducts(productEntry.data);
    if (orderEntry) setOrders(orderEntry.data);
    if (productEntry || orderEntry) setLastLoadedAt(Math.max(productEntry?.fetchedAt ?? 0, orderEntry?.fetchedAt ?? 0));
    void Promise.all([loadProducts(false), loadOrders(false)]);
  }, []);

  async function loadProducts(force = false) {
    const entry = readCache<Product[]>(productsCacheKey);
    if (!force && isCacheFresh(entry)) return;
    setLoadingProducts(true);
    try {
      const { data } = await supabase.functions.invoke("admin-manage-products", { body: { action: "list" } });
      if (data?.status === 200) {
        setProducts(data.products);
        writeCache(productsCacheKey, data.products);
        setLastLoadedAt(Date.now());
      }
    } finally {
      setLoadingProducts(false);
    }
  }

  async function loadOrders(force = false) {
    const entry = readCache<any[]>(ordersCacheKey);
    if (!force && isCacheFresh(entry)) return;
    setLoadingOrders(true);
    try {
      const { data } = await supabase.functions.invoke("admin-manage-orders", { body: { action: "list", payload: {} } });
      if (data?.status === 200) {
        setOrders(data.orders);
        writeCache(ordersCacheKey, data.orders);
        setLastLoadedAt(Date.now());
      }
    } finally {
      setLoadingOrders(false);
    }
  }

  async function saveProduct() {
    await supabase.functions.invoke("admin-manage-products", { body: { action: "upsert", payload: form } });
    setForm({ name: "", description: "", price_cents: 0, stock: 0, stock_adjustment: 0, is_active: true, category: "general", image_paths: [] });
    await loadProducts(true);
  }

  async function updateOrder(order: any, status: string) {
    await supabase.functions.invoke("admin-manage-orders", { body: { action: "update_status", payload: { order_id: order.id, status } } });
    await loadOrders(true);
  }

  async function cancelOrder(order: any) {
    const { data } = await supabase.functions.invoke("admin-manage-orders", { body: { action: "cancel_order", payload: { order_id: order.id } } });
    setMessage(data?.status === 200 ? "Bestelling geannuleerd." : "Annuleren lukte niet.");
    await loadOrders(true);
  }

  const imagePath = form.image_paths?.[0] ?? "";

  return (
    <PagePanel title="Webshop" subtitle={`Producten, voorraad en afhaalorders${lastLoadedAt ? ` · laatst bijgewerkt ${new Intl.DateTimeFormat("nl-NL", { timeStyle: "short" }).format(lastLoadedAt)}` : ""}.`} actions={<><FilterChips chips={[{ value: "products", label: "Producten", count: products.length }, { value: "orders", label: "Bestellingen", count: orders.length }]} value={tab} onChange={(next) => setTab(next as "products" | "orders")} className="adminChips" /><RefreshButton loading={loadingProducts || loadingOrders} onClick={() => void Promise.all([loadProducts(true), loadOrders(true)])} /></>}>
      {message && <div className="notice">{message}</div>}
      {tab === "products" ? (
        <>
          <div className="formGrid">
            <input placeholder="Naam" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            <input placeholder="Prijs centen" type="number" value={form.price_cents} onChange={(event) => setForm({ ...form, price_cents: Number(event.target.value) })} />
            <input placeholder="Voorraad" type="number" value={form.stock} onChange={(event) => setForm({ ...form, stock: Number(event.target.value) })} />
            <input placeholder="Afbeelding URL of storage-pad" value={imagePath} onChange={(event) => setForm({ ...form, image_paths: event.target.value ? [event.target.value] : [] })} />
          </div>
          <div className="actions">
            <input placeholder="Stock +/-" type="number" value={form.stock_adjustment} onChange={(event) => setForm({ ...form, stock_adjustment: Number(event.target.value) })} />
            <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
              <option value="general">Algemeen</option>
              <option value="sealed_cosmetics">Verzegelde cosmetica</option>
            </select>
            <label><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} /> Actief</label>
            <button className="primary" onClick={() => void saveProduct()}>Product opslaan</button>
          </div>
          <div className="table">
            {products.length === 0 ? <EmptyPanel>Geen producten gevonden.</EmptyPanel> : products.map((product) => (
              <button className="tableRow lovableDataRow" key={product.id} onClick={() => setForm({ ...product, stock_adjustment: 0 })}>
                <span>{product.name}</span>
                <span>{cents(product.price_cents)}</span>
                <span>Stock {product.stock}</span>
                <span>{product.category}</span>
                <StatusPill status={product.is_active ? "confirmed" : "cancelled"} />
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="table">
          {orders.length === 0 ? <EmptyPanel>Geen bestellingen gevonden.</EmptyPanel> : orders.map((order) => (
            <div className="tableRow lovableDataRow" key={order.id}>
              <span>{order.email}</span>
              <span>{order.items_summary}</span>
              <span>{cents(order.total_cents)}</span>
              <StatusPill status={order.status} />
              <div className="actions">
                {order.status === "paid" && <button className="primary" onClick={() => void updateOrder(order, "ready_for_pickup")}>Klaar voor afhalen</button>}
                {order.status === "ready_for_pickup" && <button className="primary" onClick={() => void updateOrder(order, "picked_up")}>Opgehaald</button>}
                {["paid", "ready_for_pickup"].includes(order.status) && <button className="danger" onClick={() => void cancelOrder(order)}>Annuleren</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </PagePanel>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <div className="stars" aria-label={`${value} van 5 sterren`}>
      {[1, 2, 3, 4, 5].map((star) => <Star key={star} size={18} className={star <= value ? "starIcon active" : "starIcon"} fill="currentColor" />)}
    </div>
  );
}

function formatLocal(value: string) {
  return new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
