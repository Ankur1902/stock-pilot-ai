import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { z } from "zod";
import { createGateway, describeAiError, responsesOptions, userClientFromRequest } from "@/lib/ai/gateway.server";
import { buildInventorySnapshot } from "@/lib/ai/inventory-context.server";
import { getLovableAiGatewayRunId, withLovableAiGatewayRunIdHeader } from "@/lib/ai/run-id.server";

const Body = z.object({
  threadId: z.string().uuid(),
  messages: z.array(z.any()).min(1).max(200),
});

const json = (status: number, message: string) =>
  new Response(JSON.stringify({ error: message }), { status, headers: { "content-type": "application/json" } });

async function handle(request: Request) {
  const auth = await userClientFromRequest(request);
  if (!auth) return json(401, "Please sign in again.");
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(400, "Invalid chat request.");
  const { threadId } = parsed.data;
  const messages = parsed.data.messages as UIMessage[];
  const { supabase, userId } = auth;

  const { data: thread } = await supabase.from("chat_threads").select("id,title").eq("id", threadId).maybeSingle();
  if (!thread) return json(404, "Conversation not found.");

  let snapshot: string;
  try {
    snapshot = await buildInventorySnapshot(supabase);
  } catch {
    return json(500, "Couldn't load your inventory data.");
  }

  const { model, runIdFetch } = createGateway(getLovableAiGatewayRunId(request));
  const result = streamText({
    model,
    abortSignal: request.signal,
    providerOptions: responsesOptions,
    system: [
      "You are Pilot, the inventory assistant inside StockPilot. Answer using ONLY the user's inventory data below.",
      "Be concise and practical. Use short markdown: bullet lists and small tables when helpful. Use exact names and numbers from the data.",
      "Days of cover = (on_hand - min) / (out_last_30d / 30). Never invent products or numbers; say so when data is missing.",
      "You cannot change data yourself; tell the user which page to use (Products, Stock Movements, Purchase Orders, Suppliers).",
      "",
      "=== INVENTORY DATA ===",
      snapshot,
    ].join("\n"),
    messages: await convertToModelMessages(messages),
  });

  const response = result.toUIMessageStreamResponse({
    originalMessages: messages,
    sendReasoning: true,
    onError: (e) => describeAiError(e).message,
    onFinish: async ({ messages: all }) => {
      const rows = all.map((m) => ({ thread_id: threadId, user_id: userId, message_key: m.id, message: m as never }));
      const { error } = await supabase.from("chat_messages").upsert(rows, { onConflict: "thread_id,message_key" });
      if (error) console.error("[chat] failed to save messages", error);
      const firstUser = all.find((m) => m.role === "user");
      const text = firstUser?.parts.map((p) => (p.type === "text" ? p.text : "")).join(" ").trim();
      const patch: { updated_at: string; title?: string } = { updated_at: new Date().toISOString() };
      if (thread.title === "New chat" && text) patch.title = text.slice(0, 60);
      const up = await supabase.from("chat_threads").update(patch).eq("id", threadId);
      if (up.error) console.error("[chat] failed to update thread", up.error);
    },
  });
  return withLovableAiGatewayRunIdHeader(response, runIdFetch);
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          return await handle(request);
        } catch (e) {
          if ((e as Error)?.name === "AbortError") return new Response(null, { status: 499 });
          const { status, message } = describeAiError(e);
          return json(status, message);
        }
      },
    },
  },
});
