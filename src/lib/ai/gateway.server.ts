import { createOpenAI } from "@ai-sdk/openai";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createLovableAiGatewayRunIdFetch } from "./run-id.server";

export const AI_MODEL = "openai/gpt-6-astra";
const GATEWAY = "https://ai.gateway.lovable.dev/v1";

export function getApiKey() {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI is not configured (missing LOVABLE_API_KEY).");
  return key;
}

/** Creates a per-request Responses provider + run-id fetch wrapper. */
export function createGateway(initialRunId?: string) {
  const apiKey = getApiKey();
  const runIdFetch = createLovableAiGatewayRunIdFetch(initialRunId);
  const provider = createOpenAI({
    baseURL: GATEWAY,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });
  return { model: provider.responses(AI_MODEL), runIdFetch };
}

export const responsesOptions = {
  openai: {
    forceReasoning: true,
    reasoningEffort: "low",
    reasoningSummary: "auto",
    store: false,
    include: ["reasoning.encrypted_content"],
  },
} as const;

/** Turns a gateway/SDK error into a status + friendly message. */
export function describeAiError(e: unknown): { status: number; message: string } {
  const err = e as { statusCode?: number; status?: number; message?: string; responseBody?: string };
  const status = err?.statusCode ?? err?.status ?? 500;
  if (status === 429) return { status, message: "The AI is busy right now. Please try again in a minute." };
  if (status === 402) return { status, message: "AI credits have run out. Add credits in your workspace billing settings to keep using AI features." };
  if (status === 403) return { status, message: "AI access is blocked for this workspace." };
  return { status, message: err?.message || "The AI request failed." };
}

/** Supabase client acting as the user behind a bearer token (RLS applies). */
export async function userClientFromRequest(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || token.split(".").length !== 3) return null;
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const supabase = createClient<Database>(url, key, {
    global: {
      headers: { Authorization: `Bearer ${token}`, apikey: key },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;
  return { supabase, userId: data.claims.sub as string };
}
