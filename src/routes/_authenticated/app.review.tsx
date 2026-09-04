import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MessageResponse } from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { GateScorecard } from "@/components/gate-scorecard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { gateScore, parseGateBlock, stripGateBlock, type GateResult } from "@/lib/design-agent";
import { saveDesign } from "@/lib/designs.functions";
import { FileUp, Gauge, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/review")({
  head: () => ({
    meta: [
      { title: "Design document review — scored against the gates" },
      {
        name: "description",
        content:
          "Upload a system design document and get a scored review against the acceptance gates, with a claim audit and prioritised corrections.",
      },
      { property: "og:title", content: "Design document review — scored against the gates" },
      {
        property: "og:description",
        content:
          "Upload a design document and get gate scores, a claim audit and prioritised corrections.",
      },
    ],
  }),
  component: ReviewPage,
});

function ReviewPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [review, setReview] = useState("");
  const [gates, setGates] = useState<GateResult[]>([]);
  const [running, setRunning] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    setMarkdown(text);
    if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, ""));
  }

  async function run() {
    if (!markdown.trim() || running) return;
    setRunning(true);
    setReview("");
    setGates([]);
    try {
      const { data } = await supabase.auth.getSession();
      const response = await fetch("/api/review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
        },
        body: JSON.stringify({ title, markdown }),
      });
      if (!response.ok || !response.body) {
        const message = await response.text();
        throw new Error(message || "Review failed");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setReview(stripGateBlock(text));
      }
      const parsed = parseGateBlock(text);
      setGates(parsed);
      setReview(stripGateBlock(text));
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setRunning(false);
    }
  }

  async function saveReview() {
    try {
      await saveDesign({
        data: {
          title: `Review — ${title.trim() || "Untitled document"}`.slice(0, 120),
          markdown: review,
          mode: "review",
        },
      });
      toast.success("Review saved to your designs");
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="flex w-96 shrink-0 flex-col gap-3 overflow-y-auto border-r border-border p-4">
        <div>
          <h1 className="font-display text-lg font-bold tracking-tight">Document review</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload or paste an existing design document. It is scored against the acceptance
            gates, its claims are audited for unsupported certainty, and corrections come back
            ordered by severity.
          </p>
        </div>

        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Document title"
        />

        <input
          ref={fileRef}
          type="file"
          accept=".md,.markdown,.txt,.mdx,text/plain,text/markdown"
          className="hidden"
          onChange={(event) => void onFile(event.target.files?.[0])}
        />
        <Button variant="outline" onClick={() => fileRef.current?.click()}>
          <FileUp className="size-4" /> Upload .md or .txt
        </Button>

        <Textarea
          value={markdown}
          onChange={(event) => setMarkdown(event.target.value)}
          placeholder="…or paste the document here"
          className="min-h-[280px] font-mono text-xs"
        />

        <Button onClick={() => void run()} disabled={!markdown.trim() || running}>
          <Gauge className="size-4" /> {running ? "Scoring…" : "Score against the gates"}
        </Button>
      </div>

      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-8 py-8">
          {!review && !running && (
            <p className="text-sm text-muted-foreground">
              The scored review appears here: verdict, gate report, claim audit, critical issues
              and recommended changes.
            </p>
          )}
          {running && !review && <Shimmer>Reading the document…</Shimmer>}
          {gates.length > 0 && <GateScorecard gates={gates} score={gateScore(gates)} />}
          {review && (
            <>
              <MessageResponse>{review}</MessageResponse>
              {!running && (
                <Button variant="outline" size="sm" className="mt-6" onClick={() => void saveReview()}>
                  <Save className="size-4" /> Save review
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
