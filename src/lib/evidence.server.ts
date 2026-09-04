import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { EVIDENCE_KIND_LABEL, EVIDENCE_RANK, type EvidenceKind } from "./design-agent";

export type EvidenceItem = {
  label: string;
  kind: EvidenceKind;
  content: string;
};

const MAX_ITEM_CHARS = 8000;
const MAX_TOTAL_CHARS = 40000;

function normaliseKind(kind: string | null | undefined): EvidenceKind {
  return (kind ?? "other") in EVIDENCE_RANK ? (kind as EvidenceKind) : "other";
}

/** Loads the evidence a user attached to a design session. */
export async function loadThreadEvidence(
  supabase: SupabaseClient<Database>,
  userId: string,
  threadId: string,
): Promise<EvidenceItem[]> {
  const { data, error } = await supabase
    .from("context_items")
    .select("label, kind, content")
    .eq("thread_id", threadId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    label: row.label,
    kind: normaliseKind(row.kind),
    content: row.content,
  }));
}

/**
 * Renders the evidence bundle strongest-tier first so the model reads observed
 * behaviour before documentation or recollection.
 */
export function formatEvidenceBundle(items: EvidenceItem[]): string {
  if (items.length === 0) return "No system evidence attached.";
  const sorted = [...items].sort((a, b) => EVIDENCE_RANK[a.kind] - EVIDENCE_RANK[b.kind]);
  let budget = MAX_TOTAL_CHARS;
  const blocks: string[] = [];

  for (const item of sorted) {
    if (budget <= 0) {
      blocks.push(`(${sorted.length - blocks.length} further item(s) omitted for length.)`);
      break;
    }
    const slice = item.content.slice(0, Math.min(MAX_ITEM_CHARS, budget));
    budget -= slice.length;
    blocks.push(
      [
        `### ${item.label}`,
        `Evidence tier ${EVIDENCE_RANK[item.kind]} - ${EVIDENCE_KIND_LABEL[item.kind]}`,
        "```",
        slice + (slice.length < item.content.length ? "\n… truncated …" : ""),
        "```",
      ].join("\n"),
    );
  }

  return blocks.join("\n\n");
}
