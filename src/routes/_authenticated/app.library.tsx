import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  listDocuments,
  deleteDocument,
  ingestDocument,
  embedNextBatch,
} from "@/lib/library.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { BookOpen, Trash2, Upload } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/library")({
  component: LibraryPage,
});

async function extractText(file: File): Promise<string> {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const { extractText: extract, getDocumentProxy } = await import("unpdf");
    const buffer = new Uint8Array(await file.arrayBuffer());
    const pdf = await getDocumentProxy(buffer);
    const { text } = await extract(pdf, { mergePages: true });
    return text;
  }
  return file.text();
}

function LibraryPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const documents = useQuery({ queryKey: ["documents"], queryFn: () => listDocuments() });

  async function upload(file: File) {
    setProgress(`Reading ${file.name}…`);
    try {
      const text = await extractText(file);
      if (text.trim().length < 200) throw new Error("Could not read enough text from that file.");

      setProgress("Indexing…");
      const { documentId } = await ingestDocument({
        data: {
          title: file.name.replace(/\.[^.]+$/, ""),
          filename: file.name,
          text,
        },
      });

      let done = false;
      let embedded = 0;
      while (!done) {
        const result = await embedNextBatch({ data: { documentId } });
        done = result.done;
        embedded += result.embedded;
        setProgress(`Embedding… ${embedded} chunks indexed`);
      }
      toast.success(`${file.name} added to your library`);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setProgress(null);
      await documents.refetch();
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-8 py-10">
        <p className="label-mono text-primary">Knowledge library</p>
        <h1 className="mt-3 font-display text-3xl font-semibold">Your system design books</h1>
        <p className="mt-2 text-muted-foreground">
          Upload PDFs or text files. The agent searches them while designing and cites what it uses.
        </p>

        <div className="mt-8 rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <BookOpen className="mx-auto size-6 text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">PDF, Markdown, or plain text</p>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.md,.txt,application/pdf,text/plain,text/markdown"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void upload(file);
            }}
          />
          <Button
            className="mt-4"
            disabled={!!progress}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="size-4" /> {progress ?? "Upload a book"}
          </Button>
        </div>

        <div className="mt-8 space-y-2">
          {(documents.data ?? []).map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{doc.title}</p>
                <p className="label-mono mt-0.5 text-muted-foreground">
                  {doc.status} · {doc.chunk_count ?? 0} chunks
                  {doc.error ? ` · ${doc.error}` : ""}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await deleteDocument({ data: { id: doc.id } });
                  await documents.refetch();
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          {documents.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">No books indexed yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
