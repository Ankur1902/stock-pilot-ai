import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useClearNotifications, useMarkAllRead, useNotifications } from "@/lib/extras";

export function NotificationBell() {
  const { data } = useNotifications();
  const markAll = useMarkAllRead();
  const clear = useClearNotifications();
  const [open, setOpen] = useState(false);
  const unread = (data ?? []).filter((n) => !n.read).length;

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o && unread) markAll.mutate();
      }}
    >
      <PopoverTrigger asChild>
        <button className="glass relative grid size-10 place-items-center rounded-xl" aria-label={`Notifications${unread ? ` (${unread} new)` : ""}`}>
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 rounded-2xl p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-bold">Stock alerts</span>
          <button className="text-xs font-semibold text-primary hover:underline" onClick={() => clear.mutate()}>Clear read</button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {!data?.length ? (
            <p className="p-6 text-center text-sm text-muted-foreground">You're all caught up.</p>
          ) : (
            data.map((n) => (
              <Link key={n.id} to="/products" onClick={() => setOpen(false)} className={cn("block border-b border-border/60 px-4 py-3 hover:bg-accent", !n.read && "bg-accent/50")}>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {!n.read && <span className="size-1.5 rounded-full bg-primary" />}
                  {n.title}
                </div>
                <div className="text-xs text-muted-foreground">{n.body} · {new Date(n.created_at).toLocaleDateString()}</div>
              </Link>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
