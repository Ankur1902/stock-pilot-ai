import type { ReactNode } from "react";
import { AlertCircle, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export function GlassCard({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("glass rounded-2xl", className)}>{children}</div>;
}

export function PageHeader({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">{eyebrow}</div>
        <h1 className="text-[26px] font-extrabold tracking-tight">{title}</h1>
      </div>
      {action}
    </header>
  );
}

type Tone = "success" | "warning" | "danger" | "info";
const tones: Record<Tone, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-destructive",
  info: "bg-accent text-accent-foreground",
};
export function StatusBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone])}>
      {children}
    </span>
  );
}

export function StockBadge({ stock, min }: { stock: number; min: number }) {
  if (stock === 0) return <StatusBadge tone="danger">Out of stock</StatusBadge>;
  if (stock <= min) return <StatusBadge tone="warning">Low stock</StatusBadge>;
  return <StatusBadge tone="success">In stock</StatusBadge>;
}

export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-accent text-primary">
        <Inbox className="size-5" />
      </div>
      <div className="font-bold">{title}</div>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error }: { error: unknown }) {
  return (
    <div className="flex items-center gap-3 p-6 text-sm text-destructive">
      <AlertCircle className="size-5" />
      {error instanceof Error ? error.message : "Something went wrong loading this data."}
    </div>
  );
}

export function LoadingRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full rounded-xl" />
      ))}
    </div>
  );
}
