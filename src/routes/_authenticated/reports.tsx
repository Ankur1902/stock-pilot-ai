import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { GlassCard, PageHeader, EmptyState, ErrorState, LoadingRows } from "@/components/app/ui-bits";
import { money, num, useMovements, useProducts } from "@/lib/inventory";
import { downloadCsv } from "@/lib/extras";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports — StockPilot" },
      { name: "description", content: "Stock trends, top movers and inventory value breakdowns." },
      { property: "og:title", content: "Reports — StockPilot" },
      { property: "og:description", content: "Stock trends, top movers and inventory value breakdowns." },
    ],
  }),
  component: ReportsPage,
});

const COLORS = ["var(--color-primary)", "var(--color-brand-2)", "var(--color-success)", "var(--color-warning)", "var(--color-destructive)", "var(--color-muted-foreground)"];

function ReportsPage() {
  const products = useProducts();
  const movements = useMovements();

  const r = useMemo(() => {
    const ps = products.data ?? [];
    const ms = movements.data ?? [];
    const days: { day: string; in: number; out: number }[] = [];
    const idx = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      idx.set(d, days.length);
      days.push({ day: d.slice(5), in: 0, out: 0 });
    }
    const outBy = new Map<string, number>();
    let inTotal = 0, outTotal = 0;
    for (const m of ms) {
      const k = idx.get(m.movement_date);
      if (k === undefined) continue;
      days[k]![m.type as "in" | "out"] += m.quantity;
      if (m.type === "out") { outBy.set(m.product_id, (outBy.get(m.product_id) ?? 0) + m.quantity); outTotal += m.quantity; }
      else inTotal += m.quantity;
    }
    const top = [...outBy.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([id, qty]) => ({ name: ps.find((p) => p.id === id)?.name ?? "Deleted", qty }));
    const catMap = new Map<string, number>();
    for (const p of ps) catMap.set(p.category || "Uncategorized", (catMap.get(p.category || "Uncategorized") ?? 0) + p.current_stock * Number(p.cost_price));
    const cats = [...catMap.entries()].map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 })).sort((a, b) => b.value - a.value);
    const sold = ps.reduce((a, p) => a + (outBy.get(p.id) ?? 0) * (Number(p.selling_price) - Number(p.cost_price)), 0);
    return { days, top, cats, inTotal, outTotal, sold };
  }, [products.data, movements.data]);

  const exportMovements = () =>
    downloadCsv(`stock-movements-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["date", "product", "sku", "type", "quantity", "note"],
      ...(movements.data ?? []).map((m) => [m.movement_date, m.products?.name, m.products?.sku, m.type, m.quantity, m.note]),
    ]);

  if (products.isLoading || movements.isLoading) return (<><PageHeader eyebrow="Analytics" title="Reports" /><GlassCard><LoadingRows /></GlassCard></>);
  if (products.error || movements.error) return (<><PageHeader eyebrow="Analytics" title="Reports" /><GlassCard><ErrorState error={products.error ?? movements.error} /></GlassCard></>);

  return (
    <>
      <PageHeader eyebrow="Analytics" title="Reports" action={<Button variant="glass" onClick={exportMovements}><Download /> Export movements</Button>} />
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Kpi label="Units in (30 days)" value={num(r.inTotal)} />
        <Kpi label="Units out (30 days)" value={num(r.outTotal)} />
        <Kpi label="Est. gross margin on units out" value={money(r.sold)} />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <GlassCard className="p-5 xl:col-span-2">
          <div className="mb-3 font-bold">Stock in vs out — last 30 days</div>
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={r.days}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} interval={4} />
                <YAxis tick={{ fontSize: 11 }} width={36} />
                <Tooltip />
                <Area type="monotone" dataKey="in" stroke="var(--color-success)" fill="var(--color-success)" fillOpacity={0.15} />
                <Area type="monotone" dataKey="out" stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
        <GlassCard className="p-5">
          <div className="mb-3 font-bold">Top movers (units out, 30 days)</div>
          {r.top.length === 0 ? <EmptyState title="No outgoing stock" text="Record stock-out movements to see top movers." /> : (
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={r.top} layout="vertical" margin={{ left: 20 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="qty" fill="var(--color-primary)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </GlassCard>
        <GlassCard className="p-5">
          <div className="mb-3 font-bold">Inventory value by category</div>
          {r.cats.length === 0 ? <EmptyState title="No products" text="Add products to see value breakdown." /> : (
            <div className="flex h-64 items-center gap-4">
              <ResponsiveContainer width="55%">
                <PieChart>
                  <Pie data={r.cats} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {r.cats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => money(v)} />
                </PieChart>
              </ResponsiveContainer>
              <ul className="space-y-1.5 text-sm">
                {r.cats.map((c, i) => (
                  <li key={c.name} className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="truncate">{c.name}</span>
                    <span className="ml-auto pl-3 font-semibold">{money(c.value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </GlassCard>
      </div>
    </>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <GlassCard className="p-5">
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-extrabold tracking-tight">{value}</div>
    </GlassCard>
  );
}
