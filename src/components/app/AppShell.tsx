import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, Package, ArrowLeftRight, Truck, Sparkles, LogOut, Menu, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { to: "/products", label: "Products", icon: Package },
  { to: "/movements", label: "Stock Movements", icon: ArrowLeftRight },
  { to: "/suppliers", label: "Suppliers", icon: Truck },
  { to: "/insights", label: "AI Insights", icon: Sparkles },
] as const;

export function AppShell({ email, children }: { email: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

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
        <div className="eyebrow">Signed in</div>
        <div className="mt-1 truncate text-sm font-semibold">{email}</div>
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
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none fixed -left-24 -top-40 size-[560px] rounded-full bg-primary/25 blur-[130px]" />
      <div className="pointer-events-none fixed right-0 top-1/3 size-[520px] rounded-full bg-brand-2/25 blur-[130px]" />
      <div className="pointer-events-none fixed bottom-0 left-1/3 size-[480px] rounded-full bg-accent blur-[120px]" />

      <div className="relative flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 border-r border-sidebar-border bg-sidebar backdrop-blur-xl lg:block">
          {sidebar}
        </aside>

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
          <div className="mb-4 flex items-center gap-3 lg:hidden">
            <button className="glass grid size-10 place-items-center rounded-xl" onClick={() => setOpen(true)} aria-label="Open menu">
              <Menu className="size-5" />
            </button>
            <span className="font-extrabold tracking-tight">StockPilot</span>
          </div>
          <div className={cn("mx-auto max-w-7xl")}>{children}</div>
        </main>
      </div>
    </div>
  );
}
