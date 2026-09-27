import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getQueueDashboard } from "@/lib/queue-dashboard.functions";
import { getMyAccess } from "@/lib/waitlist.functions";
import { STAGE_NAMES, plannedStages } from "@/lib/job-progress";

export const Route = createFileRoute("/_authenticated/app/queue")({
  head: () => ({ meta: [{ title: "Live queue — System Design Architect" }] }),
  component: QueuePage,
});

function dur(ms: number | null | undefined) {
  if (ms == null || !Number.isFinite(ms)) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}
const since = (t: string | null, now: number) => (t ? now - new Date(t).getTime() : null);
const stageName = (s: string | null) => (s ? STAGE_NAMES[s] ?? s : "—");

function QueuePage() {
  const access = useQuery({ queryKey: ["my-access"], queryFn: () => getMyAccess() });
  const q = useQuery({
    queryKey: ["queue-dashboard"],
    queryFn: () => getQueueDashboard(),
    enabled: access.data?.isAdmin === true,
    refetchInterval: 3000,
  });

  if (access.data && !access.data.isAdmin) {
    return <div className="p-8 text-sm text-muted-foreground">Only admins can see the live queue.</div>;
  }
  const d = q.data;
  const now = d ? new Date(d.now).getTime() : Date.now();
  const queued = d?.active.filter((j) => j.status === "queued" || (j.status === "running" && !j.locked_at)) ?? [];
  const running = d?.active.filter((j) => j.status === "running" && j.locked_at) ?? [];
  const done = d?.recent.filter((j) => j.status === "succeeded").length ?? 0;
  const failed = d?.recent.filter((j) => j.status !== "succeeded").length ?? 0;
  const slowest = d?.stageStats[0];

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-8 py-10">
        <p className="label-mono text-primary">Admin · updates every 3s</p>
        <h1 className="mt-3 font-display text-3xl">Live queue</h1>
        {q.error && <p className="mt-4 text-sm text-destructive">{(q.error as Error).message}</p>}
        {d?.paused && (
          <p className="mt-4 border-2 border-destructive p-3 text-sm">
            Queue paused until {new Date(d.paused.paused_until!).toLocaleTimeString()}: {d.paused.paused_reason}
          </p>
        )}

        <div className="mt-8 grid gap-px border border-border bg-border sm:grid-cols-4">
          {[
            ["Waiting", queued.length],
            ["Running", running.length],
            ["Completed (24h)", done],
            ["Failed / cancelled (24h)", failed],
          ].map(([l, v]) => (
            <div key={l} className="bg-background p-4">
              <p className="label-mono text-muted-foreground">{l}</p>
              <p className="mt-2 font-display text-2xl">{v}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-10 text-base">Running</h2>
        <div className="mt-3 space-y-3">
          {running.length === 0 && <p className="text-sm text-muted-foreground">Nothing running.</p>}
          {running.map((j) => {
            const steps = plannedStages(j.mode);
            const stepMs = since(j.stage_started_at, now);
            const stuck = (stepMs ?? 0) > 4 * 60_000;
            return (
              <div key={j.id} className="panel p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="min-w-0 truncate text-sm">{j.prompt}</p>
                  <p className="label-mono text-muted-foreground">
                    {j.mode} · running {dur(since(j.started_at, now))} · try {j.attempts}/{j.max_attempts}
                  </p>
                </div>
                <div className="mt-3 flex gap-1">
                  {steps.map((s, i) => (
                    <div
                      key={s}
                      title={stageName(s)}
                      className={`h-2 flex-1 ${i < j.stages_done ? "bg-primary" : i === j.stages_done ? (stuck ? "bg-destructive" : "animate-pulse bg-primary/50") : "bg-muted"}`}
                    />
                  ))}
                </div>
                <p className={`mt-2 text-xs ${stuck ? "text-destructive" : "text-muted-foreground"}`}>
                  Step {Math.min(j.stages_done + 1, steps.length)} of {steps.length}: {stageName(j.current_stage ?? steps[j.stages_done] ?? null)} · {dur(stepMs)} on this step
                  {stuck ? " · possibly stuck" : ""}
                  {j.last_error ? ` · ${j.last_error}` : ""}
                </p>
              </div>
            );
          })}
        </div>

        <h2 className="mt-10 text-base">Waiting</h2>
        <div className="mt-3 border border-border">
          {queued.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nobody waiting.</p>}
          {queued.map((j) => (
            <div key={j.id} className="flex justify-between gap-4 border-b border-border p-3 text-sm last:border-b-0">
              <span className="min-w-0 truncate">{j.prompt}</span>
              <span className="label-mono shrink-0 text-muted-foreground">
                {j.stages_done > 0 ? `between steps (${j.stages_done} done)` : "not started"} · waiting {dur(since(j.created_at, now))}
              </span>
            </div>
          ))}
        </div>

        <h2 className="mt-10 text-base">Where time goes (last 24h)</h2>
        {slowest && (
          <p className="mt-2 text-sm text-muted-foreground">
            Slowest step: <strong className="text-foreground">{stageName(slowest.stage)}</strong>, {dur(slowest.avgMs)} on average.
          </p>
        )}
        <div className="mt-3 border border-border text-sm">
          <div className="label-mono grid grid-cols-5 gap-2 border-b border-border p-3 text-muted-foreground">
            <span className="col-span-2">Step</span><span>Avg</span><span>Longest</span><span>Avg tokens</span>
          </div>
          {d?.stageStats.map((s) => {
            const w = slowest ? (s.avgMs / slowest.avgMs) * 100 : 0;
            return (
              <div key={s.stage} className="grid grid-cols-5 items-center gap-2 border-b border-border p-3 last:border-b-0">
                <span className="col-span-2">
                  {stageName(s.stage)} <span className="text-muted-foreground">({s.calls})</span>
                  <span className="mt-1 block h-1.5 bg-primary" style={{ width: `${w}%` }} />
                </span>
                <span>{dur(s.avgMs)}</span><span>{dur(s.maxMs)}</span><span>{s.avgTokens.toLocaleString()}</span>
              </div>
            );
          })}
          {d && d.stageStats.length === 0 && <p className="p-3 text-muted-foreground">No steps ran in the last 24 hours.</p>}
        </div>

        <h2 className="mt-10 text-base">Recently finished</h2>
        <div className="mt-3 border border-border">
          {d?.recent.slice(0, 20).map((j) => (
            <div key={j.id} className="flex justify-between gap-4 border-b border-border p-3 text-sm last:border-b-0">
              <span className="min-w-0 truncate">{j.prompt}</span>
              <span className="label-mono shrink-0 text-muted-foreground">
                {j.status} · waited {dur(j.started_at ? new Date(j.started_at).getTime() - new Date(j.created_at).getTime() : null)} · ran{" "}
                {dur(j.started_at && j.finished_at ? new Date(j.finished_at).getTime() - new Date(j.started_at).getTime() : null)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
