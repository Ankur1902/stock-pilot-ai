import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCcw, Wand2 } from "lucide-react";
import { generateInsights } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/app/ui-bits";
import { MessageResponse } from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import pilot from "@/assets/pilot.png";

export function AiBriefing() {
  const gen = useServerFn(generateInsights);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    setError("");
    const r = await gen().catch((e: Error) => ({ ok: false as const, error: e.message }));
    setLoading(false);
    if (r.ok) setText(r.data);
    else setError(r.error);
  };

  return (
    <GlassCard className="mb-6 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <img src={pilot} alt="Pilot" width={40} height={40} />
        <div className="flex-1">
          <div className="font-bold">AI briefing</div>
          <div className="text-xs text-muted-foreground">Pilot reads your live stock, movements and orders and writes a plan.</div>
        </div>
        <Button variant="brand" onClick={run} disabled={loading}>
          {text ? <RefreshCcw /> : <Wand2 />} {text ? "Refresh" : "Generate briefing"}
        </Button>
      </div>
      {loading && <div className="mt-4"><Shimmer>Analysing your inventory…</Shimmer></div>}
      {error && !loading && <p className="mt-4 text-sm text-destructive">{error}</p>}
      {text && !loading && <div className="prose-sm mt-4 text-sm"><MessageResponse>{text}</MessageResponse></div>}
    </GlassCard>
  );
}
