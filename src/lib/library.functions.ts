import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chunkText, embedTexts } from "./retrieval.server";

const EMBED_BATCH = 24;

export const listDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("documents")
      .select("id, title, filename, status, chunk_count, error, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const deleteDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("documents").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Accepts already-extracted plain text and stores it as unembedded chunks. */
export const ingestDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        title: z.string().trim().min(1).max(200),
        filename: z.string().trim().max(300).nullable().default(null),
        text: z.string().min(200),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const chunks = chunkText(data.text);
    if (chunks.length === 0) throw new Error("No readable text found in that file.");

    const { data: doc, error } = await context.supabase
      .from("documents")
      .insert({
        user_id: context.userId,
        title: data.title,
        filename: data.filename,
        status: "embedding",
        chunk_count: chunks.length,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    for (let i = 0; i < chunks.length; i += 200) {
      const slice = chunks.slice(i, i + 200).map((content, index) => ({
        user_id: context.userId,
        document_id: doc.id,
        chunk_index: i + index,
        content,
      }));
      const { error: chunkError } = await context.supabase.from("document_chunks").insert(slice);
      if (chunkError) throw new Error(chunkError.message);
    }

    return { documentId: doc.id, chunkCount: chunks.length };
  });

/** Embeds the next batch of pending chunks. Call repeatedly until done is true. */
export const embedNextBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ documentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: pending, error } = await context.supabase
      .from("document_chunks")
      .select("id, content")
      .eq("document_id", data.documentId)
      .is("embedding", null)
      .order("chunk_index", { ascending: true })
      .limit(EMBED_BATCH);
    if (error) throw new Error(error.message);

    if (!pending || pending.length === 0) {
      await context.supabase
        .from("documents")
        .update({ status: "ready", error: null, updated_at: new Date().toISOString() })
        .eq("id", data.documentId);
      return { done: true, embedded: 0, remaining: 0 };
    }

    try {
      const vectors = await embedTexts(pending.map((chunk) => chunk.content));
      await Promise.all(
        pending.map((chunk, index) =>
          context.supabase
            .from("document_chunks")
            .update({ embedding: JSON.stringify(vectors[index]) })
            .eq("id", chunk.id),
        ),
      );
    } catch (embedError) {
      await context.supabase
        .from("documents")
        .update({ status: "failed", error: (embedError as Error).message.slice(0, 500) })
        .eq("id", data.documentId);
      throw embedError;
    }

    const { count } = await context.supabase
      .from("document_chunks")
      .select("id", { count: "exact", head: true })
      .eq("document_id", data.documentId)
      .is("embedding", null);

    const remaining = count ?? 0;
    if (remaining === 0) {
      await context.supabase
        .from("documents")
        .update({ status: "ready", error: null, updated_at: new Date().toISOString() })
        .eq("id", data.documentId);
    }
    return { done: remaining === 0, embedded: pending.length, remaining };
  });
