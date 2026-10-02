import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GlassCard, PageHeader, StatusBadge, EmptyState, ErrorState, LoadingRows } from "@/components/app/ui-bits";
import { num, useMovements, useProducts, useRecordMovement } from "@/lib/inventory";

export const Route = createFileRoute("/_authenticated/movements")({
  head: () => ({
    meta: [
      { title: "Stock Movements — StockPilot" },
      { name: "description", content: "Record stock in and out and review movement history." },
      { property: "og:title", content: "Stock Movements — StockPilot" },
      { property: "og:description", content: "Record stock in and out and review movement history." },
    ],
  }),
  component: MovementsPage,
});

function MovementsPage() {
  const { data, isLoading, error } = useMovements();
  const [type, setType] = useState<"in" | "out" | null>(null);
  const [filter, setFilter] = useState("all");
  const rows = (data ?? []).filter((m) => filter === "all" || m.type === filter);

  return (
    <>
      <PageHeader
        eyebrow="Ledger"
        title="Stock movements"
        action={
          <div className="flex gap-2">
            <Button variant="brand" onClick={() => setType("in")}><ArrowDownToLine /> Stock in</Button>
            <Button variant="glass" onClick={() => setType("out")}><ArrowUpFromLine /> Stock out</Button>
          </div>
        }
      />
      <GlassCard className="overflow-hidden">
        <div className="flex items-center justify-between p-5 pb-3">
          <div className="text-lg font-bold">History</div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-36 rounded-xl bg-card"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="in">Stock in</SelectItem>
              <SelectItem value="out">Stock out</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {isLoading ? (
          <LoadingRows />
        ) : error ? (
          <ErrorState error={error} />
        ) : !rows.length ? (
          <EmptyState title="No movements yet" text="Record a stock in or stock out to see it here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="eyebrow">
                  <th className="px-5 pb-2 text-left">Date</th>
                  <th className="px-5 pb-2 text-left">Product</th>
                  <th className="px-5 pb-2 text-left">Type</th>
                  <th className="px-5 pb-2 text-right">Quantity</th>
                  <th className="px-5 pb-2 text-left">Note</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id} className="border-t border-glass-border">
                    <td className="px-5 py-3 text-muted-foreground">{new Date(m.movement_date).toLocaleDateString()}</td>
                    <td className="px-5 py-3"><span className="font-semibold">{m.products?.name}</span> <span className="font-mono text-xs text-muted-foreground">{m.products?.sku}</span></td>
                    <td className="px-5 py-3">{m.type === "in" ? <StatusBadge tone="success">IN</StatusBadge> : <StatusBadge tone="danger">OUT</StatusBadge>}</td>
                    <td className="px-5 py-3 text-right font-semibold">{m.type === "in" ? "+" : "−"}{num(m.quantity)}</td>
                    <td className="px-5 py-3 text-muted-foreground">{m.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
      {type && <MovementDialog type={type} onClose={() => setType(null)} />}
    </>
  );
}

function MovementDialog({ type, onClose }: { type: "in" | "out"; onClose: () => void }) {
  const products = useProducts();
  const record = useRecordMovement();
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("1");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const selected = products.data?.find((p) => p.id === productId);
  const q = Math.floor(Number(qty) || 0);
  const tooMuch = type === "out" && selected ? q > selected.current_stock : false;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!productId || q <= 0 || tooMuch) return;
    record.mutate({ product_id: productId, type, quantity: q, date, note }, { onSuccess: onClose });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl">
        <DialogHeader><DialogTitle>{type === "in" ? "Record stock in" : "Record stock out"}</DialogTitle></DialogHeader>
        {products.data && products.data.length === 0 ? (
          <EmptyState title="No products" text="Add a product before recording stock movements." />
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Product</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger><SelectValue placeholder={products.isLoading ? "Loading…" : "Select a product"} /></SelectTrigger>
                <SelectContent>
                  {products.data?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} · {p.sku} ({p.current_stock} in stock)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Quantity</Label>
                <Input type="number" min="1" step="1" required value={qty} onChange={(e) => setQty(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            {tooMuch && <p className="text-sm font-medium text-destructive">Only {selected?.current_stock} units available — stock can't go negative.</p>}
            <div className="space-y-1.5">
              <Label>Note / reason</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={type === "in" ? "e.g. Supplier delivery" : "e.g. Customer order #1042"} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
              <Button type="submit" variant="brand" disabled={record.isPending || !productId || q <= 0 || tooMuch}>
                {record.isPending ? "Saving…" : "Record movement"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
