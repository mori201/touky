"use client";

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { formatMoney } from "@/lib/format";

const PALETTE = ["rgb(var(--primary))", "rgb(var(--accent))", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#64748b", "#ec4899"];

function compact(v: number) {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(".", ",")} M`;
  if (Math.abs(v) >= 1_000) return `${Math.round(v / 1000)} k`;
  return String(v);
}

const tooltipStyle = {
  contentStyle: { background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 12, fontSize: 12 },
  labelStyle: { color: "rgb(var(--fg))", fontWeight: 700 },
};

export function SalesTrendChart({ data, bucket }: { data: { period: string; revenue: number; expenses: number; count: number }[]; bucket: "day" | "month" }) {
  const rows = data.map((d) => {
    const dt = new Date(`${d.period}T00:00:00Z`);
    const label = bucket === "month"
      ? dt.toLocaleDateString("fr-FR", { month: "short", year: "2-digit", timeZone: "UTC" })
      : dt.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
    return { ...d, label, revenue: Number(d.revenue), expenses: Number(d.expenses) };
  });
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={rows} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--primary))" stopOpacity={0.35} />
            <stop offset="100%" stopColor="rgb(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "rgb(var(--fg-muted))" }} tickLine={false} axisLine={false} minTickGap={16} />
        <YAxis tickFormatter={compact} tick={{ fontSize: 11, fill: "rgb(var(--fg-muted))" }} tickLine={false} axisLine={false} width={44} />
        <Tooltip {...tooltipStyle} formatter={(v, n) => [formatMoney(Number(v)), n === "revenue" ? "Ventes" : "Dépenses"]} />
        <Legend formatter={(v) => (v === "revenue" ? "Ventes" : "Dépenses")} wrapperStyle={{ fontSize: 12 }} />
        <Area type="monotone" dataKey="revenue" stroke="rgb(var(--primary))" strokeWidth={2.5} fill="url(#gRev)" />
        <Area type="monotone" dataKey="expenses" stroke="rgb(var(--danger))" strokeWidth={2} fill="transparent" strokeDasharray="5 4" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function HorizontalBars({ data, valueKey = "revenue", nameKey = "name", money = true }: { data: Record<string, unknown>[]; valueKey?: string; nameKey?: string; money?: boolean }) {
  const rows = data.slice(0, 8).map((d) => ({ name: String(d[nameKey]), value: Number(d[valueKey]) }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, rows.length * 38)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: "rgb(var(--fg))" }} tickLine={false} axisLine={false} />
        <Tooltip {...tooltipStyle} formatter={(v) => [money ? formatMoney(Number(v)) : String(v), ""]} cursor={{ fill: "rgb(var(--muted))" }} />
        <Bar dataKey="value" radius={[0, 8, 8, 0]}>
          {rows.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Donut({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={230}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
          {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Pie>
        <Tooltip {...tooltipStyle} formatter={(v) => formatMoney(Number(v))} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
