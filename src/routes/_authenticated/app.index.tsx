import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { MODE_META, DESIGN_MODES, type DesignMode } from "@/lib/design-agent";
import { createThread } from "@/lib/threads.functions";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/")({
  component: AppHome,
});

function AppHome() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function start(mode: DesignMode) {
    setBusy(true);
    try {
      const thread = await createThread({ data: { title: MODE_META[mode].label, mode } });
      navigate({ to: "/app/$threadId", params: { threadId: thread.id } });
    } catch (error) {
      toast.error((error as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="grid-paper h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-8 py-20">
        <p className="label-mono text-primary">Pick a mode</p>
        <h1 className="mt-4 text-4xl font-semibold">What are we designing today?</h1>
        <p className="mt-3 text-muted-foreground">
          Each mode changes how the agent works: how much it asks, what it produces, and how hard it
          pushes back.
        </p>

        <div className="mt-10 grid gap-3">
          {DESIGN_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              disabled={busy}
              onClick={() => start(mode)}
              className="group flex items-center justify-between gap-6 rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-primary/50 disabled:opacity-60"
            >
              <div>
                <p className="font-display text-base font-semibold">{MODE_META[mode].label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{MODE_META[mode].blurb}</p>
              </div>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
