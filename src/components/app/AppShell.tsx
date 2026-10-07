import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LayoutGrid, Package, ArrowLeftRight, Truck, Sparkles, LogOut, Menu, X, Pencil, ClipboardList, BarChart3, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NotificationBell } from "@/components/app/NotificationBell";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { to: "/products", label: "Products", icon: Package },
  { to: "/movements", label: "Stock Movements", icon: ArrowLeftRight },
  { to: "/purchase-orders", label: "Purchase Orders", icon: ClipboardList },
  { to: "/suppliers", label: "Suppliers", icon: Truck },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/insights", label: "AI Insights", icon: Sparkles },
  { to: "/assistant", label: "Ask Pilot", icon: MessageCircle },
] as const;

export function AppShell({
  email,
  initialName,
  children,
}: {
  email: string;
  initialName: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [name, setName] = useState(initialName);
  const [editName, setEditName] = useState(false);
  const [draft, setDraft] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const initials =
    (name || email).split(/[\s@]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";

  const saveName = async (e: FormEvent) => {
    e.preventDefault();
    const clean = draft.trim().slice(0, 80);
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ data: { full_name: clean } });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setName(clean);
    setEditName(false);
    toast.success("Name saved");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    qc.clear();
    navigate({ to: "/auth" });
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 p-5">
        <div className="grid size-9 place-items-center rounded-xl bg-gradient-brand text-lg font-extrabold text-primary-foreground shadow-brand">
          P
        </div>
        <div className="text-[17px] font-extrabold tracking-tight text-foreground">StockPilot</div>
      </div>
      <nav className="space-y-1 px-3">
        {nav.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent"
            activeProps={{
              className: "!bg-gradient-brand !text-primary-foreground font-semibold shadow-brand",
            }}
          >
            <Icon className="size-4" /> {label}
          </Link>
        ))}
      </nav>
      <div className="mx-3 mb-4 mt-auto rounded-2xl glass p-4">
        <div className="flex items-center gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-brand text-xs font-bold text-primary-foreground">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{name || "Add your name"}</div>
            {!name && <div className="truncate text-xs text-muted-foreground">{email}</div>}
          </div>
          <button
            onClick={() => {
              setDraft(name);
              setEditName(true);
            }}
            className="text-muted-foreground hover:text-primary"
            aria-label="Edit name"
          >
            <Pencil className="size-3.5" />
          </button>
        </div>
        <button
          onClick={signOut}
          className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-primary hover:underline"
        >
          <LogOut className="size-3.5" /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-40 size-[560px] rounded-full bg-primary/25 blur-[130px]" />
        <div className="absolute right-0 top-1/3 size-[520px] rounded-full bg-brand-2/25 blur-[130px]" />
        <div className="absolute bottom-0 left-1/3 size-[480px] rounded-full bg-accent blur-[120px]" />
      </div>

      <Dialog open={editName} onOpenChange={setEditName}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Your name</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Signed in as <span className="font-medium text-foreground">{email}</span>
            </p>
          </DialogHeader>
          <form onSubmit={saveName} className="space-y-4">
            <Input autoFocus maxLength={80} placeholder="e.g. Ankur Singh" value={draft} onChange={(e) => setDraft(e.target.value)} />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditName(false)}>Cancel</Button>
              <Button type="submit" variant="brand" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="relative flex min-h-screen">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] border-r border-sidebar-border bg-sidebar backdrop-blur-xl lg:block">
          {sidebar}
        </aside>
        <div className="hidden w-[248px] shrink-0 lg:block" />

        {open && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-foreground/20" onClick={() => setOpen(false)} />
            <aside className="absolute inset-y-0 left-0 w-[260px] bg-card">
              <button className="absolute right-3 top-5 p-1" onClick={() => setOpen(false)} aria-label="Close menu">
                <X className="size-5" />
              </button>
              {sidebar}
            </aside>
          </div>
        )}

        <main className="min-w-0 flex-1 p-4 sm:p-7">
          <div className="mx-auto mb-4 flex max-w-7xl items-center gap-3">
            <button className="glass grid size-10 place-items-center rounded-xl lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
              <Menu className="size-5" />
            </button>
            <span className="font-extrabold tracking-tight lg:hidden">StockPilot</span>
            <div className="ml-auto"><NotificationBell /></div>
          </div>
          <div className={cn("mx-auto max-w-7xl")}>{children}</div>
        </main>
      </div>
    </div>
  );
}
