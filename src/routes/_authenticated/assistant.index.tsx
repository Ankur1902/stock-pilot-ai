import { useEffect, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { GlassCard, LoadingRows } from "@/components/app/ui-bits";

export const Route = createFileRoute("/_authenticated/assistant/")({
  head: () => ({
    meta: [
      { title: "Ask Pilot — StockPilot" },
      { name: "description", content: "Chat with your inventory using AI." },
      { property: "og:title", content: "Ask Pilot — StockPilot" },
      { property: "og:description", content: "Chat with your inventory using AI." },
    ],
  }),
  component: AssistantIndex,
});

function AssistantIndex() {
  const navigate = useNavigate();
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const { data } = await supabase.from("chat_threads").select("id").order("updated_at", { ascending: false }).limit(1);
      let id = data?.[0]?.id;
      if (!id) {
        const { data: t, error } = await supabase.from("chat_threads").insert({}).select("id").single();
        if (error) return;
        id = t.id;
      }
      navigate({ to: "/assistant/$threadId", params: { threadId: id }, replace: true });
    })();
  }, [navigate]);
  return <GlassCard><LoadingRows rows={4} /></GlassCard>;
}
