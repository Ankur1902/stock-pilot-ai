import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function run<T>(fn: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    const { describeAiError } = await import("@/lib/ai/gateway.server");
    console.error("[ai]", e);
    return { ok: false, error: describeAiError(e).message };
  }
}

/** AI-written insights briefing in markdown. */
export const generateInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) =>
    run(async () => {
      const { streamText } = await import("ai");
      const { createGateway, responsesOptions } = await import("@/lib/ai/gateway.server");
      const { buildInventorySnapshot } = await import("@/lib/ai/inventory-context.server");
      const snapshot = await buildInventorySnapshot(context.supabase);
      const { model } = createGateway();
      const result = streamText({
        model,
        providerOptions: responsesOptions,
        system:
          "You are an inventory analyst. Write a short, plain-language briefing for a small business owner using ONLY the data given. Never invent numbers.",
        prompt: `${snapshot}\n\nWrite markdown with these sections (keep the whole thing under 250 words):\n### Summary\n2-3 sentences.\n### Act now\nBullets for out-of-stock / below-minimum items with a suggested reorder quantity and supplier.\n### Watch list\nItems likely to hit minimum within ~2 weeks based on last-30-day outflow.\n### Overstock\nItems tying up cash with slow movement.\n### One tip\nOne practical suggestion.`,
      });
      const text = await result.text;
      if (!text.trim()) throw new Error("The AI returned an empty answer.");
      return text;
    }),
  );

const ProductDraft = z.object({
  name: z.string(),
  sku: z.string(),
  category: z.string().nullable(),
  supplier_name: z.string().nullable(),
  cost_price: z.number().nullable(),
  selling_price: z.number().nullable(),
  current_stock: z.number().nullable(),
  min_stock: z.number().nullable(),
});
export type ProductDraft = z.infer<typeof ProductDraft>;

/** Smart product entry: turn free text into product form fields. */
export const extractProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ text: z.string().min(3).max(4000) }).parse(d))
  .handler(async ({ data, context }) =>
    run(async () => {
      const { streamText, Output } = await import("ai");
      const { createGateway, responsesOptions } = await import("@/lib/ai/gateway.server");
      const [{ data: sup }, { data: cats }] = await Promise.all([
        context.supabase.from("suppliers").select("name"),
        context.supabase.from("products").select("category"),
      ]);
      const { model } = createGateway();
      const result = streamText({
        model,
        providerOptions: responsesOptions,
        output: Output.object({ schema: ProductDraft }),
        system:
          "Extract one product for an inventory system from the user's text. Use null for anything not stated. If no SKU is given, invent a short uppercase SKU like CAT-NAME-01. Prefer an existing category and supplier name when one fits. Prices are numbers without currency symbols.",
        prompt: `Existing suppliers: ${(sup ?? []).map((s) => s.name).join(", ") || "none"}\nExisting categories: ${[...new Set((cats ?? []).map((c) => c.category).filter(Boolean))].join(", ") || "none"}\n\nText:\n${data.text}`,
      });
      return (await result.output) as ProductDraft;
    }),
  );

/** Draft a reorder email to a supplier for the given products. */
export const draftReorderEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      supplierId: z.string().uuid(),
      items: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().int().positive() })).min(1).max(50),
      senderName: z.string().max(80).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) =>
    run(async () => {
      const { streamText, Output } = await import("ai");
      const { createGateway, responsesOptions } = await import("@/lib/ai/gateway.server");
      const { data: supplier, error } = await context.supabase.from("suppliers").select("name,contact_person,email").eq("id", data.supplierId).single();
      if (error) throw error;
      const { data: prods } = await context.supabase.from("products").select("id,name,sku").in("id", data.items.map((i) => i.productId));
      const lines = data.items.map((i) => {
        const p = prods?.find((x) => x.id === i.productId);
        return `- ${p?.name ?? "Unknown"} (SKU ${p?.sku ?? "?"}): ${i.quantity} units`;
      });
      const { model } = createGateway();
      const result = streamText({
        model,
        providerOptions: responsesOptions,
        output: Output.object({ schema: z.object({ subject: z.string(), body: z.string() }) }),
        system: "Write a short, polite, professional purchase/reorder email in plain text. No placeholders in square brackets except none. Keep it under 150 words.",
        prompt: `Supplier: ${supplier.name}. Contact: ${supplier.contact_person ?? "the team"}.\nSender name: ${data.senderName || "StockPilot user"}.\nItems to order:\n${lines.join("\n")}\nAsk them to confirm price, availability and delivery date.`,
      });
      const out = await result.output;
      return { ...out, to: supplier.email ?? "" };
    }),
  );
