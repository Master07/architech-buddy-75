import { createFileRoute, Link, Outlet, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { listThreads, createThread } from "@/lib/threads.functions";
import { Button } from "@/components/ui/button";
import { MODE_META, type DesignMode } from "@/lib/design-agent";
import { BookOpen, FileText, GitBranch, KeyRound, LogOut, Plus } from "lucide-react";
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
  { to: "/app/library", label: "Library", icon: BookOpen },
  { to: "/app/api", label: "API access", icon: KeyRound },
] as const;

function AppShell() {
  const navigate = useNavigate();
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  const threads = useQuery({
    queryKey: ["threads"],
    queryFn: () => listThreads(),
  });

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
          <div className="grid size-7 place-items-center rounded-md border border-primary/40 bg-primary/10">
            <GitBranch className="size-3.5 text-primary" />
          </div>
          <span className="font-display text-sm font-semibold">Architect</span>
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
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent [&.active]:bg-sidebar-accent [&.active]:text-primary"
            >
              <item.icon className="size-3.5" />
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
                className="block truncate rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground [&.active]:bg-sidebar-accent [&.active]:text-sidebar-foreground"
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
            className="w-full justify-start"
            onClick={async () => {
              await supabase.auth.signOut();
              router.navigate({ to: "/auth" });
            }}
          >
            <LogOut className="size-3.5" /> Sign out
          </Button>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
