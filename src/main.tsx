import React from "react";
import ReactDOM from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import { BarChart3, CalendarDays, Clock, Inbox, LockKeyhole, Scissors, ShoppingBag, Star, Users } from "lucide-react";
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
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

const eur = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });

function cents(value: number) {
  return eur.format(value / 100);
}

function isoDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function App() {
  const [path, setPath] = React.useState(window.location.pathname);

  React.useEffect(() => {
    if (window.location.pathname === "/") {
      window.history.replaceState({}, "", "/admin");
      setPath("/admin");
      return;
    }
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  if (!path.startsWith("/admin")) {
    window.history.replaceState({}, "", "/admin");
    return <AdminPage path="/admin" />;
  }

  return <AdminPage path={path} />;
}

function AdminPage({ path }: { path: string }) {
  const section = path.split("/")[2] || "agenda";
  const isLoginRoute = path === "/admin/login";
  const [allowed, setAllowed] = React.useState(false);
  const [checking, setChecking] = React.useState(true);
  const [email, setEmail] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [denied, setDenied] = React.useState(false);

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      if (!user) {
        setChecking(false);
        return;
      }
      const role = (user.app_metadata as { app_role?: string } | undefined)?.app_role;
      if (role === "admin") {
        setAllowed(true);
        if (isLoginRoute) {
          window.history.replaceState({}, "", "/admin");
        }
      }
      else setDenied(true);
      setChecking(false);
    });
  }, [isLoginRoute]);

  async function sendLogin() {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/admin/login` },
    });
    if (!error) setSent(true);
  }

  if (checking) return <LovableLogin email={email} sent={sent} denied={false} checking={checking} onEmailChange={setEmail} onSubmit={sendLogin} />;
  if (denied) return <LovableLogin email={email} sent={sent} denied={denied} checking={false} onEmailChange={setEmail} onSubmit={sendLogin} />;
  if (!allowed || isLoginRoute) {
    return <LovableLogin email={email} sent={sent} denied={false} checking={false} onEmailChange={setEmail} onSubmit={sendLogin} />;
  }

  const nav = [
    ["agenda", "Agenda", CalendarDays],
    ["boekingen", "Boekingen", Clock],
    ["klanten", "Klanten", Users],
    ["diensten", "Diensten", Scissors],
    ["webshop", "Webshop", ShoppingBag],
    ["aankondigingen", "Aankondigingen", CalendarDays],
    ["reviews", "Reviews", Star],
    ["statistieken", "Statistieken", BarChart3],
    ["beschikbaarheid", "Beschikbaarheid", Clock],
  ] as const;

  return (
    <AdminFrame section={section} nav={nav}>
        {section === "agenda" || section === "boekingen" ? <AdminAgenda /> : null}
        {section === "beschikbaarheid" ? <AdminAvailability /> : null}
        {section === "diensten" ? <AdminServices /> : null}
        {section === "klanten" ? <AdminClients /> : null}
        {section === "aankondigingen" ? <AdminAnnouncements /> : null}
        {section === "reviews" ? <AdminReviews /> : null}
        {section === "statistieken" ? <AdminStats /> : null}
        {section === "webshop" ? <AdminWebshop /> : null}
    </AdminFrame>
  );
}

function LovableLogin({
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
    <main className="min-h-screen bg-background text-foreground grid place-items-center p-4">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="h-12 w-12 rounded-xl bg-primary/15 text-primary grid place-items-center mb-4">
          <LockKeyhole className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-black tracking-tight">BarberFlow Admin</h1>
        <p className="text-sm text-muted-foreground mt-2">Log in met je beheerdersmail. Daarna controleren we je admin-rol.</p>
        {denied ? <div className="notice dangerNotice">Geen toegang</div> : null}
        {sent ? (
          <div className="notice successNotice">Check je mail voor de magic link.</div>
        ) : (
          <div className="grid gap-3 mt-5">
            <Input value={email} onChange={(event) => onEmailChange(event.target.value)} type="email" placeholder="owner@rwcutzz.nl" />
            <Button disabled={!email || checking} onClick={onSubmit}>{checking ? "Controleren..." : "Magic link sturen"}</Button>
          </div>
        )}
      </section>
    </main>
  );
}

function AdminFrame({ children }: { section: string; nav: readonly any[]; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <FullSidebar />
      <SideRail />
      <main className="flex-1 flex flex-col min-w-0 pb-20 md:pb-0">
        <div className="flex-1 animate-page-in">{children}</div>
      </main>
      <BottomTabBar />
    </div>
  );
}

function PagePanel({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode }) {
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

function AdminAgenda() {
  const [view, setView] = React.useState<"day" | "week">("day");
  const [date, setDate] = React.useState(isoDate());
  const [data, setData] = React.useState<{ bookings: AdminBooking[]; blocked_slots: any[]; services: Service[] }>({ bookings: [], blocked_slots: [], services: [] });
  const [detail, setDetail] = React.useState<AdminBooking | null>(null);
  const [manual, setManual] = React.useState(false);
  const [message, setMessage] = React.useState("");

  React.useEffect(() => { load(); }, [date, view]);

  async function load() {
    const from = new Date(`${date}T00:00:00`).toISOString();
    const toDate = new Date(`${date}T00:00:00`);
    toDate.setDate(toDate.getDate() + (view === "week" ? 7 : 1));
    const { data: payload } = await supabase.functions.invoke("admin-dashboard-data", { body: { from, to: toDate.toISOString() } });
    if (payload?.status === 200) setData(payload);
  }

  async function updateStatus(booking: AdminBooking, new_status: string, refund_policy = "none") {
    const { data: result } = await supabase.functions.invoke("admin-update-booking-status", { body: { booking_id: booking.id, new_status, refund_policy } });
    setMessage(result?.status === 200 ? "Boeking bijgewerkt." : "Bijwerken lukte niet.");
    setDetail(null);
    load();
  }

  return <PagePanel title="Agenda" subtitle="Dag- en weekplanning met live boekingen en blokkades." actions={<><FilterChips chips={[{ value: "day", label: "Dag" }, { value: "week", label: "Week" }]} value={view} onChange={(next) => setView(next as "day" | "week")} className="adminChips" /><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /><button className="primary" onClick={() => setManual(true)}>Handmatige boeking</button></>}>{message && <div className="notice">{message}</div>}<div className="calendarList">{data.blocked_slots.map((b) => <div className="blockedBar" key={b.id}>{formatLocal(b.starts_at)} - blokkade: {b.reason}</div>)}{data.bookings.length === 0 && data.blocked_slots.length === 0 ? <EmptyPanel>Geen boekingen of blokkades in deze periode.</EmptyPanel> : null}{data.bookings.map((b) => { const name = b.customer_name || b.customer_email; return <button className="bookingBlock lovableBookingCard lovableBookingRow" key={b.id} onClick={() => setDetail(b)}><AvatarInitials name={name} /><span className="bookingCopy"><strong>{name}</strong><small>{b.service_name} - {formatLocal(b.starts_at)}</small></span><StatusBadge status={b.status} /></button>; })}</div>{detail && <div className="modal"><div className="modalPanel"><h2>{detail.customer_name || detail.customer_email}</h2><p>{detail.service_name} - {formatLocal(detail.starts_at)}</p><p>Aanbetaling betaald: {cents(detail.deposit_cents)} - Restbedrag: {cents(Math.max(detail.price_cents - detail.deposit_cents, 0))}</p><StatusBadge status={detail.status} /><div className="actions"><button className="primary" onClick={() => updateStatus(detail, "completed")}>Afgerond</button><button className="secondary" onClick={() => updateStatus(detail, "no_show")}>No-show</button><button className="danger" onClick={() => updateStatus(detail, "cancelled", detail.source === "manual" ? "none" : "credit")}>Annuleren</button><button className="secondary" onClick={() => setDetail(null)}>Sluiten</button></div></div></div>}{manual && <ManualBooking services={data.services} onClose={() => setManual(false)} onDone={() => { setManual(false); load(); }} />}</PagePanel>;
}

function ManualBooking({ services, onClose, onDone }: { services: Service[]; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = React.useState({ service_id: services[0]?.id ?? "", starts_at: "", full_name: "", email: "", phone_e164: "" });
  const [message, setMessage] = React.useState("");
  async function createManual() {
    const { data } = await supabase.functions.invoke("admin-manual-booking", { body: form });
    if (data?.status === 201) onDone(); else setMessage("Tijdstip is al bezet");
  }
  return <div className="modal"><div className="modalPanel lovableSheet"><h2>Handmatige boeking</h2>{message && <div className="notice">{message}</div>}<select value={form.service_id} onChange={(e) => setForm({ ...form, service_id: e.target.value })}>{services.map(s => <option value={s.id} key={s.id}>{s.name}</option>)}</select><input type="datetime-local" onChange={(e) => setForm({ ...form, starts_at: new Date(e.target.value).toISOString() })} /><input placeholder="Naam" onChange={(e) => setForm({ ...form, full_name: e.target.value })} /><input placeholder="E-mail" onChange={(e) => setForm({ ...form, email: e.target.value })} /><input placeholder="Telefoon" onChange={(e) => setForm({ ...form, phone_e164: e.target.value })} /><div className="actions"><button className="secondary" onClick={onClose}>Sluiten</button><button className="primary" onClick={createManual}>Opslaan</button></div></div></div>;
}

function AdminAvailability() {
  const [data, setData] = React.useState<{ rules: any[]; blocked_slots: any[]; day_overrides: any[] }>({ rules: [], blocked_slots: [], day_overrides: [] });
  const [rule, setRule] = React.useState({ id: "", weekday: 1, opens_at: "09:00", closes_at: "18:00", is_active: true, max_bookings_per_day: "" });
  const [block, setBlock] = React.useState({ starts_at: "", ends_at: "", reason: "" });
  const [override, setOverride] = React.useState({ date: isoDate(), is_closed: false, opens_at: "", closes_at: "", max_bookings: "", note: "" });
  const [range, setRange] = React.useState({ date_from: isoDate(), date_to: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) });
  const [conflicts, setConflicts] = React.useState<any[]>([]);
  const weekdays = ["Zo", "Ma", "Di", "Wo", "Do", "Vr", "Za"];
  React.useEffect(() => { load(); }, []);
  async function load() {
    const { data } = await supabase.functions.invoke("admin-manage-availability", { body: { action: "list", payload: range } });
    if (data?.status === 200) setData({ rules: data.rules ?? [], blocked_slots: data.blocked_slots ?? [], day_overrides: data.day_overrides ?? [] });
  }
  async function saveRule() {
    const existing = data.rules.find((item) => item.id === rule.id || item.weekday === rule.weekday);
    const payload = {
      ...rule,
      id: existing?.id ?? rule.id,
      max_bookings_per_day: rule.max_bookings_per_day === "" ? null : Number(rule.max_bookings_per_day),
    };
    await supabase.functions.invoke("admin-manage-availability", { body: { action: existing ? "update_rule" : "create_rule", payload } });
    setRule({ id: "", weekday: 1, opens_at: "09:00", closes_at: "18:00", is_active: true, max_bookings_per_day: "" });
    load();
  }
  async function setMaxBookings(weekday: number, value: string) {
    await supabase.functions.invoke("admin-manage-availability", {
      body: { action: "set_max_bookings", weekday, max_bookings_per_day: value === "" ? null : Number(value) },
    });
    load();
  }
  async function addBlock() { const { data } = await supabase.functions.invoke("admin-manage-availability", { body: { action: "create_blocked_slot", payload: { starts_at: new Date(block.starts_at).toISOString(), ends_at: new Date(block.ends_at).toISOString(), reason: block.reason } } }); setConflicts(data?.conflicts ?? []); load(); }
  async function deleteBlock(id: string) { await supabase.functions.invoke("admin-manage-availability", { body: { action: "delete_blocked_slot", payload: { id } } }); load(); }
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
    load();
  }
  async function deleteOverride(date: string) {
    await supabase.functions.invoke("admin-manage-availability", { body: { action: "delete_override", date } });
    load();
  }
  return <PagePanel title="Beschikbaarheid" subtitle="Beheer weekrooster, dag-overrides, maximale boekingen per dag en blokkades." actions={<button className="secondary" onClick={load}>Vernieuwen</button>}><h2>Weekrooster</h2><div className="actions"><select value={rule.weekday} onChange={e => setRule({ ...rule, weekday: Number(e.target.value) })}>{weekdays.map((d, i) => <option key={d} value={i}>{d}</option>)}</select><input type="time" value={rule.opens_at} onChange={e => setRule({ ...rule, opens_at: e.target.value })} /><input type="time" value={rule.closes_at} onChange={e => setRule({ ...rule, closes_at: e.target.value })} /><input type="number" min="0" placeholder="Max boekingen/dag" value={rule.max_bookings_per_day} onChange={e => setRule({ ...rule, max_bookings_per_day: e.target.value })} /><label><input type="checkbox" checked={rule.is_active} onChange={e => setRule({ ...rule, is_active: e.target.checked })} /> Actief</label><button className="primary" onClick={saveRule}>Regel opslaan</button></div><div className="table">{data.rules.map(r => <div className="tableRow lovableDataRow" key={r.id}><span>{weekdays[r.weekday] ?? `Dag ${r.weekday}`}</span><span>{r.opens_at} - {r.closes_at}</span><StatusPill status={r.is_active ? "confirmed" : "cancelled"} /><span>Max: {r.max_bookings_per_day ?? "geen limiet"}</span><input type="number" min="0" placeholder="Nieuw max" onBlur={e => setMaxBookings(r.weekday, e.target.value)} /><button className="secondary" onClick={() => setRule({ id: r.id, weekday: r.weekday, opens_at: r.opens_at?.slice(0, 5), closes_at: r.closes_at?.slice(0, 5), is_active: r.is_active, max_bookings_per_day: r.max_bookings_per_day ?? "" })}>Bewerk</button></div>)}</div><h2>Dag-overrides</h2><div className="actions"><input type="date" value={range.date_from} onChange={e => setRange({ ...range, date_from: e.target.value })} /><input type="date" value={range.date_to} onChange={e => setRange({ ...range, date_to: e.target.value })} /><button className="secondary" onClick={load}>Periode laden</button></div><div className="formGrid"><input type="date" value={override.date} onChange={e => setOverride({ ...override, date: e.target.value })} /><input type="time" value={override.opens_at} disabled={override.is_closed} onChange={e => setOverride({ ...override, opens_at: e.target.value })} /><input type="time" value={override.closes_at} disabled={override.is_closed} onChange={e => setOverride({ ...override, closes_at: e.target.value })} /><input type="number" min="0" placeholder="Max boekingen" value={override.max_bookings} onChange={e => setOverride({ ...override, max_bookings: e.target.value })} /><input placeholder="Notitie" value={override.note} onChange={e => setOverride({ ...override, note: e.target.value })} /><label><input type="checkbox" checked={override.is_closed} onChange={e => setOverride({ ...override, is_closed: e.target.checked })} /> Gesloten</label></div><button className="primary" onClick={saveOverride}>Override opslaan</button><div className="table">{data.day_overrides.length === 0 ? <EmptyPanel>Geen dag-overrides in deze periode.</EmptyPanel> : data.day_overrides.map(o => <div className="tableRow lovableDataRow" key={o.id}><span>{o.override_date}</span><span>{o.is_closed ? "Gesloten" : `${o.opens_at ?? "-"} - ${o.closes_at ?? "-"}`}</span><span>Max: {o.max_bookings ?? "geen limiet"}</span><span>{o.note ?? ""}</span><button className="danger" onClick={() => deleteOverride(o.override_date)}>Verwijder</button></div>)}</div><h2>Blokkades</h2><div className="formGrid"><input type="datetime-local" onChange={(e) => setBlock({ ...block, starts_at: e.target.value })} /><input type="datetime-local" onChange={(e) => setBlock({ ...block, ends_at: e.target.value })} /><input placeholder="Reden" onChange={(e) => setBlock({ ...block, reason: e.target.value })} /></div><button className="primary" onClick={addBlock}>Blokkade toevoegen</button>{conflicts.length > 0 && <div className="notice">Conflicten gevonden: {conflicts.map(c => c.customer_name).join(", ")}. Los deze op via boekingsdetails.</div>}<div className="table">{data.blocked_slots.length === 0 ? <EmptyPanel>Geen aankomende blokkades.</EmptyPanel> : data.blocked_slots.map(b => <div className="tableRow lovableDataRow" key={b.id}><span>{formatLocal(b.starts_at)}</span><span>{formatLocal(b.ends_at)}</span><span>{b.reason}</span><button className="danger" onClick={() => deleteBlock(b.id)}>Verwijder</button></div>)}</div></PagePanel>;
}

function AdminServices() {
  const [services, setServices] = React.useState<any[]>([]);
  const [form, setForm] = React.useState<any>({ name: "", description: "", price_cents: 0, duration_minutes: 30, buffer_minutes: 0, deposit_type: "fixed", deposit_value: 0, is_active: true });
  React.useEffect(() => { load(); }, []);
  async function load() { const { data } = await supabase.functions.invoke("admin-manage-services", { body: { action: "list" } }); if (data?.status === 200) setServices(data.services); }
  async function save() { await supabase.functions.invoke("admin-manage-services", { body: { action: "upsert", payload: form } }); setForm({ name: "", description: "", price_cents: 0, duration_minutes: 30, buffer_minutes: 0, deposit_type: "fixed", deposit_value: 0, is_active: true }); load(); }
  return <PagePanel title="Diensten" subtitle="Beheer behandelingen, prijzen en aanbetalingen."><div className="formGrid"><input placeholder="Naam" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /><input placeholder="Prijs in centen" type="number" value={form.price_cents} onChange={e => setForm({ ...form, price_cents: Number(e.target.value) })} /><input placeholder="Duur" type="number" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: Number(e.target.value) })} /></div><div className="actions"><select value={form.deposit_type} onChange={e => setForm({ ...form, deposit_type: e.target.value })}><option value="fixed">Vast</option><option value="percentage">Percentage</option></select><input placeholder="Aanbetaling" type="number" value={form.deposit_value} onChange={e => setForm({ ...form, deposit_value: Number(e.target.value) })} /><label><input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} /> Actief</label><button className="primary" onClick={save}>Opslaan</button></div><div className="table">{services.length === 0 ? <EmptyPanel>Geen diensten gevonden.</EmptyPanel> : services.map(s => <button className="tableRow lovableDataRow" key={s.id} onClick={() => setForm(s)}><span>{s.name}</span><span>{cents(s.price_cents)}</span><span>{s.upcoming_count} aankomend</span><StatusPill status={s.is_active ? "confirmed" : "cancelled"} /></button>)}</div></PagePanel>;
}

function AdminClients() {
  const [q, setQ] = React.useState("");
  const [customers, setCustomers] = React.useState<any[]>([]);
  React.useEffect(() => { load(); }, []);
  async function load(nextQ = q) { const { data } = await supabase.functions.invoke("admin-client-data", { body: { action: "list", payload: { q: nextQ } } }); if (data?.status === 200) setCustomers(data.customers); }
  async function update(c: any, patch: any) { await supabase.functions.invoke("admin-client-data", { body: { action: "update", payload: { id: c.id, ...patch } } }); load(); }
  return <PagePanel title="Klanten" subtitle="Zoek klanten, tegoeden, notities en blokkades." actions={<input placeholder="Zoeken" value={q} onChange={e => { setQ(e.target.value); load(e.target.value); }} />}><div className="table">{customers.length === 0 ? <EmptyPanel>Geen klanten gevonden.</EmptyPanel> : customers.map(c => { const name = c.full_name || c.email; return <div className="tableRow clientRow lovableDataRow" key={c.id}><span className="clientIdentity"><AvatarInitials name={name} size="sm" /><strong>{name}</strong></span><span>{c.email}</span><span>{c.phone_e164 || "-"}</span><span>{c.visit_count} bezoeken</span><span>{c.last_visit_at ? formatLocal(c.last_visit_at) : "-"}</span><span>{cents(c.credit_cents)}</span><label><input type="checkbox" checked={c.is_blocked} onChange={e => update(c, { is_blocked: e.target.checked })} /> Geblokkeerd</label><input defaultValue={c.notes || ""} onBlur={e => update(c, { notes: e.target.value })} /></div>; })}</div></PagePanel>;
}

function AdminAnnouncements() {
  const month = new Intl.DateTimeFormat("nl-NL", { month: "long" }).format(new Date());
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [message, setMessage] = React.useState("");
  async function send() { const { data } = await supabase.functions.invoke("send-broadcast", { body: { title, body } }); setMessage(`Verzonden: ${data?.sent ?? 0}, mislukt: ${data?.failed ?? 0}`); }
  return <PagePanel title="Aankondigingen" subtitle="Maak broadcasts met preview en stuur naar opt-in klanten." actions={<><button className="secondary" onClick={() => { setTitle(`De agenda voor ${month} staat open`); setBody(`Je kunt nu boeken via ${window.location.origin}`); }}>Agenda open</button><button className="primary" onClick={send}>Broadcast versturen</button></>}>{message && <div className="notice">{message}</div>}<input placeholder="Titel" value={title} onChange={e => setTitle(e.target.value)} /><div className="editorToolbar"><button type="button" onClick={() => document.execCommand("bold")}>B</button><button type="button" onClick={() => document.execCommand("italic")}>I</button></div><div className="editor" contentEditable onInput={e => setBody(e.currentTarget.innerHTML)}>{body}</div><h2>Preview</h2><div className="preview lovablePreview"><h3>{title}</h3><div dangerouslySetInnerHTML={{ __html: body }} /></div></PagePanel>;
}

function AdminReviews() {
  const [reviews, setReviews] = React.useState<any[]>([]);
  const [filter, setFilter] = React.useState("all");
  React.useEffect(() => { load(); }, [filter]);
  async function load() {
    const payload = filter === "all" ? {} : { is_visible: filter === "visible" };
    const { data } = await supabase.functions.invoke("admin-manage-reviews", { body: { action: "list", payload } });
    if (data?.status === 200) setReviews(data.reviews);
  }
  async function toggle(review: any) {
    await supabase.functions.invoke("admin-manage-reviews", { body: { action: "toggle", payload: { id: review.id, is_visible: !review.is_visible } } });
    load();
  }
  return <PagePanel title="Reviews" subtitle="Publiceer of verberg klantbeoordelingen." actions={<FilterChips chips={[{ value: "all", label: "Alle reviews" }, { value: "visible", label: "Gepubliceerd" }, { value: "hidden", label: "In behandeling" }]} value={filter} onChange={setFilter} className="adminChips" />}><div className="table">{reviews.length === 0 ? <EmptyPanel>Geen reviews gevonden.</EmptyPanel> : reviews.map((review) => <div className="tableRow reviewRow lovableDataRow" key={review.id}><span>{review.full_name || review.email}</span><span>{review.service_name} - {formatLocal(review.starts_at)}</span><span><Stars value={review.rating} /></span><p>{review.body}</p><label><input type="checkbox" checked={review.is_visible} onChange={() => toggle(review)} /> Gepubliceerd</label></div>)}</div></PagePanel>;
}

function AdminStats() {
  const now = new Date();
  const [from, setFrom] = React.useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = React.useState(new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10));
  const [stats, setStats] = React.useState<any>(null);
  const [mollie, setMollie] = React.useState<any>(null);
  React.useEffect(() => { load(); }, []);
  async function load() {
    const body = { date_from: new Date(from).toISOString(), date_to: new Date(to).toISOString() };
    const [{ data: statsData }, { data: mollieData }] = await Promise.all([
      supabase.functions.invoke("admin-stats", { body }),
      supabase.functions.invoke("admin-mollie-payments", { body }),
    ]);
    if (statsData?.status === 200) setStats(statsData);
    if (mollieData?.status === 200) setMollie(mollieData);
  }
  return <PagePanel title="Statistieken" subtitle="Live omzet, boekingen en klanttrends." actions={<><input type="date" value={from} onChange={e => setFrom(e.target.value)} /><input type="date" value={to} onChange={e => setTo(e.target.value)} /><button className="primary" onClick={load}>Vernieuwen</button></>}>{stats ? <div className="metrics adminMetrics lovableMetrics"><KPICard label="Boekingen" value={String(stats.bookings.total)} icon={CalendarDays} /><KPICard label="No-show" value={`${stats.no_show_pct}%`} icon={Clock} positive={false} /><KPICard label="Aanbetalingen" value={cents(stats.deposit_revenue_cents)} icon={ShoppingBag} /><KPICard label="Platform fee" value={cents(stats.platform_fee_cents)} icon={BarChart3} /><KPICard label="Terugkeer" value={`${stats.return_rate_pct}%`} icon={Users} /><KPICard label="Nieuwe klanten" value={String(stats.new_customers)} icon={Users} /></div> : <EmptyPanel>Statistieken laden...</EmptyPanel>}{mollie ? <><h2 className="sectionTitle">Mollie betalingen</h2><div className="metrics adminMetrics lovableMetrics"><KPICard label="Test betaald" value={cents(mollie.summary.test.paid_cents)} icon={ShoppingBag} /><KPICard label="Test platform fee" value={cents(mollie.summary.test.platform_fee_cents)} icon={BarChart3} /><KPICard label="Live betaald" value={cents(mollie.summary.live.paid_cents)} icon={ShoppingBag} /><KPICard label="Live platform fee" value={cents(mollie.summary.live.platform_fee_cents)} icon={BarChart3} /></div><div className="table">{mollie.payments.length === 0 ? <EmptyPanel>Geen Mollie-betalingen in deze periode.</EmptyPanel> : mollie.payments.map((payment: any) => <div className="tableRow lovableDataRow" key={payment.id}><span>{payment.customer_name || payment.customer_email}</span><span>{payment.service_name}</span><span>{cents(payment.amount_cents)}</span><span>{payment.payment_mode === "live" ? "Live" : "Test"}</span><StatusPill status={payment.status} /></div>)}</div></> : null}</PagePanel>;
}

function AdminWebshop() {
  const [tab, setTab] = React.useState<"products" | "orders">("products");
  const [products, setProducts] = React.useState<Product[]>([]);
  const [orders, setOrders] = React.useState<any[]>([]);
  const [form, setForm] = React.useState<any>({ name: "", description: "", price_cents: 0, stock: 0, stock_adjustment: 0, is_active: true, category: "general", image_paths: [] });
  const [message, setMessage] = React.useState("");
  React.useEffect(() => { loadProducts(); loadOrders(); }, []);
  async function loadProducts() { const { data } = await supabase.functions.invoke("admin-manage-products", { body: { action: "list" } }); if (data?.status === 200) setProducts(data.products); }
  async function loadOrders() { const { data } = await supabase.functions.invoke("admin-manage-orders", { body: { action: "list", payload: {} } }); if (data?.status === 200) setOrders(data.orders); }
  async function saveProduct() { await supabase.functions.invoke("admin-manage-products", { body: { action: "upsert", payload: form } }); setForm({ name: "", description: "", price_cents: 0, stock: 0, stock_adjustment: 0, is_active: true, category: "general", image_paths: [] }); loadProducts(); }
  async function updateOrder(order: any, status: string) { await supabase.functions.invoke("admin-manage-orders", { body: { action: "update_status", payload: { order_id: order.id, status } } }); loadOrders(); }
  async function cancelOrder(order: any) {
    const { data } = await supabase.functions.invoke("admin-manage-orders", { body: { action: "cancel_order", payload: { order_id: order.id } } });
    setMessage(data?.status === 200 ? "Bestelling geannuleerd." : "Annuleren lukte niet.");
    loadOrders();
  }
  const imagePath = form.image_paths?.[0] ?? "";
  return <PagePanel title="Webshop" subtitle="Producten, voorraad en afhaalorders." actions={<FilterChips chips={[{ value: "products", label: "Producten", count: products.length }, { value: "orders", label: "Bestellingen", count: orders.length }]} value={tab} onChange={(next) => setTab(next as "products" | "orders")} className="adminChips" />}>{message && <div className="notice">{message}</div>}{tab === "products" ? <><div className="formGrid"><input placeholder="Naam" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /><input placeholder="Prijs centen" type="number" value={form.price_cents} onChange={e => setForm({ ...form, price_cents: Number(e.target.value) })} /><input placeholder="Voorraad" type="number" value={form.stock} onChange={e => setForm({ ...form, stock: Number(e.target.value) })} /><input placeholder="Afbeelding URL of storage-pad" value={imagePath} onChange={e => setForm({ ...form, image_paths: e.target.value ? [e.target.value] : [] })} /></div><div className="actions"><input placeholder="Stock +/-" type="number" value={form.stock_adjustment} onChange={e => setForm({ ...form, stock_adjustment: Number(e.target.value) })} /><select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}><option value="general">Algemeen</option><option value="sealed_cosmetics">Verzegelde cosmetica</option></select><label><input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} /> Actief</label><button className="primary" onClick={saveProduct}>Product opslaan</button></div><div className="table">{products.length === 0 ? <EmptyPanel>Geen producten gevonden.</EmptyPanel> : products.map(p => <button className="tableRow lovableDataRow" key={p.id} onClick={() => setForm({ ...p, stock_adjustment: 0 })}><span>{p.name}</span><span>{cents(p.price_cents)}</span><span>Stock {p.stock}</span><span>{p.category}</span><StatusPill status={p.is_active ? "confirmed" : "cancelled"} /></button>)}</div></> : <div className="table">{orders.length === 0 ? <EmptyPanel>Geen bestellingen gevonden.</EmptyPanel> : orders.map(o => <div className="tableRow lovableDataRow" key={o.id}><span>{o.email}</span><span>{o.items_summary}</span><span>{cents(o.total_cents)}</span><StatusPill status={o.status} /><div className="actions">{o.status === "paid" && <button className="primary" onClick={() => updateOrder(o, "ready_for_pickup")}>Klaar voor afhalen</button>}{o.status === "ready_for_pickup" && <button className="primary" onClick={() => updateOrder(o, "picked_up")}>Opgehaald</button>}{["paid","ready_for_pickup"].includes(o.status) && <button className="danger" onClick={() => cancelOrder(o)}>Annuleren</button>}</div></div>)}</div>}</PagePanel>;
}

function Stars({ value }: { value: number }) {
  return <div className="stars" aria-label={`${value} van 5 sterren`}>{[1, 2, 3, 4, 5].map((star) => <Star key={star} size={18} className={star <= value ? "starIcon active" : "starIcon"} fill="currentColor" />)}</div>;
}

function formatLocal(value: string) {
  return new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="page">{children}</div>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
