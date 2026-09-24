import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RotateCcw, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listApiLogs, listAppAiActivity, cancelApiJob, resubmitApiJob } from "@/lib/api-logs.functions";

export const Route = createFileRoute("/_authenticated/app/logs")({
  head: () => ({
    meta: [
      { title: "Request log — System Design Architect" },
      { name: "description", content: "Every design request with timing, plus cancel and resubmit." },
    ],
  }),
  component: LogsPage,
});

function fmt(ms: number) {
  if (ms < 1000) return `${ms} ms`;
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

function tok(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function Tokens({ t }: { t: { input: number; output: number; total: number } | null }) {
  if (!t) return <>—</>;
  return (
    <span title={`${t.input.toLocaleString()} in · ${t.output.toLocaleString()} out`}>
      {tok(t.total)}
      <span className="label-mono block text-muted-foreground">
        {tok(t.input)} in · {tok(t.output)} out
      </span>
    </span>
  );
}

function LogsPage() {
  const list = useServerFn(listApiLogs);
  const cancel = useServerFn(cancelApiJob);
  const resubmit = useServerFn(resubmitApiJob);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState<string | null>(null);

  const listActivity = useServerFn(listAppAiActivity);
  const activity = useQuery({ queryKey: ["ai-activity"], queryFn: () => listActivity(), refetchInterval: 5000 });
  const logs = useQuery({ queryKey: ["api-logs"], queryFn: () => list(), refetchInterval: 5000 });
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  async function act(id: string, kind: "cancel" | "resubmit") {
    setBusy(id + kind);
    try {
      if (kind === "cancel") await cancel({ data: { id } });
      else await resubmit({ data: { id } });
      toast.success(kind === "cancel" ? "Request cancelled" : "Request resubmitted");
      await logs.refetch();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="font-display text-2xl font-semibold">Request log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every design request (API, IDE and app) with its wait and run time. Updates every 5 seconds.
        </p>
        <div className="mt-6 overflow-x-auto border border-border">
          <table className="w-full text-sm">
            <thead className="label-mono bg-secondary text-left text-muted-foreground">
              <tr>
                <th className="p-2">Sent</th>
                <th className="p-2">Request</th>
                <th className="p-2">Status</th>
                <th className="p-2">Waited</th>
                <th className="p-2">Ran for</th>
                <th className="p-2">Tokens</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {(logs.data ?? []).map((j) => {
                const created = new Date(j.created_at).getTime();
                const started = j.started_at ? new Date(j.started_at).getTime() : null;
                const finished = j.finished_at ? new Date(j.finished_at).getTime() : null;
                const active = j.status === "queued" || j.status === "running";
                const waited = started ? started - created : active ? now - created : null;
                const ran = started ? (finished ?? (active ? now : started)) - started : null;
                return (
                  <tr key={j.id} className="border-t border-border align-top">
                    <td className="whitespace-nowrap p-2">{new Date(j.created_at).toLocaleString()}</td>
                    <td className="max-w-xs p-2">
                      <p className="line-clamp-2">{j.prompt}</p>
                      <p className="label-mono mt-1 text-muted-foreground">
                        {j.mode} · {j.source}
                        {j.attempts > 1 ? ` · try ${j.attempts}` : ""}
                        {j.resubmitted_from ? " · resubmitted" : ""}
                      </p>
                      {j.last_error && !["succeeded"].includes(j.status) && (
                        <p className="mt-1 text-xs text-destructive">{j.last_error}</p>
                      )}
                    </td>
                    <td className="p-2">
                      <span className={`label-mono ${j.status === "failed" ? "text-destructive" : j.status === "succeeded" ? "" : "text-primary"}`}>
                        {j.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap p-2">{waited == null ? "—" : fmt(Math.max(0, waited))}</td>
                    <td className="whitespace-nowrap p-2">{ran == null ? "—" : fmt(Math.max(0, ran))}</td>
                    <td className="whitespace-nowrap p-2"><Tokens t={j.tokens} /></td>
                    <td className="whitespace-nowrap p-2 text-right">
                      {active ? (
                        <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => act(j.id, "cancel")}>
                          <Square className="size-3" /> Cancel
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => act(j.id, "resubmit")}>
                          <RotateCcw className="size-3" /> Resubmit
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {logs.data?.length === 0 && (
                <tr><td colSpan={7} className="p-4 text-muted-foreground">No requests yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <h2 className="font-display mt-10 text-lg font-semibold">In-app AI activity</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Chat turns and document reviews made inside the app.
        </p>
        <div className="mt-4 overflow-x-auto border border-border">
          <table className="w-full text-sm">
            <thead className="label-mono bg-secondary text-left text-muted-foreground">
              <tr>
                <th className="p-2">When</th>
                <th className="p-2">Request</th>
                <th className="p-2">Steps</th>
                <th className="p-2">AI time</th>
                <th className="p-2">Tokens</th>
              </tr>
            </thead>
            <tbody>
              {(activity.data ?? []).map((a) => (
                <tr key={a.requestId} className="border-t border-border align-top">
                  <td className="whitespace-nowrap p-2">{new Date(a.firstAt).toLocaleString()}</td>
                  <td className="max-w-xs p-2">
                    <p className="line-clamp-2">{a.label ?? "—"}</p>
                    <p className="label-mono mt-1 text-muted-foreground">
                      {a.kind}{a.model ? ` · ${a.model}` : ""}
                    </p>
                  </td>
                  <td className="p-2">{a.steps}</td>
                  <td className="whitespace-nowrap p-2">{fmt(a.durationMs)}</td>
                  <td className="whitespace-nowrap p-2"><Tokens t={a} /></td>
                </tr>
              ))}
              {activity.data?.length === 0 && (
                <tr><td colSpan={5} className="p-4 text-muted-foreground">No in-app AI activity logged yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
