import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Product = Database["public"]["Tables"]["products"]["Row"] & {
  suppliers: { name: string } | null;
};
export type Supplier = Database["public"]["Tables"]["suppliers"]["Row"];
export type Movement = Database["public"]["Tables"]["stock_movements"]["Row"] & {
  products: { name: string; sku: string } | null;
};
export type ProductInput = Database["public"]["Tables"]["products"]["Insert"];
export type SupplierInput = Database["public"]["Tables"]["suppliers"]["Insert"];

export const isLow = (p: { current_stock: number; min_stock: number }) =>
  p.current_stock <= p.min_stock;

export const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
export const num = (n: number) => new Intl.NumberFormat("en-US").format(n);

export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, suppliers(name)")
        .order("name");
      if (error) throw error;
      return data as Product[];
    },
  });
}

export function useSuppliers() {
  return useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useMovements(limit?: number) {
  return useQuery({
    queryKey: ["movements", limit ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("stock_movements")
        .select("*, products(name, sku)")
        .order("created_at", { ascending: false });
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (error) throw error;
      return data as Movement[];
    },
  });
}

function errMsg(e: unknown) {
  const m = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
  if (m.includes("products_user_id_sku_key")) return "A product with this SKU already exists.";
  return m;
}

export function useSaveProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: ProductInput & { id?: string }) => {
      const { error } = id
        ? await supabase.from("products").update(input).eq("id", id)
        : await supabase.from("products").insert(input);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success(v.id ? "Product updated" : "Product added");
    },
    onError: (e) => toast.error(errMsg(e)),
  });
}

export function useDeleteRow(table: "products" | "suppliers") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success(table === "products" ? "Product deleted" : "Supplier deleted");
    },
    onError: (e) => toast.error(errMsg(e)),
  });
}

export function useSaveSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: SupplierInput & { id?: string }) => {
      const { error } = id
        ? await supabase.from("suppliers").update(input).eq("id", id)
        : await supabase.from("suppliers").insert(input);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries();
      toast.success(v.id ? "Supplier updated" : "Supplier added");
    },
    onError: (e) => toast.error(errMsg(e)),
  });
}

export function useRecordMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { product_id: string; type: "in" | "out"; quantity: number; date: string; note: string }) => {
      const { data, error } = await supabase.rpc("record_stock_movement", {
        _product_id: v.product_id,
        _type: v.type,
        _quantity: v.quantity,
        _date: v.date,
        _note: v.note,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (stock) => {
      qc.invalidateQueries();
      toast.success(`Stock updated — now ${num(Number(stock))} units`);
    },
    onError: (e) => toast.error(errMsg(e)),
  });
}
