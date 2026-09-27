import { createFileRoute, Link, Outlet, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { listThreads, createThread } from "@/lib/threads.functions";
import { getMyAccess } from "@/lib/waitlist.functions";
import { Button } from "@/components/ui/button";
import { MODE_META, type DesignMode } from "@/lib/design-agent";
import { BookOpen, FileText, Gauge, GitBranch, KeyRound, LogOut, Plus, Cpu, History, Users, Hourglass } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppShell,
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-destructive">{(error as Error).message}</div>
  ),
});

const NAV = [
  { to: "/app/designs", label: "Designs", icon: FileText },
  { to: "/app/review", label: "Review a doc", icon: Gauge },
  { to: "/app/library", label: "Library", icon: BookOpen },
  { to: "/app/api", label: "API access", icon: KeyRound },
  { to: "/app/logs", label: "Request log", icon: History },
  { to: "/app/model", label: "AI model", icon: Cpu },
] as const;

function AppShell() {
  const navigate = useNavigate();
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  const access = useQuery({ queryKey: ["my-access"], queryFn: () => getMyAccess() });
  const approved = access.data?.status === "approved";
  const threads = useQuery({
    queryKey: ["threads"],
    queryFn: () => listThreads(),
    enabled: approved,
  });

  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth" });
  }

  if (access.isLoading) {
    return <div className="grid h-screen place-items-center label-mono text-muted-foreground">Loading…</div>;
  }
  if (!approved) {
    return <WaitlistScreen status={access.data?.status ?? "pending"} onSignOut={signOut} />;
  }

  async function startThread(mode: DesignMode) {
    setCreating(true);
    try {
      const thread = await createThread({ data: { title: "New design", mode } });
      await threads.refetch();
      navigate({ to: "/app/$threadId", params: { threadId: thread.id } });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <aside className="flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="flex items-center gap-2.5 border-b border-sidebar-border px-4 py-4">
          <div className="grid size-6 place-items-center rounded bg-primary">
            <GitBranch className="size-3.5 text-primary-foreground" />
          </div>
          <span className="font-display text-sm font-bold tracking-tight">ARCHITECT_OS</span>
        </div>

        <div className="space-y-1 border-b border-sidebar-border p-3">
          <p className="label-mono px-1 pb-1.5 text-muted-foreground">New session</p>
          {(Object.keys(MODE_META) as DesignMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              disabled={creating}
              onClick={() => startThread(mode)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent disabled:opacity-50"
            >
              <Plus className="size-3.5 text-primary" />
              {MODE_META[mode].label}
            </button>
          ))}
        </div>

        <nav className="space-y-1 border-b border-sidebar-border p-3">
          {[...NAV, ...(access.data?.isAdmin ? [{ to: "/app/waitlist", label: "Waitlist", icon: Users }, { to: "/app/queue", label: "Live queue", icon: Hourglass }] as const : [])].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground [&.active]:bg-secondary [&.active]:text-primary"
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <p className="label-mono px-1 pb-2 text-muted-foreground">Sessions</p>
          <div className="space-y-0.5">
            {(threads.data ?? []).map((thread) => (
              <Link
                key={thread.id}
                to="/app/$threadId"
                params={{ threadId: thread.id }}
                className="block truncate rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground [&.active]:bg-secondary [&.active]:font-medium [&.active]:text-foreground"
              >
                {thread.title}
              </Link>
            ))}
            {threads.data?.length === 0 && (
              <p className="px-2 text-xs text-muted-foreground">No sessions yet.</p>
            )}
          </div>
        </div>

        <div className="border-t border-sidebar-border p-3">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={signOut}
          >
            <LogOut className="size-3.5" /> Sign out
          </Button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 bg-background">
        <Outlet />
      </main>
    </div>
  );
}

function WaitlistScreen({ status, onSignOut }: { status: string; onSignOut: () => void }) {
  const rejected = status === "rejected";
  return (
    <div className="grid-paper grid min-h-screen place-items-center px-6">
      <div className="panel max-w-lg bg-background p-10 text-center">
        <Hourglass className="mx-auto size-8" />
        <p className="label-mono mt-6 text-primary">{rejected ? "Access not granted" : "You're on the waitlist"}</p>
        <h1 className="mt-4 text-2xl">{rejected ? "Not this time" : "Thanks for signing up"}</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          {rejected
            ? "Your request for access wasn't approved. Contact the team if you think this is a mistake."
            : "We're letting people in gradually. You'll be able to use System Design Architect as soon as your account is approved — just sign in again later."}
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild variant="outline"><Link to="/">Back to home</Link></Button>
          <Button onClick={onSignOut}><LogOut className="size-3.5" /> Sign out</Button>
        </div>
      </div>
    </div>
  );
}
