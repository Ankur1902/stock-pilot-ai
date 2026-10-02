import { useMemo, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { GlassCard, PageHeader, StockBadge, EmptyState, ErrorState, LoadingRows } from "@/components/app/ui-bits";
import { isLow, money, num, useDeleteRow, useProducts, useSaveProduct, useSuppliers, type Product } from "@/lib/inventory";

export const Route = createFileRoute("/_authenticated/products")({
  head: () => ({
    meta: [
      { title: "Products — StockPilot" },
      { name: "description", content: "Manage your product catalog, prices and stock levels." },
      { property: "og:title", content: "Products — StockPilot" },
      { property: "og:description", content: "Manage your product catalog, prices and stock levels." },
    ],
  }),
  component: ProductsPage,
});

function ProductsPage() {
  const { data, isLoading, error } = useProducts();
  const del = useDeleteRow("products");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState<Product | null | "new">(null);
  const [deleting, setDeleting] = useState<Product | null>(null);

  const categories = useMemo(() => [...new Set((data ?? []).map((p) => p.category).filter(Boolean))] as string[], [data]);
  const filtered = (data ?? []).filter((p) => {
    const s = q.toLowerCase();
    if (s && !p.name.toLowerCase().includes(s) && !p.sku.toLowerCase().includes(s)) return false;
    if (cat !== "all" && p.category !== cat) return false;
    if (status === "low" && !isLow(p)) return false;
    if (status === "ok" && isLow(p)) return false;
    return true;
  });

  return (
    <>
      <PageHeader
        eyebrow="Catalog"
        title="Products"
        action={<Button variant="brand" onClick={() => setEditing("new")}><Plus /> Add product</Button>}
      />
      <GlassCard className="overflow-hidden">
        <div className="flex flex-col gap-3 p-5 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search name or SKU…" value={q} onChange={(e) => setQ(e.target.value)} className="rounded-xl bg-card pl-9" />
          </div>
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger className="rounded-xl bg-card sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="rounded-xl bg-card sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="low">Low stock</SelectItem>
              <SelectItem value="ok">In stock</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {isLoading ? (
          <LoadingRows />
        ) : error ? (
          <ErrorState error={error} />
        ) : !data?.length ? (
          <EmptyState title="No products yet" text="Add your first product to start tracking stock." action={<Button variant="brand" onClick={() => setEditing("new")}><Plus /> Add product</Button>} />
        ) : !filtered.length ? (
          <EmptyState title="No matches" text="Try a different search or filter." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="eyebrow">
                  <th className="px-5 pb-2 text-left">SKU</th>
                  <th className="px-5 pb-2 text-left">Product</th>
                  <th className="px-5 pb-2 text-left">Category</th>
                  <th className="px-5 pb-2 text-left">Supplier</th>
                  <th className="px-5 pb-2 text-right">Cost</th>
                  <th className="px-5 pb-2 text-right">Price</th>
                  <th className="px-5 pb-2 text-right">On hand</th>
                  <th className="px-5 pb-2 text-right">Status</th>
                  <th className="px-5 pb-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-t border-glass-border">
                    <td className="px-5 py-3 font-mono text-muted-foreground">{p.sku}</td>
                    <td className="px-5 py-3 font-semibold">{p.name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{p.category || "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">{p.suppliers?.name || "—"}</td>
                    <td className="px-5 py-3 text-right">{money(Number(p.cost_price))}</td>
                    <td className="px-5 py-3 text-right">{money(Number(p.selling_price))}</td>
                    <td className="px-5 py-3 text-right font-semibold">{num(p.current_stock)}<span className="text-xs font-normal text-muted-foreground"> / min {p.min_stock}</span></td>
                    <td className="px-5 py-3 text-right"><StockBadge stock={p.current_stock} min={p.min_stock} /></td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <Button size="icon" variant="ghost" onClick={() => setEditing(p)} aria-label="Edit"><Pencil /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleting(p)} aria-label="Delete"><Trash2 className="text-destructive" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {editing && <ProductDialog product={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>This also removes its stock movement history. This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && del.mutate(deleting.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ProductDialog({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const save = useSaveProduct();
  const suppliers = useSuppliers();
  const [f, setF] = useState({
    name: product?.name ?? "",
    sku: product?.sku ?? "",
    category: product?.category ?? "",
    supplier_id: product?.supplier_id ?? "none",
    cost_price: String(product?.cost_price ?? ""),
    selling_price: String(product?.selling_price ?? ""),
    current_stock: String(product?.current_stock ?? "0"),
    min_stock: String(product?.min_stock ?? "0"),
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(
      {
        id: product?.id,
        name: f.name.trim(),
        sku: f.sku.trim(),
        category: f.category.trim() || null,
        supplier_id: f.supplier_id === "none" ? null : f.supplier_id,
        cost_price: Number(f.cost_price) || 0,
        selling_price: Number(f.selling_price) || 0,
        current_stock: Math.max(0, Math.floor(Number(f.current_stock) || 0)),
        min_stock: Math.max(0, Math.floor(Number(f.min_stock) || 0)),
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-lg">
        <DialogHeader><DialogTitle>{product ? "Edit product" : "Add product"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-2 gap-4">
          <Field label="Product name" className="col-span-2"><Input required value={f.name} onChange={set("name")} /></Field>
          <Field label="SKU"><Input required value={f.sku} onChange={set("sku")} /></Field>
          <Field label="Category"><Input value={f.category} onChange={set("category")} /></Field>
          <Field label="Supplier" className="col-span-2">
            <Select value={f.supplier_id} onValueChange={(v) => setF({ ...f, supplier_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No supplier</SelectItem>
                {suppliers.data?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Cost price"><Input type="number" min="0" step="0.01" required value={f.cost_price} onChange={set("cost_price")} /></Field>
          <Field label="Selling price"><Input type="number" min="0" step="0.01" required value={f.selling_price} onChange={set("selling_price")} /></Field>
          <Field label="Current stock"><Input type="number" min="0" step="1" required value={f.current_stock} onChange={set("current_stock")} /></Field>
          <Field label="Minimum stock level"><Input type="number" min="0" step="1" required value={f.min_stock} onChange={set("min_stock")} /></Field>
          <DialogFooter className="col-span-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="brand" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save product"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
