/** Typical number of pipeline steps per mode (a gate-repair pass can add two more). */
export function expectedStages(mode: string) {
  if (mode === "design" || mode === "stack") return 8;
  if (mode === "review") return 5;
  if (mode === "interview") return 2;
  return 8;
}

export type ProgressInput = {
  mode: string;
  status: string;
  started_at: string | null;
  stages_done: number;
  current_stage: string | null;
};

/**
 * Progress 0-100 and estimated milliseconds remaining. The estimate blends the
 * average run time of this user's past successful requests in the same mode
 * with the pace of the current run, and is null when there is nothing to go on.
 */
export function estimateProgress(job: ProgressInput, avgRunMs: number | null, now = Date.now()) {
  if (job.status === "succeeded") return { percent: 100, remainingMs: 0 };
  if (job.status !== "running" || !job.started_at) return { percent: 0, remainingMs: avgRunMs };

  const total = Math.max(expectedStages(job.mode), job.stages_done + 1);
  const elapsed = Math.max(0, now - new Date(job.started_at).getTime());

  let byPace: number | null = null;
  if (job.stages_done > 0) byPace = (elapsed / job.stages_done) * total;

  const expectedTotal =
    byPace != null && avgRunMs != null ? (byPace + avgRunMs) / 2 : byPace ?? avgRunMs;

  const stagePct = (job.stages_done / total) * 100;
  const timePct = expectedTotal ? (elapsed / expectedTotal) * 100 : 0;
  // Never move backwards past completed steps, and never claim done while running.
  const percent = Math.min(97, Math.max(stagePct, Math.min(timePct, ((job.stages_done + 1) / total) * 100)));
  const remainingMs = expectedTotal != null ? Math.max(0, expectedTotal - elapsed) : null;
  return { percent: Math.round(percent), remainingMs };
}

export const STAGE_NAMES: Record<string, string> = {
  requirements: "Requirements",
  capacity: "Capacity math",
  candidates: "Candidate architectures",
  draft: "Drafting",
  critique: "Adversarial review",
  validation: "Validation",
  final: "Revision",
  gatecheck: "Gate check",
  repair: "Gate repair",
  "interview-score": "Question scoring",
};

/** The planned step order for each mode (a gate repair may be added at the end). */
export function plannedStages(mode: string): string[] {
  if (mode === "design" || mode === "stack")
    return ["requirements", "capacity", "candidates", "draft", "critique", "validation", "final", "gatecheck"];
  if (mode === "review") return ["draft", "critique", "validation", "final", "gatecheck"];
  if (mode === "interview") return ["draft", "interview-score"];
  return ["requirements", "capacity", "candidates", "draft", "critique", "validation", "final", "gatecheck"];
}
