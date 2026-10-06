import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Mail, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { draftReorderEmail } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Shimmer } from "@/components/ai-elements/shimmer";

export function EmailDraftDialog({
  supplierId,
  supplierName,
  items,
  senderName,
  onClose,
}: {
  supplierId: string;
  supplierName: string;
  items: { productId: string; quantity: number }[];
  senderName?: string;
  onClose: () => void;
}) {
  const draft = useServerFn(draftReorderEmail);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const run = async () => {
    setLoading(true);
    setError("");
    const r = await draft({ data: { supplierId, items, senderName } }).catch((e: Error) => ({ ok: false as const, error: e.message }));
    setLoading(false);
    if (!r.ok) return setError(r.error);
    setTo(r.data.to);
    setSubject(r.data.subject);
    setBody(r.data.body);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { run(); }, []);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-xl">
        <DialogHeader><DialogTitle>Reorder email to {supplierName}</DialogTitle></DialogHeader>
        {loading ? (
          <div className="py-10 text-center"><Shimmer>Writing your email…</Shimmer></div>
        ) : error ? (
          <p className="py-6 text-sm text-destructive">{error}</p>
        ) : (
          <div className="space-y-3">
            <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Supplier email" />
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            <Textarea rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={run} disabled={loading}><RefreshCcw /> Rewrite</Button>
          <Button variant="outline" disabled={loading || !!error} onClick={() => { navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`); toast.success("Copied"); }}><Copy /> Copy</Button>
          <Button variant="brand" disabled={loading || !!error} asChild>
            <a href={`mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}><Mail /> Open in email</a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
