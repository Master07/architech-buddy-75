import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addEvidence, deleteEvidence, listEvidence } from "@/lib/evidence.functions";
import { EVIDENCE_KINDS, EVIDENCE_KIND_LABEL, EVIDENCE_RANK, type EvidenceKind } from "@/lib/design-agent";
import { FlaskConical, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function EvidencePanel({ threadId }: { threadId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<EvidenceKind>("telemetry");
  const [content, setContent] = useState("");

  const key = ["evidence", threadId];
  const query = useQuery({
    queryKey: key,
    queryFn: () => listEvidence({ data: { threadId } }),
    enabled: open,
  });

  const add = useMutation({
    mutationFn: () => addEvidence({ data: { threadId, label: label.trim(), kind, content } }),
    onSuccess: () => {
      setLabel("");
      setContent("");
      queryClient.invalidateQueries({ queryKey: key });
      toast.success("Evidence attached");
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteEvidence({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
    onError: (error) => toast.error((error as Error).message),
  });

  const items = query.data ?? [];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0">
          <FlaskConical className="size-4" /> Evidence
          {items.length > 0 && (
            <span className="label-mono rounded bg-secondary px-1.5 text-primary">
              {items.length}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="font-display">System evidence</SheetTitle>
          <SheetDescription>
            Paste real telemetry, configuration, schemas, code or incident notes. The agent ranks
            these above books and general knowledge, and only claims backed by them are labelled
            Verified.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-3 border-b border-border px-4 pb-5">
          <Input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Label, e.g. p99 latency, orders service"
          />
          <Select value={kind} onValueChange={(value) => setKind(value as EvidenceKind)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVIDENCE_KINDS.map((item) => (
                <SelectItem key={item} value={item}>
                  Tier {EVIDENCE_RANK[item]} — {EVIDENCE_KIND_LABEL[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Paste the raw evidence here…"
            className="min-h-[160px] font-mono text-xs"
          />
          <Button
            onClick={() => add.mutate()}
            disabled={!label.trim() || !content.trim() || add.isPending}
          >
            Attach evidence
          </Button>
        </div>

        <div className="flex flex-col gap-2 px-4 py-4">
          {query.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!query.isLoading && items.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nothing attached yet — the agent is operating at the literature tier.
            </p>
          )}
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.label}</p>
                  <p className="label-mono text-muted-foreground">
                    tier {EVIDENCE_RANK[(item.kind as EvidenceKind) ?? "other"] ?? 6} ·{" "}
                    {EVIDENCE_KIND_LABEL[(item.kind as EvidenceKind) ?? "other"] ?? item.kind}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove.mutate(item.id)}
                  disabled={remove.isPending}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <pre className="mt-2 max-h-24 overflow-hidden whitespace-pre-wrap break-words text-xs text-muted-foreground">
                {item.content.slice(0, 400)}
              </pre>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
