import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { EMBEDDING_MODEL } from "./design-agent";
import { requireLovableApiKey } from "./ai-gateway.server";

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": requireLovableApiKey(),
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Embedding request failed (${res.status}): ${detail.slice(0, 400)}`);
  }
  const json = (await res.json()) as { data: { index: number; embedding: number[] }[] };
  return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

export type KnowledgeHit = {
  content: string;
  document_title: string;
  section: string | null;
  similarity: number;
};

export async function searchKnowledge(
  supabase: SupabaseClient<Database>,
  query: string,
  limit = 6,
): Promise<KnowledgeHit[]> {
  const [embedding] = await embedTexts([query]);
  if (!embedding) return [];
  const { data, error } = await supabase.rpc("match_document_chunks", {
    query_embedding: JSON.stringify(embedding),
    match_count: limit,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as KnowledgeHit[];
}

/** Splits long plain text into overlapping chunks suitable for embedding. */
export function chunkText(text: string, size = 1400, overlap = 200): string[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  const paragraphs = clean.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const piece = paragraph.trim();
    if (!piece) continue;
    if (piece.length > size) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      for (let i = 0; i < piece.length; i += size - overlap) {
        chunks.push(piece.slice(i, i + size));
      }
      continue;
    }
    if ((current + "\n\n" + piece).length > size) {
      chunks.push(current);
      const tail = current.slice(-overlap);
      current = `${tail}\n\n${piece}`.trim();
    } else {
      current = current ? `${current}\n\n${piece}` : piece;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter((c) => c.trim().length > 40);
}
