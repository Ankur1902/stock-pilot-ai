import { createFileRoute, Link } from "@tanstack/react-router";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { GlassCard, PageHeader, StockBadge, EmptyState, ErrorState, LoadingRows } from "@/components/app/ui-bits";
import { Skeleton } from "@/components/ui/skeleton";
import { isLow, money, num, useMovements, useProducts } from "@/lib/inventory";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — StockPilot" },
      { name: "description", content: "Live overview of your inventory, value and stock movements." },
      { property: "og:title", content: "Dashboard — StockPilot" },
      { property: "og:description", content: "Live overview of your inventory, value and stock movements." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const products = useProducts();
  const movements = useMovements(6);
  const list = products.data ?? [];
  const low = list.filter(isLow);
  const totalQty = list.reduce((s, p) => s + p.current_stock, 0);
  const value = list.reduce((s, p) => s + p.current_stock * Number(p.cost_price), 0);

  const byCat = Object.values(
    list.reduce<Record<string, { category: string; stock: number; min: number }>>((acc, p) => {
      const c = p.category || "Uncategorized";
      acc[c] ??= { category: c, stock: 0, min: 0 };
      acc[c].stock += p.current_stock;
      acc[c].min += p.min_stock;
      return acc;
    }, {}),
  );

  const kpis = [
    { label: "Total products", value: num(list.length), note: `${new Set(list.map((p) => p.category).filter(Boolean)).size} categories`, tone: "text-muted-foreground" },
    { label: "Total quantity", value: num(totalQty), note: "units on hand", tone: "text-muted-foreground" },
    { label: "Low stock", value: num(low.length), note: low.length ? "need attention" : "all healthy", tone: low.length ? "text-destructive" : "text-success" },
    { label: "Inventory value", value: money(value), note: "at cost price", tone: "text-success" },
  ];

  return (
    <>
      <PageHeader eyebrow="Warehouse ops" title="Inventory overview" />
      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {kpis.map((k) => (
          <GlassCard key={k.label} className="p-5">
            <div className="eyebrow">{k.label}</div>
            {products.isLoading ? (
              <Skeleton className="mt-3 h-8 w-24" />
            ) : (
              <div className="mt-2 truncate text-2xl font-extrabold tracking-tight sm:text-[30px]">{k.value}</div>
            )}
            <div className={`mt-1 text-xs font-semibold ${k.tone}`}>{k.note}</div>
          </GlassCard>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <GlassCard className="p-5 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-lg font-bold">Stock by category</div>
            <div className="flex gap-4 text-xs font-semibold text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-primary" />On hand</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-brand-2" />Minimum</span>
            </div>
          </div>
          {products.isLoading ? (
            <Skeleton className="h-48 w-full rounded-xl" />
          ) : byCat.length === 0 ? (
            <EmptyState title="No data yet" text="Add products to see your inventory chart." />
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byCat}>
                  <defs>
                    <linearGradient id="g" x1="0" y1="1" x2="0" y2="0">
                      <stop offset="0%" stopColor="var(--primary)" />
                      <stop offset="100%" stopColor="var(--brand-2)" />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="category" tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted-foreground)" />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted-foreground)" width={40} />
                  <Tooltip cursor={{ fill: "var(--accent)" }} contentStyle={{ borderRadius: 12, border: "1px solid var(--border)" }} />
                  <Bar dataKey="stock" name="On hand" fill="url(#g)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="min" name="Minimum" fill="var(--brand-2)" fillOpacity={0.4} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-5">
          <div className="mb-3 text-lg font-bold">Recent movements</div>
          {movements.isLoading ? (
            <LoadingRows rows={4} />
          ) : movements.error ? (
            <ErrorState error={movements.error} />
          ) : !movements.data?.length ? (
            <EmptyState title="No movements" text="Stock in/out records will appear here." />
          ) : (
            <div className="space-y-3">
              {movements.data.map((m) => (
                <div key={m.id} className="flex items-center gap-3">
                  <div className={`grid size-9 place-items-center rounded-lg text-sm font-bold ${m.type === "in" ? "bg-success-soft text-success" : "bg-danger-soft text-destructive"}`}>
                    {m.type === "in" ? "+" : "−"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {m.type === "in" ? "Inbound" : "Outbound"} · {m.products?.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(m.movement_date).toLocaleDateString()} · {m.type === "in" ? "+" : "−"}{num(m.quantity)} units
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>

      <GlassCard className="overflow-hidden">
        <div className="flex items-center justify-between p-5 pb-3">
          <div className="text-lg font-bold">Low-stock products</div>
          <Link to="/products" className="text-xs font-semibold text-primary">View all →</Link>
        </div>
        {products.isLoading ? (
          <LoadingRows rows={3} />
        ) : products.error ? (
          <ErrorState error={products.error} />
        ) : low.length === 0 ? (
          <EmptyState title="Everything is stocked" text="No products are at or below their minimum level." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="eyebrow">
                  <th className="px-5 pb-2 text-left">SKU</th>
                  <th className="px-5 pb-2 text-left">Product</th>
                  <th className="px-5 pb-2 text-left">Category</th>
                  <th className="px-5 pb-2 text-right">On hand</th>
                  <th className="px-5 pb-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {low.slice(0, 6).map((p) => (
                  <tr key={p.id} className="border-t border-glass-border">
                    <td className="px-5 py-3 font-mono text-muted-foreground">{p.sku}</td>
                    <td className="px-5 py-3 font-semibold">{p.name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{p.category || "—"}</td>
                    <td className="px-5 py-3 text-right font-semibold">{num(p.current_stock)}</td>
                    <td className="px-5 py-3 text-right"><StockBadge stock={p.current_stock} min={p.min_stock} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </>
  );
}
