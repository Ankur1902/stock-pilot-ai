import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { GlassCard, PageHeader, EmptyState, ErrorState, LoadingRows } from "@/components/app/ui-bits";
import { useDeleteRow, useProducts, useSaveSupplier, useSuppliers, type Supplier } from "@/lib/inventory";

export const Route = createFileRoute("/_authenticated/suppliers")({
  head: () => ({
    meta: [
      { title: "Suppliers — StockPilot" },
      { name: "description", content: "Keep supplier contacts organized and linked to products." },
      { property: "og:title", content: "Suppliers — StockPilot" },
      { property: "og:description", content: "Keep supplier contacts organized and linked to products." },
    ],
  }),
  component: SuppliersPage,
});

function SuppliersPage() {
  const { data, isLoading, error } = useSuppliers();
  const products = useProducts();
  const del = useDeleteRow("suppliers");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Supplier | null | "new">(null);
  const [deleting, setDeleting] = useState<Supplier | null>(null);
  const count = (id: string) => (products.data ?? []).filter((p) => p.supplier_id === id).length;
  const rows = (data ?? []).filter((s) =>
    [s.name, s.contact_person, s.email].some((v) => v?.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <>
      <PageHeader eyebrow="Partners" title="Suppliers" action={<Button variant="brand" onClick={() => setEditing("new")}><Plus /> Add supplier</Button>} />
      <GlassCard className="overflow-hidden">
        <div className="p-5">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search suppliers…" value={q} onChange={(e) => setQ(e.target.value)} className="rounded-xl bg-card pl-9" />
          </div>
        </div>
        {isLoading ? (
          <LoadingRows />
        ) : error ? (
          <ErrorState error={error} />
        ) : !data?.length ? (
          <EmptyState title="No suppliers yet" text="Add suppliers to link them to your products." action={<Button variant="brand" onClick={() => setEditing("new")}><Plus /> Add supplier</Button>} />
        ) : !rows.length ? (
          <EmptyState title="No matches" text="Try a different search." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="eyebrow">
                  <th className="px-5 pb-2 text-left">Supplier</th>
                  <th className="px-5 pb-2 text-left">Contact</th>
                  <th className="px-5 pb-2 text-left">Phone</th>
                  <th className="px-5 pb-2 text-left">Email</th>
                  <th className="px-5 pb-2 text-right">Products</th>
                  <th className="px-5 pb-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className="border-t border-glass-border">
                    <td className="px-5 py-3 font-semibold">{s.name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{s.contact_person || "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">{s.phone || "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">{s.email || "—"}</td>
                    <td className="px-5 py-3 text-right font-semibold">{count(s.id)}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-right">
                      <Button size="icon" variant="ghost" onClick={() => setEditing(s)} aria-label="Edit"><Pencil /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleting(s)} aria-label="Delete"><Trash2 className="text-destructive" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {editing && <SupplierDialog supplier={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>Linked products will be kept but no longer have a supplier.</AlertDialogDescription>
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

function SupplierDialog({ supplier, onClose }: { supplier: Supplier | null; onClose: () => void }) {
  const save = useSaveSupplier();
  const [f, setF] = useState({
    name: supplier?.name ?? "",
    contact_person: supplier?.contact_person ?? "",
    phone: supplier?.phone ?? "",
    email: supplier?.email ?? "",
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(
      {
        id: supplier?.id,
        name: f.name.trim(),
        contact_person: f.contact_person.trim() || null,
        phone: f.phone.trim() || null,
        email: f.email.trim() || null,
      },
      { onSuccess: onClose },
    );
  };
  const fields = [
    ["name", "Supplier name", "text", true],
    ["contact_person", "Contact person", "text", false],
    ["phone", "Phone", "tel", false],
    ["email", "Email", "email", false],
  ] as const;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl">
        <DialogHeader><DialogTitle>{supplier ? "Edit supplier" : "Add supplier"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {fields.map(([k, label, type, req]) => (
            <div key={k} className="space-y-1.5">
              <Label>{label}</Label>
              <Input type={type} required={req} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
            </div>
          ))}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="brand" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save supplier"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
