import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/AppShell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Local session read (no network round-trip on every tab switch); RLS still enforces access server-side.
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) throw redirect({ to: "/auth" });
    return { user };
  },
  component: Layout,
});

function Layout() {
  const { user } = Route.useRouteContext();
  return (
    <AppShell email={user.email ?? ""} initialName={String(user.user_metadata?.["full_name"] ?? "")}>
      <Outlet />
    </AppShell>
  );
}
