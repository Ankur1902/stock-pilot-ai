import { useMemo, useRef, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Pencil, Plus, Search, Trash2, Upload, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { extractProduct } from "@/lib/ai.functions";
import { downloadCsv, parseCsv } from "@/lib/extras";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  const suppliers = useSuppliers();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
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

  const exportCsv = () =>
    downloadCsv(`products-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["name", "sku", "category", "supplier", "cost_price", "selling_price", "current_stock", "min_stock"],
      ...(data ?? []).map((p) => [p.name, p.sku, p.category, p.suppliers?.name, p.cost_price, p.selling_price, p.current_stock, p.min_stock]),
    ]);

  const importCsv = async (file: File) => {
    const rows = parseCsv(await file.text());
    const head = (rows.shift() ?? []).map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
    const col = (r: string[], k: string) => (head.indexOf(k) >= 0 ? (r[head.indexOf(k)] ?? "").trim() : "");
    if (!head.includes("name") || !head.includes("sku")) return toast.error("CSV needs at least 'name' and 'sku' columns.");
    const sup = suppliers.data ?? [];
    const items = rows
      .filter((r) => col(r, "name") && col(r, "sku"))
      .map((r) => ({
        name: col(r, "name").slice(0, 200),
        sku: col(r, "sku").slice(0, 80),
        category: col(r, "category") || null,
        supplier_id: sup.find((s) => s.name.toLowerCase() === col(r, "supplier").toLowerCase())?.id ?? null,
        cost_price: Math.max(0, Number(col(r, "cost_price")) || 0),
        selling_price: Math.max(0, Number(col(r, "selling_price")) || 0),
        current_stock: Math.max(0, Math.floor(Number(col(r, "current_stock")) || 0)),
        min_stock: Math.max(0, Math.floor(Number(col(r, "min_stock")) || 0)),
      }));
    if (!items.length) return toast.error("No valid rows found.");
    const { error } = await supabase.from("products").upsert(items, { onConflict: "user_id,sku", ignoreDuplicates: true });
    if (error) return toast.error(error.message);
    qc.invalidateQueries();
    toast.success(`Imported ${items.length} rows (existing SKUs skipped)`);
  };

  return (
    <>
      <PageHeader
        eyebrow="Catalog"
        title="Products"
        action={
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv(f); e.target.value = ""; }} />
            <Button variant="glass" onClick={() => fileRef.current?.click()}><Upload /> Import CSV</Button>
            <Button variant="glass" onClick={exportCsv} disabled={!data?.length}><Download /> Export</Button>
            <Button variant="brand" onClick={() => setEditing("new")}><Plus /> Add product</Button>
          </div>
        }
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
  const extract = useServerFn(extractProduct);
  const [aiText, setAiText] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
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

  const fillWithAi = async () => {
    if (aiText.trim().length < 3) return;
    setAiBusy(true);
    const r = await extract({ data: { text: aiText } }).catch((e: Error) => ({ ok: false as const, error: e.message }));
    setAiBusy(false);
    if (!r.ok) return toast.error(r.error);
    const d = r.data;
    const sup = suppliers.data?.find((s) => d.supplier_name && s.name.toLowerCase() === d.supplier_name.toLowerCase());
    setF((prev) => ({
      name: d.name || prev.name,
      sku: d.sku || prev.sku,
      category: d.category ?? prev.category,
      supplier_id: sup?.id ?? prev.supplier_id,
      cost_price: d.cost_price != null ? String(d.cost_price) : prev.cost_price,
      selling_price: d.selling_price != null ? String(d.selling_price) : prev.selling_price,
      current_stock: d.current_stock != null ? String(Math.max(0, Math.floor(d.current_stock))) : prev.current_stock,
      min_stock: d.min_stock != null ? String(Math.max(0, Math.floor(d.min_stock))) : prev.min_stock,
    }));
    toast.success("Filled in — review and save");
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-lg">
        <DialogHeader><DialogTitle>{product ? "Edit product" : "Add product"}</DialogTitle></DialogHeader>
        {!product && (
          <div className="space-y-2 rounded-xl bg-accent/60 p-3">
            <Label className="flex items-center gap-1.5"><Wand2 className="size-3.5" /> Smart entry</Label>
            <Textarea rows={3} value={aiText} onChange={(e) => setAiText(e.target.value)} placeholder="Paste a description or invoice line, e.g. “50 ceramic mugs 350ml from Clay & Kiln, cost $3.20, sell $9, reorder at 15”" className="bg-card" />
            <Button type="button" size="sm" variant="brand" onClick={fillWithAi} disabled={aiBusy || aiText.trim().length < 3}>
              <Wand2 /> {aiBusy ? "Reading…" : "Fill form with AI"}
            </Button>
          </div>
        )}
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

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
