import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/app-header";
import { PageHeader } from "@/components/page-header";
import { KPICard } from "@/components/kpi-card";
import { stats } from "@/lib/mock-data";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Calendar, Euro, UserPlus, XCircle, Activity } from "lucide-react";

export const Route = createFileRoute("/statistieken")({
  head: () => ({
    meta: [
      { title: "Statistieken — BarberFlow" },
      { name: "description", content: "KPI's en trends van jouw barbershop." },
      { property: "og:title", content: "Statistieken — BarberFlow" },
      { property: "og:description", content: "KPI's, trends en activiteit voor RW CUTZZ." },
    ],
  }),
  component: StatistiekenPage,
});

const PIE_COLORS = [
  "oklch(0.52 0.28 268)",
  "oklch(0.68 0.17 152)",
  "oklch(0.8 0.17 85)",
  "oklch(0.62 0.23 27)",
  "oklch(0.65 0.2 300)",
];

function StatistiekenPage() {
  return (
    <>
      <AppHeader title="Statistieken" large subtitle="Overzicht van deze maand" />
      <PageHeader title="Statistieken" description="Overzicht van je business" />

      {/* MOBILE big number */}
      <div className="md:hidden px-4 pb-4">
        <div className="rounded-3xl border border-border bg-gradient-to-br from-primary/25 via-card to-card p-5">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Omzet deze maand</div>
          <div className="text-5xl font-black tracking-tight mt-1">€{stats.revenueThisMonth.toLocaleString("nl-NL")}</div>
          <div className="mt-1 text-xs text-success font-medium">+8% t.o.v. vorige maand</div>
        </div>
      </div>

      {/* Horizontal KPI scroll on mobile, grid on tablet+ */}
      <div className="md:hidden pb-4">
        <div className="flex gap-3 overflow-x-auto no-scrollbar px-4 pb-1">
          <KPICard label="Boekingen" value={String(stats.bookingsThisMonth)} delta="+12%" icon={Calendar} compact />
          <KPICard label="No-show" value={`${stats.noShowPercent}%`} delta="-1.1%" icon={XCircle} compact />
          <KPICard label="Nieuwe klanten" value={String(stats.newCustomers)} delta="+4" icon={UserPlus} compact />
          <KPICard label="Omzet" value={`€${stats.revenueThisMonth}`} delta="+8%" icon={Euro} compact />
        </div>
      </div>

      <div className="hidden md:block p-4 lg:p-8 pb-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard label="Boekingen deze maand" value={String(stats.bookingsThisMonth)} delta="+12%" icon={Calendar} />
          <KPICard label="Omzet deze maand" value={`€${stats.revenueThisMonth.toLocaleString("nl-NL")}`} delta="+8%" icon={Euro} />
          <KPICard label="No-show %" value={`${stats.noShowPercent}%`} delta="-1.1%" icon={XCircle} positive />
          <KPICard label="Nieuwe klanten" value={String(stats.newCustomers)} delta="+4" icon={UserPlus} />
        </div>
      </div>

      <div className="p-4 lg:px-8 space-y-4 grid grid-cols-1 xl:grid-cols-[2fr_1fr] xl:gap-6">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-sm font-semibold mb-4">Boekingen per week</div>
          <div className="h-64 md:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.weeklyBookings}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="week" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-sm font-semibold mb-4">Omzet per dienst</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats.revenueByService} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                  {stats.revenueByService.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="p-4 lg:px-8 lg:pb-8">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" /> Recente activiteit
          </div>
          <ul className="space-y-2">
            {stats.activity.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 py-2 border-b border-border last:border-0">
                <span className="text-sm">{a.text}</span>
                <span className="text-[11px] text-muted-foreground shrink-0">{a.time}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
