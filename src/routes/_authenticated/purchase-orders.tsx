import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Mail, PackageCheck, Plus, Trash2, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GlassCard, PageHeader, StatusBadge, EmptyState, ErrorState, LoadingRows } from "@/components/app/ui-bits";
import { EmailDraftDialog } from "@/components/app/EmailDraftDialog";
import { isLow, money, num, useProducts, useSuppliers } from "@/lib/inventory";
import { useCancelPurchaseOrder, useCreatePurchaseOrder, usePurchaseOrders, useReceivePurchaseOrder, type PurchaseOrder } from "@/lib/extras";

export const Route = createFileRoute("/_authenticated/purchase-orders")({
  head: () => ({
    meta: [
      { title: "Purchase Orders — StockPilot" },
      { name: "description", content: "Order from suppliers and receive stock in one click." },
      { property: "og:title", content: "Purchase Orders — StockPilot" },
      { property: "og:description", content: "Order from suppliers and receive stock in one click." },
    ],
  }),
  component: POPage,
});

const tone = { draft: "info", ordered: "warning", received: "success", cancelled: "danger" } as const;

function POPage() {
  const { data, isLoading, error } = usePurchaseOrders();
  const receive = useReceivePurchaseOrder();
  const cancel = useCancelPurchaseOrder();
  const [creating, setCreating] = useState(false);
  const [emailFor, setEmailFor] = useState<PurchaseOrder | null>(null);

  return (
    <>
      <PageHeader eyebrow="Buying" title="Purchase Orders" action={<Button variant="brand" onClick={() => setCreating(true)}><Plus /> New order</Button>} />
      <GlassCard className="overflow-hidden">
        {isLoading ? <LoadingRows /> : error ? <ErrorState error={error} /> : !data?.length ? (
          <EmptyState title="No purchase orders" text="Create an order to a supplier. When it arrives, mark it received and stock updates automatically." action={<Button variant="brand" onClick={() => setCreating(true)}><Plus /> New order</Button>} />
        ) : (
          <div className="divide-y divide-glass-border">
            {data.map((po) => {
              const total = po.purchase_order_items.reduce((a, i) => a + i.quantity * Number(i.unit_cost), 0);
              const open = po.status === "ordered" || po.status === "draft";
              return (
                <div key={po.id} className="flex flex-col gap-3 p-5 md:flex-row md:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold">{po.suppliers?.name ?? "No supplier"}</span>
                      <StatusBadge tone={tone[po.status as keyof typeof tone]}>{po.status}</StatusBadge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(po.created_at).toLocaleDateString()}
                        {po.expected_date && open ? ` · due ${new Date(po.expected_date).toLocaleDateString()}` : ""}
                        {po.received_at ? ` · received ${new Date(po.received_at).toLocaleDateString()}` : ""}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {po.purchase_order_items.map((i) => `${num(i.quantity)}× ${i.products?.name ?? "deleted product"}`).join(", ")}
                    </p>
                  </div>
                  <div className="font-semibold">{money(total)}</div>
                  <div className="flex gap-2">
                    {open && po.supplier_id && (
                      <Button size="sm" variant="outline" onClick={() => setEmailFor(po)}><Mail /> Email</Button>
                    )}
                    {open && (
                      <>
                        <Button size="sm" variant="brand" disabled={receive.isPending} onClick={() => receive.mutate(po.id)}><PackageCheck /> Receive</Button>
                        <Button size="icon" variant="ghost" aria-label="Cancel order" onClick={() => cancel.mutate(po.id)}><X /></Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>
      {creating && <CreatePODialog onClose={() => setCreating(false)} />}
      {emailFor && emailFor.supplier_id && (
        <EmailDraftDialog
          supplierId={emailFor.supplier_id}
          supplierName={emailFor.suppliers?.name ?? "supplier"}
          items={emailFor.purchase_order_items.map((i) => ({ productId: i.product_id, quantity: i.quantity }))}
          onClose={() => setEmailFor(null)}
        />
      )}
    </>
  );
}

type Line = { product_id: string; quantity: string; unit_cost: string };

function CreatePODialog({ onClose }: { onClose: () => void }) {
  const products = useProducts();
  const suppliers = useSuppliers();
  const create = useCreatePurchaseOrder();
  const [supplier, setSupplier] = useState("none");
  const [expected, setExpected] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([{ product_id: "", quantity: "1", unit_cost: "" }]);

  const list = products.data ?? [];
  const setLine = (i: number, patch: Partial<Line>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const fillLow = () => {
    const low = list.filter((p) => isLow(p) && (supplier === "none" || p.supplier_id === supplier));
    if (!low.length) return;
    setLines(low.map((p) => ({ product_id: p.id, quantity: String(Math.max(p.min_stock * 2 - p.current_stock, 1)), unit_cost: String(p.cost_price) })));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const items = lines
      .filter((l) => l.product_id && Number(l.quantity) > 0)
      .map((l) => ({ product_id: l.product_id, quantity: Math.floor(Number(l.quantity)), unit_cost: Math.max(0, Number(l.unit_cost) || 0) }));
    if (!items.length) return;
    create.mutate({ supplier_id: supplier === "none" ? null : supplier, expected_date: expected || null, note, items }, { onSuccess: onClose });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-2xl">
        <DialogHeader><DialogTitle>New purchase order</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Supplier</Label>
              <Select value={supplier} onValueChange={setSupplier}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No supplier</SelectItem>
                  {suppliers.data?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Expected delivery</Label>
              <Input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label>Items</Label>
            <Button type="button" size="sm" variant="ghost" onClick={fillLow}><Wand2 /> Add low-stock items</Button>
          </div>
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_80px_100px_36px] gap-2">
                <Select value={l.product_id} onValueChange={(v) => setLine(i, { product_id: v, unit_cost: String(list.find((p) => p.id === v)?.cost_price ?? "") })}>
                  <SelectTrigger><SelectValue placeholder="Product" /></SelectTrigger>
                  <SelectContent>{list.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
                <Input type="number" min="1" step="1" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} aria-label="Quantity" />
                <Input type="number" min="0" step="0.01" value={l.unit_cost} onChange={(e) => setLine(i, { unit_cost: e.target.value })} placeholder="Unit cost" aria-label="Unit cost" />
                <Button type="button" size="icon" variant="ghost" onClick={() => setLines(lines.filter((_, j) => j !== i))} aria-label="Remove line"><Trash2 /></Button>
              </div>
            ))}
            <Button type="button" size="sm" variant="outline" onClick={() => setLines([...lines, { product_id: "", quantity: "1", unit_cost: "" }])}><Plus /> Add line</Button>
          </div>
          <div className="space-y-1.5">
            <Label>Note</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="brand" disabled={create.isPending}>{create.isPending ? "Saving…" : "Create order"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
