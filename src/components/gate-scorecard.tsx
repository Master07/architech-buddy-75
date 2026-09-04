import type { GateResult } from "@/lib/design-agent";
import { CheckCircle2, CircleAlert, CircleX } from "lucide-react";

const VERDICT_STYLE = {
  PASS: { icon: CheckCircle2, className: "text-primary" },
  PARTIAL: { icon: CircleAlert, className: "text-amber-600" },
  FAIL: { icon: CircleX, className: "text-destructive" },
} as const;

export function GateScorecard({
  gates,
  score,
  title = "Acceptance gates",
}: {
  gates: GateResult[];
  score: number;
  title?: string;
}) {
  if (gates.length === 0) return null;
  return (
    <div className="my-3 rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <p className="label-mono text-muted-foreground">{title}</p>
        <p className="font-display text-sm font-bold text-primary">{score}%</p>
      </div>
      <ul className="divide-y divide-border">
        {gates.map((gate) => {
          const style = VERDICT_STYLE[gate.verdict];
          const Icon = style.icon;
          return (
            <li key={gate.id} className="flex gap-3 px-4 py-2.5">
              <Icon className={`mt-0.5 size-4 shrink-0 ${style.className}`} />
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  <span className="label-mono mr-2 text-muted-foreground">{gate.id}</span>
                  {gate.label}
                </p>
                {gate.note && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{gate.note}</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
