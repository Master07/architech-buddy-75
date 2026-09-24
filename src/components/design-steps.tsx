import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getDesignSteps } from "@/lib/designs.functions";
import { plannedStages, STAGE_NAMES } from "@/lib/job-progress";

function fmt(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

type StepState = "done" | "running" | "waiting" | "failed" | "skipped";

export function DesignSteps({ designId }: { designId: string }) {
  const fetchSteps = useServerFn(getDesignSteps);
  const q = useQuery({
    queryKey: ["design-steps", designId],
    queryFn: () => fetchSteps({ data: { id: designId } }),
    refetchInterval: (query) => {
      const s = query.state.data?.job?.status;
      return s === "queued" || s === "running" ? 3000 : false;
    },
  });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const job = q.data?.job;
  if (!job) return null;

  // Completed step runs recorded with timing + tokens, in order.
  const done = new Map<string, { ms: number; tokens: number; runs: number }>();
  for (const u of q.data!.usage) {
    if (!u.stage) continue;
    const d = done.get(u.stage) ?? { ms: 0, tokens: 0, runs: 0 };
    d.ms += u.duration_ms ?? 0;
    d.tokens += u.total_tokens;
    d.runs += 1;
    done.set(u.stage, d);
  }

  const plan = plannedStages(job.mode);
  const extra = [...done.keys()].filter((s) => !plan.includes(s));
  if (job.current_stage && !plan.includes(job.current_stage) && !extra.includes(job.current_stage)) extra.push(job.current_stage);
  const steps = [...plan, ...extra];
  const currentIdx = job.current_stage ? steps.indexOf(job.current_stage) : -1;
  const active = job.status === "running";

  const stateOf = (stage: string, i: number): StepState => {
    if (active && stage === job.current_stage) return "running";
    if (done.has(stage) || (currentIdx >= 0 && i < currentIdx)) return "done";
    if (job.status === "failed" || job.status === "cancelled") return i === Math.max(currentIdx, done.size) ? "failed" : "skipped";
    if (job.status === "succeeded") return "skipped";
    return "waiting";
  };

  const stageElapsed = job.stage_started_at ? now - new Date(job.stage_started_at).getTime() : null;
  const stuck = active && stageElapsed != null && stageElapsed > 4 * 60_000;

  const header =
    job.status === "queued" ? `Waiting to start · ${fmt(now - new Date(job.created_at).getTime())}`
    : job.status === "running" ? `Running · step ${Math.max(1, currentIdx + 1)} of ${steps.length}`
    : job.status === "succeeded" ? "Finished"
    : job.status === "cancelled" ? "Cancelled"
    : "Failed";

  return (
    <section className="mb-6 border-2 border-foreground bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="label-mono">Plan steps</p>
        <p className={`label-mono ${job.status === "failed" ? "text-destructive" : "text-muted-foreground"}`}>
          {header}{job.attempts > 1 ? ` · try ${job.attempts}/${job.max_attempts}` : ""}
        </p>
      </div>
      <ol className="mt-3 space-y-1">
        {steps.map((stage, i) => {
          const st = stateOf(stage, i);
          const d = done.get(stage);
          const mark = st === "done" ? "■" : st === "running" ? "▶" : st === "failed" ? "✕" : "□";
          return (
            <li
              key={stage}
              className={`flex items-center justify-between gap-3 border px-2 py-1 text-sm ${
                st === "running" ? "border-primary bg-accent" : st === "failed" ? "border-destructive" : "border-border"
              } ${st === "waiting" || st === "skipped" ? "text-muted-foreground" : ""}`}
            >
              <span>
                <span className={st === "running" ? "animate-pulse text-primary" : st === "failed" ? "text-destructive" : ""}>{mark}</span>{" "}
                {i + 1}. {STAGE_NAMES[stage] ?? stage}
                {d && d.runs > 1 ? ` ×${d.runs}` : ""}
              </span>
              <span className="label-mono text-muted-foreground">
                {st === "running" && stageElapsed != null
                  ? `running ${fmt(stageElapsed)}`
                  : d
                    ? `${fmt(d.ms)} · ${d.tokens >= 1000 ? `${(d.tokens / 1000).toFixed(1)}k` : d.tokens} tok`
                    : st === "done" ? "done" : st === "skipped" ? "not needed" : st === "failed" ? "stopped here" : "waiting"}
              </span>
            </li>
          );
        })}
      </ol>
      {stuck && (
        <p className="mt-3 text-sm text-destructive">
          This step has been running for over 4 minutes — it may be stuck. You can cancel and resubmit it from the Request log.
        </p>
      )}
      {job.last_error && job.status !== "succeeded" && (
        <p className="mt-3 text-sm text-destructive">{job.last_error}</p>
      )}
    </section>
  );
}
