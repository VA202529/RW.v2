import React from "react";
import ReactDOM from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import { BarChart3, Bell, CalendarDays, Clock, LogIn, Menu, Scissors, Settings, ShoppingBag, Star, Users } from "lucide-react";
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
      if (role === "admin") setAllowed(true);
      else setDenied(true);
      setChecking(false);
    });
  }, []);

  async function sendLogin() {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/admin` },
    });
    if (!error) setSent(true);
  }

  if (checking) return <Shell><section className="state"><p>Admin controleren...</p></section></Shell>;
  if (denied) return <Shell><section className="state"><h1>Geen toegang</h1><p>Deze omgeving is alleen beschikbaar voor beheerders.</p></section></Shell>;
  if (!allowed) {
    return (
      <Shell>
        <section className="state">
          <LogIn className="stateIcon" />
          <h1>Admin login</h1>
          <p>Log in met je beheerdersadres. De server blijft alle adminacties afdwingen.</p>
          <div className="loginRow">
            <input aria-label="E-mail" placeholder="admin@example.com" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            <button className="primary" disabled={!email} onClick={sendLogin}>Link sturen</button>
          </div>
          {sent && <div className="notice">Check je mail voor de magic link.</div>}
        </section>
      </Shell>
    );
  }

  const nav = [
    ["agenda", "Agenda", CalendarDays],
    ["boekingen", "Boekingen", Clock],
    ["klanten", "Klanten", Users],
    ["diensten", "Diensten", Scissors],
    ["webshop", "Webshop", ShoppingBag],
    ["aankondigingen", "Aankondigingen", Bell],
    ["reviews", "Reviews", Star],
    ["statistieken", "Statistieken", BarChart3],
    ["beschikbaarheid", "Beschikbaarheid", Settings],
  ] as const;

  return (
    <div className="adminShell">
      <aside className="adminSide">
        <div className="brand"><Scissors size={22} /> BarberFlow</div>
        {nav.map(([id, label, Icon]) => (
          <a key={id} className={section === id ? "adminNav active" : "adminNav"} href={id === "agenda" ? "/admin" : `/admin/${id}`}>
            <Icon size={18} /> {label}
          </a>
        ))}
      </aside>
      <main className="adminMain">
        {section === "agenda" || section === "boekingen" ? <AdminAgenda /> : null}
        {section === "beschikbaarheid" ? <AdminAvailability /> : null}
        {section === "diensten" ? <AdminServices /> : null}
        {section === "klanten" ? <AdminClients /> : null}
        {section === "aankondigingen" ? <AdminAnnouncements /> : null}
        {section === "reviews" ? <AdminReviews /> : null}
        {section === "statistieken" ? <AdminStats /> : null}
        {section === "webshop" ? <AdminWebshop /> : null}
      </main>
      <nav className="adminBottom">
        {nav.slice(0, 4).map(([id, label, Icon]) => <a key={id} href={id === "agenda" ? "/admin" : `/admin/${id}`}><Icon size={18} /><span>{label}</span></a>)}
        <a href="/admin/statistieken"><BarChart3 size={18} /><span>Stats</span></a>
        <button type="button"><Menu size={18} /><span>Meer</span></button>
      </nav>
    </div>
  );
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

  return <section><div className="adminHeader"><h1>Agenda</h1><div className="actions"><button className={view === "day" ? "primary" : "secondary"} onClick={() => setView("day")}>Dag</button><button className={view === "week" ? "primary" : "secondary"} onClick={() => setView("week")}>Week</button><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /><button className="primary" onClick={() => setManual(true)}>Handmatige boeking</button></div></div>{message && <div className="notice">{message}</div>}<div className="calendarList">{data.blocked_slots.map((b) => <div className="blockedBar" key={b.id}>{formatLocal(b.starts_at)} - blokkade: {b.reason}</div>)}{data.bookings.map((b) => <button className="bookingBlock" key={b.id} onClick={() => setDetail(b)}><strong>{b.customer_name || b.customer_email}</strong><span>{b.service_name} - {formatLocal(b.starts_at)}</span><small className={`badge ${b.status}`}>{b.status}</small></button>)}</div>{detail && <div className="modal"><div className="modalPanel"><h2>{detail.customer_name || detail.customer_email}</h2><p>{detail.service_name} - {formatLocal(detail.starts_at)}</p><p>Aanbetaling betaald: {cents(detail.deposit_cents)} - Restbedrag: {cents(Math.max(detail.price_cents - detail.deposit_cents, 0))}</p><div className="actions"><button className="primary" onClick={() => updateStatus(detail, "completed")}>Afgerond</button><button className="secondary" onClick={() => updateStatus(detail, "no_show")}>No-show</button><button className="danger" onClick={() => updateStatus(detail, "cancelled", detail.source === "manual" ? "none" : "credit")}>Annuleren</button><button className="secondary" onClick={() => setDetail(null)}>Sluiten</button></div></div></div>}{manual && <ManualBooking services={data.services} onClose={() => setManual(false)} onDone={() => { setManual(false); load(); }} />}</section>;
}

function ManualBooking({ services, onClose, onDone }: { services: Service[]; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = React.useState({ service_id: services[0]?.id ?? "", starts_at: "", full_name: "", email: "", phone_e164: "" });
  const [message, setMessage] = React.useState("");
  async function createManual() {
    const { data } = await supabase.functions.invoke("admin-manual-booking", { body: form });
    if (data?.status === 201) onDone(); else setMessage("Tijdstip is al bezet");
  }
  return <div className="modal"><div className="modalPanel"><h2>Handmatige boeking</h2>{message && <div className="notice">{message}</div>}<select value={form.service_id} onChange={(e) => setForm({ ...form, service_id: e.target.value })}>{services.map(s => <option value={s.id} key={s.id}>{s.name}</option>)}</select><input type="datetime-local" onChange={(e) => setForm({ ...form, starts_at: new Date(e.target.value).toISOString() })} /><input placeholder="Naam" onChange={(e) => setForm({ ...form, full_name: e.target.value })} /><input placeholder="E-mail" onChange={(e) => setForm({ ...form, email: e.target.value })} /><input placeholder="Telefoon" onChange={(e) => setForm({ ...form, phone_e164: e.target.value })} /><div className="actions"><button className="secondary" onClick={onClose}>Sluiten</button><button className="primary" onClick={createManual}>Opslaan</button></div></div></div>;
}

function AdminAvailability() {
  const [data, setData] = React.useState<{ rules: any[]; blocked_slots: any[] }>({ rules: [], blocked_slots: [] });
  const [rule, setRule] = React.useState({ weekday: 1, opens_at: "09:00", closes_at: "18:00", is_active: true });
  const [block, setBlock] = React.useState({ starts_at: "", ends_at: "", reason: "" });
  const [conflicts, setConflicts] = React.useState<any[]>([]);
  React.useEffect(() => { load(); }, []);
  async function load() { const { data } = await supabase.functions.invoke("admin-manage-availability", { body: { action: "list" } }); if (data?.status === 200) setData(data); }
  async function saveRule() { await supabase.functions.invoke("admin-manage-availability", { body: { action: "create_rule", payload: rule } }); load(); }
  async function addBlock() { const { data } = await supabase.functions.invoke("admin-manage-availability", { body: { action: "create_blocked_slot", payload: { starts_at: new Date(block.starts_at).toISOString(), ends_at: new Date(block.ends_at).toISOString(), reason: block.reason } } }); setConflicts(data?.conflicts ?? []); load(); }
  return <section><h1>Beschikbaarheid</h1><h2>Openingstijden</h2><div className="actions"><select value={rule.weekday} onChange={e => setRule({ ...rule, weekday: Number(e.target.value) })}>{["Zo","Ma","Di","Wo","Do","Vr","Za"].map((d, i) => <option key={d} value={i}>{d}</option>)}</select><input type="time" value={rule.opens_at} onChange={e => setRule({ ...rule, opens_at: e.target.value })} /><input type="time" value={rule.closes_at} onChange={e => setRule({ ...rule, closes_at: e.target.value })} /><label><input type="checkbox" checked={rule.is_active} onChange={e => setRule({ ...rule, is_active: e.target.checked })} /> Actief</label><button className="primary" onClick={saveRule}>Regel opslaan</button></div><div className="table">{data.rules.map(r => <div className="tableRow" key={r.id}><span>Dag {r.weekday}</span><span>{r.opens_at} - {r.closes_at}</span><span>{r.is_active ? "Actief" : "Uit"}</span></div>)}</div><h2>Blokkades</h2><div className="formGrid"><input type="datetime-local" onChange={(e) => setBlock({ ...block, starts_at: e.target.value })} /><input type="datetime-local" onChange={(e) => setBlock({ ...block, ends_at: e.target.value })} /><input placeholder="Reden" onChange={(e) => setBlock({ ...block, reason: e.target.value })} /></div><button className="primary" onClick={addBlock}>Blokkade toevoegen</button>{conflicts.length > 0 && <div className="notice">Conflicten gevonden: {conflicts.map(c => c.customer_name).join(", ")}. Los deze op via boekingsdetails.</div>}<div className="table">{data.blocked_slots.map(b => <div className="tableRow" key={b.id}><span>{formatLocal(b.starts_at)}</span><span>{formatLocal(b.ends_at)}</span><span>{b.reason}</span></div>)}</div></section>;
}

function AdminServices() {
  const [services, setServices] = React.useState<any[]>([]);
  const [form, setForm] = React.useState<any>({ name: "", description: "", price_cents: 0, duration_minutes: 30, buffer_minutes: 0, deposit_type: "fixed", deposit_value: 0, is_active: true });
  React.useEffect(() => { load(); }, []);
  async function load() { const { data } = await supabase.functions.invoke("admin-manage-services", { body: { action: "list" } }); if (data?.status === 200) setServices(data.services); }
  async function save() { await supabase.functions.invoke("admin-manage-services", { body: { action: "upsert", payload: form } }); setForm({ name: "", description: "", price_cents: 0, duration_minutes: 30, buffer_minutes: 0, deposit_type: "fixed", deposit_value: 0, is_active: true }); load(); }
  return <section><h1>Diensten</h1><div className="formGrid"><input placeholder="Naam" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /><input placeholder="Prijs in centen" type="number" value={form.price_cents} onChange={e => setForm({ ...form, price_cents: Number(e.target.value) })} /><input placeholder="Duur" type="number" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: Number(e.target.value) })} /></div><div className="actions"><select value={form.deposit_type} onChange={e => setForm({ ...form, deposit_type: e.target.value })}><option value="fixed">Vast</option><option value="percentage">Percentage</option></select><input placeholder="Aanbetaling" type="number" value={form.deposit_value} onChange={e => setForm({ ...form, deposit_value: Number(e.target.value) })} /><label><input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} /> Actief</label><button className="primary" onClick={save}>Opslaan</button></div><div className="table">{services.map(s => <button className="tableRow" key={s.id} onClick={() => setForm(s)}><span>{s.name}</span><span>{cents(s.price_cents)}</span><span>{s.upcoming_count} aankomend</span><span>{s.is_active ? "Actief" : "Inactief"}</span></button>)}</div></section>;
}

function AdminClients() {
  const [q, setQ] = React.useState("");
  const [customers, setCustomers] = React.useState<any[]>([]);
  React.useEffect(() => { load(); }, []);
  async function load(nextQ = q) { const { data } = await supabase.functions.invoke("admin-client-data", { body: { action: "list", payload: { q: nextQ } } }); if (data?.status === 200) setCustomers(data.customers); }
  async function update(c: any, patch: any) { await supabase.functions.invoke("admin-client-data", { body: { action: "update", payload: { id: c.id, ...patch } } }); load(); }
  return <section><h1>Klanten</h1><div className="actions"><input placeholder="Zoeken" value={q} onChange={e => { setQ(e.target.value); load(e.target.value); }} /></div><div className="table">{customers.map(c => <div className="tableRow clientRow" key={c.id}><span>{c.full_name || "-"}</span><span>{c.email}</span><span>{c.phone_e164 || "-"}</span><span>{c.visit_count} bezoeken</span><span>{c.last_visit_at ? formatLocal(c.last_visit_at) : "-"}</span><span>{cents(c.credit_cents)}</span><label><input type="checkbox" checked={c.is_blocked} onChange={e => update(c, { is_blocked: e.target.checked })} /> Geblokkeerd</label><input defaultValue={c.notes || ""} onBlur={e => update(c, { notes: e.target.value })} /></div>)}</div></section>;
}

function AdminAnnouncements() {
  const month = new Intl.DateTimeFormat("nl-NL", { month: "long" }).format(new Date());
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [message, setMessage] = React.useState("");
  async function send() { const { data } = await supabase.functions.invoke("send-broadcast", { body: { title, body } }); setMessage(`Verzonden: ${data?.sent ?? 0}, mislukt: ${data?.failed ?? 0}`); }
  return <section><h1>Aankondigingen</h1><div className="actions"><button className="secondary" onClick={() => { setTitle(`De agenda voor ${month} staat open`); setBody(`Je kunt nu boeken via ${window.location.origin}`); }}>Agenda open</button><button className="primary" onClick={send}>Broadcast versturen</button></div>{message && <div className="notice">{message}</div>}<input placeholder="Titel" value={title} onChange={e => setTitle(e.target.value)} /><div className="editorToolbar"><button type="button" onClick={() => document.execCommand("bold")}>B</button><button type="button" onClick={() => document.execCommand("italic")}>I</button></div><div className="editor" contentEditable onInput={e => setBody(e.currentTarget.innerHTML)}>{body}</div><h2>Preview</h2><div className="preview"><h3>{title}</h3><div dangerouslySetInnerHTML={{ __html: body }} /></div></section>;
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
  return <section><div className="adminHeader"><h1>Reviews</h1><div className="actions"><select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">Alle reviews</option><option value="visible">Gepubliceerd</option><option value="hidden">In behandeling</option></select></div></div><div className="table">{reviews.map((review) => <div className="tableRow reviewRow" key={review.id}><span>{review.full_name || review.email}</span><span>{review.service_name} - {formatLocal(review.starts_at)}</span><span><Stars value={review.rating} /></span><p>{review.body}</p><label><input type="checkbox" checked={review.is_visible} onChange={() => toggle(review)} /> Gepubliceerd</label></div>)}</div></section>;
}

function AdminStats() {
  const now = new Date();
  const [from, setFrom] = React.useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = React.useState(new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10));
  const [stats, setStats] = React.useState<any>(null);
  React.useEffect(() => { load(); }, []);
  async function load() { const { data } = await supabase.functions.invoke("admin-stats", { body: { date_from: new Date(from).toISOString(), date_to: new Date(to).toISOString() } }); if (data?.status === 200) setStats(data); }
  return <section><h1>Statistieken</h1><div className="actions"><input type="date" value={from} onChange={e => setFrom(e.target.value)} /><input type="date" value={to} onChange={e => setTo(e.target.value)} /><button className="primary" onClick={load}>Vernieuwen</button></div>{stats && <div className="metrics adminMetrics"><div><strong>{stats.bookings.total}</strong><span>Boekingen</span></div><div><strong>{stats.no_show_pct}%</strong><span>No-show</span></div><div><strong>{cents(stats.deposit_revenue_cents)}</strong><span>Aanbetalingen</span></div><div><strong>{cents(stats.platform_fee_cents)}</strong><span>Platform fee</span></div><div><strong>{stats.return_rate_pct}%</strong><span>Terugkeer</span></div><div><strong>{stats.new_customers}</strong><span>Nieuwe klanten</span></div></div>}</section>;
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
  return <section><div className="adminHeader"><h1>Webshop</h1><div className="actions"><button className={tab === "products" ? "primary" : "secondary"} onClick={() => setTab("products")}>Producten</button><button className={tab === "orders" ? "primary" : "secondary"} onClick={() => setTab("orders")}>Bestellingen</button></div></div>{message && <div className="notice">{message}</div>}{tab === "products" ? <><div className="formGrid"><input placeholder="Naam" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /><input placeholder="Prijs centen" type="number" value={form.price_cents} onChange={e => setForm({ ...form, price_cents: Number(e.target.value) })} /><input placeholder="Voorraad" type="number" value={form.stock} onChange={e => setForm({ ...form, stock: Number(e.target.value) })} /><input placeholder="Afbeelding URL of storage-pad" value={imagePath} onChange={e => setForm({ ...form, image_paths: e.target.value ? [e.target.value] : [] })} /></div><div className="actions"><input placeholder="Stock +/-" type="number" value={form.stock_adjustment} onChange={e => setForm({ ...form, stock_adjustment: Number(e.target.value) })} /><select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}><option value="general">Algemeen</option><option value="sealed_cosmetics">Verzegelde cosmetica</option></select><label><input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} /> Actief</label><button className="primary" onClick={saveProduct}>Product opslaan</button></div><div className="table">{products.map(p => <button className="tableRow" key={p.id} onClick={() => setForm({ ...p, stock_adjustment: 0 })}><span>{p.name}</span><span>{cents(p.price_cents)}</span><span>Stock {p.stock}</span><span>{p.category}</span><span>{p.is_active ? "Actief" : "Inactief"}</span></button>)}</div></> : <div className="table">{orders.map(o => <div className="tableRow" key={o.id}><span>{o.email}</span><span>{o.items_summary}</span><span>{cents(o.total_cents)}</span><span className={`badge ${o.status}`}>{o.status}</span><div className="actions">{o.status === "paid" && <button className="primary" onClick={() => updateOrder(o, "ready_for_pickup")}>Klaar voor afhalen</button>}{o.status === "ready_for_pickup" && <button className="primary" onClick={() => updateOrder(o, "picked_up")}>Opgehaald</button>}{["paid","ready_for_pickup"].includes(o.status) && <button className="danger" onClick={() => cancelOrder(o)}>Annuleren</button>}</div></div>)}</div>}</section>;
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
