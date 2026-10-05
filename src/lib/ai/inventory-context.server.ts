import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Compact text snapshot of the user's inventory for AI prompts (RLS-scoped). */
export async function buildInventorySnapshot(supabase: SupabaseClient<Database>) {
  const since = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const [p, s, m, po] = await Promise.all([
    supabase.from("products").select("id,name,sku,category,cost_price,selling_price,current_stock,min_stock,suppliers(name)").order("name"),
    supabase.from("suppliers").select("name,contact_person,email,phone").order("name"),
    supabase.from("stock_movements").select("product_id,type,quantity,movement_date,note").gte("movement_date", since).order("movement_date"),
    supabase.from("purchase_orders").select("status,expected_date,created_at,suppliers(name),purchase_order_items(quantity,products(name))").in("status", ["draft", "ordered"]),
  ]);
  for (const r of [p, s, m, po]) if (r.error) throw r.error;

  const out30 = new Map<string, number>();
  const in30 = new Map<string, number>();
  const cutoff = Date.now() - 30 * 86400000;
  for (const mv of m.data ?? []) {
    if (new Date(mv.movement_date).getTime() < cutoff) continue;
    const map = mv.type === "out" ? out30 : in30;
    map.set(mv.product_id, (map.get(mv.product_id) ?? 0) + mv.quantity);
  }
  const products = (p.data ?? []) as unknown as Array<{
    id: string; name: string; sku: string; category: string | null; cost_price: number; selling_price: number;
    current_stock: number; min_stock: number; suppliers: { name: string } | null;
  }>;
  const totalValue = products.reduce((a, x) => a + x.current_stock * Number(x.cost_price), 0);

  const lines = [
    `Today: ${new Date().toISOString().slice(0, 10)}. Currency: USD.`,
    `Products (${products.length}), total inventory value at cost $${totalValue.toFixed(2)}:`,
    "name | sku | category | supplier | cost | price | on_hand | min | out_last_30d | in_last_30d",
    ...products.map((x) =>
      [x.name, x.sku, x.category ?? "-", x.suppliers?.name ?? "-", Number(x.cost_price), Number(x.selling_price), x.current_stock, x.min_stock, out30.get(x.id) ?? 0, in30.get(x.id) ?? 0].join(" | "),
    ),
    "",
    "Suppliers: " + ((s.data ?? []).map((x) => `${x.name} (contact ${x.contact_person ?? "-"}, ${x.email ?? "no email"})`).join("; ") || "none"),
    "",
    "Open purchase orders: " +
      ((po.data ?? []) as unknown as Array<{ status: string; expected_date: string | null; suppliers: { name: string } | null; purchase_order_items: { quantity: number; products: { name: string } | null }[] }>)
        .map((o) => `${o.status} to ${o.suppliers?.name ?? "?"}${o.expected_date ? ` due ${o.expected_date}` : ""}: ${o.purchase_order_items.map((i) => `${i.quantity}× ${i.products?.name}`).join(", ")}`)
        .join("; ") || "none",
    "",
    `Movements in last 90 days: ${(m.data ?? []).length}.`,
  ];
  return lines.join("\n");
}
