import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Mail, PackageCheck, RefreshCcw, Sparkles } from "lucide-react";
import { useState, type ReactNode } from "react";
import { GlassCard, PageHeader, EmptyState, ErrorState, LoadingRows } from "@/components/app/ui-bits";
import { AiBriefing } from "@/components/app/AiBriefing";
import { EmailDraftDialog } from "@/components/app/EmailDraftDialog";
import { Button } from "@/components/ui/button";
import { money, num, useMovements, useProducts, type Product } from "@/lib/inventory";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => ({
    meta: [
      { title: "AI Insights — StockPilot" },
      { name: "description", content: "Plain-language insights on low, excess and reorder-ready stock." },
      { property: "og:title", content: "AI Insights — StockPilot" },
      { property: "og:description", content: "Plain-language insights on low, excess and reorder-ready stock." },
    ],
  }),
  component: InsightsPage,
});

type Insight = { product: Product; text: string };

function InsightsPage() {
  const products = useProducts();
  const movements = useMovements();
  const [email, setEmail] = useState<{ id: string; name: string; items: { productId: string; quantity: number }[] } | null>(null);

  if (products.isLoading || movements.isLoading)
    return (<><PageHeader eyebrow="Assistant" title="AI Insights" /><GlassCard><LoadingRows /></GlassCard></>);
  if (products.error) return (<><PageHeader eyebrow="Assistant" title="AI Insights" /><GlassCard><ErrorState error={products.error} /></GlassCard></>);

  const list = products.data ?? [];
  // Units shipped out in the last 30 days per product
  const since = Date.now() - 30 * 86400000;
  const out30 = new Map<string, number>();
  for (const m of movements.data ?? []) {
    if (m.type === "out" && new Date(m.movement_date).getTime() >= since)
      out30.set(m.product_id, (out30.get(m.product_id) ?? 0) + m.quantity);
  }

  const low: Insight[] = list
    .filter((p) => p.current_stock <= p.min_stock)
    .map((p) => ({
      product: p,
      text:
        p.current_stock === 0
          ? `${p.name} is out of stock. Any new orders can't be fulfilled until it's restocked.`
          : `${p.name} has ${num(p.current_stock)} units left, at or below its minimum of ${num(p.min_stock)}.`,
    }));

  const high: Insight[] = list
    .filter((p) => p.min_stock > 0 && p.current_stock >= p.min_stock * 4 && (out30.get(p.id) ?? 0) < p.current_stock / 4)
    .map((p) => ({
      product: p,
      text: `${p.name} holds ${num(p.current_stock)} units — ${Math.round(p.current_stock / p.min_stock)}× its minimum, tying up ${money(p.current_stock * Number(p.cost_price))}. Consider slowing purchases.`,
    }));

  const reorder: Insight[] = list
    .filter((p) => p.current_stock > p.min_stock)
    .map((p) => ({ p, daily: (out30.get(p.id) ?? 0) / 30 }))
    .filter(({ p, daily }) => daily > 0 && (p.current_stock - p.min_stock) / daily <= 14 || p.current_stock <= p.min_stock * 1.25)
    .map(({ p, daily }) => {
      const days = daily > 0 ? Math.max(0, Math.round((p.current_stock - p.min_stock) / daily)) : null;
      const suggest = Math.max(p.min_stock * 2 - p.current_stock, Math.ceil(daily * 30));
      return {
        product: p,
        text:
          days !== null
            ? `At ~${daily.toFixed(1)} units/day, ${p.name} will hit its minimum in about ${days} day${days === 1 ? "" : "s"}. Reorder ~${num(suggest)} units${p.suppliers ? ` from ${p.suppliers.name}` : ""}.`
            : `${p.name} is close to its minimum level. Plan a reorder of ~${num(suggest)} units soon.`,
      };
    });

  const bySupplier = new Map<string, { name: string; items: { productId: string; quantity: number }[] }>();
  for (const { product: p } of low) {
    if (!p.supplier_id) continue;
    const g = bySupplier.get(p.supplier_id) ?? { name: p.suppliers?.name ?? "Supplier", items: [] };
    g.items.push({ productId: p.id, quantity: Math.max(p.min_stock * 2 - p.current_stock, 1) });
    bySupplier.set(p.supplier_id, g);
  }

  return (
    <>
      <PageHeader eyebrow="Assistant" title="AI Insights" />
      <AiBriefing />
      {bySupplier.size > 0 && (
        <GlassCard className="mb-6 flex flex-wrap items-center gap-2 p-4">
          <span className="mr-2 text-sm font-semibold">Draft a reorder email:</span>
          {[...bySupplier.entries()].map(([id, g]) => (
            <Button key={id} size="sm" variant="outline" onClick={() => setEmail({ id, ...g })}>
              <Mail /> {g.name} ({g.items.length})
            </Button>
          ))}
        </GlassCard>
      )}
      {email && <EmailDraftDialog supplierId={email.id} supplierName={email.name} items={email.items} onClose={() => setEmail(null)} />}
      <GlassCard className="mb-6 flex items-start gap-4 p-5">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-brand text-primary-foreground shadow-brand"><Sparkles className="size-5" /></div>
        <p className="text-sm leading-relaxed">
          {list.length === 0
            ? "Add some products and movements and I'll start spotting patterns for you."
            : `I reviewed ${num(list.length)} products and ${num(movements.data?.length ?? 0)} stock movements. ${low.length} ${low.length === 1 ? "product is" : "products are"} low, ${reorder.length} may need reordering soon, and ${high.length} ${high.length === 1 ? "looks" : "look"} overstocked.`}
        </p>
      </GlassCard>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Section icon={<AlertTriangle className="size-4" />} tone="bg-danger-soft text-destructive" title="Low in stock" items={low} empty="No products are below their minimum." />
        <Section icon={<RefreshCcw className="size-4" />} tone="bg-warning-soft text-warning" title="May need reordering" items={reorder} empty="Nothing is trending toward its minimum." />
        <Section icon={<PackageCheck className="size-4" />} tone="bg-accent text-accent-foreground" title="Unusually high stock" items={high} empty="No overstocked products detected." />
      </div>
    </>
  );
}

function Section({ icon, tone, title, items, empty }: { icon: ReactNode; tone: string; title: string; items: Insight[]; empty: string }) {
  return (
    <GlassCard className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className={`grid size-8 place-items-center rounded-lg ${tone}`}>{icon}</span>
        <div className="font-bold">{title}</div>
        <span className="ml-auto text-xs font-semibold text-muted-foreground">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <EmptyState title="All clear" text={empty} />
      ) : (
        <div className="space-y-3">
          {items.map(({ product, text }) => (
            <div key={product.id} className="rounded-xl bg-card/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold">{product.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{product.sku}</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
