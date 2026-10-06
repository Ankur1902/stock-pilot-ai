import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type PurchaseOrder = Database["public"]["Tables"]["purchase_orders"]["Row"] & {
  suppliers: { name: string; email: string | null } | null;
  purchase_order_items: { id: string; product_id: string; quantity: number; unit_cost: number; products: { name: string; sku: string } | null }[];
};
export type Notification = Database["public"]["Tables"]["notifications"]["Row"];
export type ChatThread = Database["public"]["Tables"]["chat_threads"]["Row"];

const msg = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e));

/* ---------- Purchase orders ---------- */
export function usePurchaseOrders() {
  return useQuery({
    queryKey: ["purchase_orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("*, suppliers(name,email), purchase_order_items(id,product_id,quantity,unit_cost,products(name,sku))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as PurchaseOrder[];
    },
  });
}

export function useCreatePurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { supplier_id: string | null; expected_date: string | null; note: string; items: { product_id: string; quantity: number; unit_cost: number }[] }) => {
      const { data: po, error } = await supabase
        .from("purchase_orders")
        .insert({ supplier_id: v.supplier_id, expected_date: v.expected_date, note: v.note || null, status: "ordered" })
        .select("id")
        .single();
      if (error) throw error;
      const { error: e2 } = await supabase.from("purchase_order_items").insert(v.items.map((i) => ({ ...i, purchase_order_id: po.id })));
      if (e2) {
        await supabase.from("purchase_orders").delete().eq("id", po.id);
        throw e2;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase_orders"] });
      toast.success("Purchase order created");
    },
    onError: (e) => toast.error(msg(e)),
  });
}

export function useReceivePurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("receive_purchase_order", { _po_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("Order received — stock updated");
    },
    onError: (e) => toast.error(msg(e)),
  });
}

export function useCancelPurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("purchase_orders").update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase_orders"] });
      toast.success("Order cancelled");
    },
    onError: (e) => toast.error(msg(e)),
  });
}

/* ---------- Notifications ---------- */
export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(30);
      if (error) throw error;
      return data;
    },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("notifications").update({ read: true }).eq("read", false);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
    onError: (e) => toast.error(msg(e)),
  });
}

export function useClearNotifications() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("notifications").delete().eq("read", true);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
    onError: (e) => toast.error(msg(e)),
  });
}

/* ---------- Chat threads ---------- */
export function useThreads() {
  return useQuery({
    queryKey: ["threads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("chat_threads").select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/* ---------- CSV ---------- */
export function toCsv(rows: (string | number | null | undefined)[][]) {
  return rows
    .map((r) => r.map((c) => {
      const s = c == null ? "" : String(c);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(","))
    .join("\n");
}

export function downloadCsv(name: string, rows: (string | number | null | undefined)[][]) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
    } else cur += ch;
  }
  row.push(cur);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}
