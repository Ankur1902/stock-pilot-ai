import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { toast } from "sonner";
import { MessageSquarePlus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useThreads } from "@/lib/extras";
import { Button } from "@/components/ui/button";
import { GlassCard, LoadingRows, PageHeader } from "@/components/app/ui-bits";
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import pilot from "@/assets/pilot.png";

export const Route = createFileRoute("/_authenticated/assistant/$threadId")({
  head: () => ({
    meta: [
      { title: "Ask Pilot — StockPilot" },
      { name: "description", content: "Chat with your inventory using AI." },
      { property: "og:title", content: "Ask Pilot — StockPilot" },
      { property: "og:description", content: "Chat with your inventory using AI." },
    ],
  }),
  component: AssistantPage,
});

const SUGGESTIONS = [
  "What should I reorder this week?",
  "Which products are tying up the most cash?",
  "Summarise stock movements from the last 30 days",
  "Which supplier do I depend on most?",
];

function AssistantPage() {
  const { threadId } = Route.useParams();
  const threads = useThreads();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const history = useQuery({
    queryKey: ["chat_messages", threadId],
    queryFn: async () => {
      const { data, error } = await supabase.from("chat_messages").select("message").eq("thread_id", threadId).order("created_at").order("id");
      if (error) throw error;
      return (data ?? []).map((r) => r.message as unknown as UIMessage);
    },
    staleTime: Infinity,
  });

  const newThread = async () => {
    const { data, error } = await supabase.from("chat_threads").insert({}).select("id").single();
    if (error) return toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["threads"] });
    navigate({ to: "/assistant/$threadId", params: { threadId: data.id } });
  };

  const deleteThread = async (id: string) => {
    const { error } = await supabase.from("chat_threads").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["threads"] });
    if (id === threadId) navigate({ to: "/assistant" });
  };

  return (
    <>
      <PageHeader eyebrow="AI assistant" title="Ask Pilot" action={<Button variant="brand" onClick={newThread}><MessageSquarePlus /> New chat</Button>} />
      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <GlassCard className="max-h-[220px] overflow-y-auto p-2 lg:max-h-[calc(100vh-180px)]">
          {threads.isLoading ? <LoadingRows rows={3} /> : (threads.data ?? []).map((t) => (
            <div key={t.id} className={cn("group flex items-center gap-1 rounded-xl", t.id === threadId && "bg-accent")}>
              <Link to="/assistant/$threadId" params={{ threadId: t.id }} className="min-w-0 flex-1 truncate px-3 py-2 text-sm font-medium">
                {t.title}
              </Link>
              <button onClick={() => deleteThread(t.id)} className="p-2 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100" aria-label="Delete chat">
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </GlassCard>
        <GlassCard className="flex h-[calc(100vh-180px)] min-h-[480px] flex-col overflow-hidden">
          {history.isLoading ? <LoadingRows /> : history.error ? (
            <div className="p-6 text-sm text-destructive">Couldn't load this conversation.</div>
          ) : (
            <ChatWindow key={threadId} threadId={threadId} initial={history.data ?? []} />
          )}
        </GlassCard>
      </div>
    </>
  );
}

function ChatWindow({ threadId, initial }: { threadId: string; initial: UIMessage[] }) {
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const textRef = useRef<HTMLTextAreaElement>(null);
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { threadId },
        headers: async (): Promise<Record<string, string>> => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
      }),
    [threadId],
  );
  const { messages, sendMessage, status, stop } = useChat({
    id: threadId,
    messages: initial,
    transport,
    onError: (e) => {
      let m = e.message;
      try { m = JSON.parse(m).error ?? m; } catch { /* plain text */ }
      toast.error(m || "The assistant couldn't answer.");
    },
    onFinish: () => {
      qc.invalidateQueries({ queryKey: ["threads"] });
      qc.invalidateQueries({ queryKey: ["chat_messages", threadId] });
    },
  });
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (!busy) textRef.current?.focus();
  }, [busy]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    sendMessage({ text: t });
    setInput("");
  };
  const last = messages[messages.length - 1];
  const waiting = busy && (last?.role === "user" || !last?.parts.some((p) => p.type === "text" && p.text));

  return (
    <>
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState>
              <img src={pilot} alt="Pilot" width={88} height={88} className="mb-2" />
              <div className="font-bold">Hi, I'm Pilot</div>
              <p className="max-w-sm text-sm text-muted-foreground">Ask me anything about your stock, suppliers and orders. I read your live inventory.</p>
              <div className="mt-4 flex max-w-lg flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded-full border border-glass-border bg-card px-3 py-1.5 text-xs font-medium hover:border-primary hover:text-primary">{s}</button>
                ))}
              </div>
            </ConversationEmptyState>
          ) : (
            messages.map((m) => (
              <Message key={m.id} from={m.role}>
                <MessageContent className={m.role === "user" ? "!bg-primary !text-primary-foreground" : ""}>
                  {m.parts.map((p, i) =>
                    p.type === "text" ? (m.role === "assistant" ? <MessageResponse key={i}>{p.text}</MessageResponse> : <span key={i} className="whitespace-pre-wrap">{p.text}</span>) : null,
                  )}
                </MessageContent>
              </Message>
            ))
          )}
          {waiting && (
            <div className="flex items-center gap-2 text-sm">
              <img src={pilot} alt="" width={24} height={24} />
              <Shimmer>Checking your inventory…</Shimmer>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="border-t border-glass-border p-3">
        <PromptInput onSubmit={({ text }) => send(text)}>
          <PromptInputTextarea ref={textRef} autoFocus value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about stock, reorders, suppliers…" />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} onStop={stop} disabled={!busy && !input.trim()} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </>
  );
}
