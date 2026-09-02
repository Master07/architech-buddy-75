import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listDesigns, getDesign, deleteDesign } from "@/lib/designs.functions";
import { MessageResponse } from "@/components/ai-elements/message";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Download, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/designs")({
  component: DesignsPage,
});

function DesignsPage() {
  const [selected, setSelected] = useState<string | null>(null);

  const designs = useQuery({ queryKey: ["designs"], queryFn: () => listDesigns() });
  const detail = useQuery({
    queryKey: ["design", selected],
    queryFn: () => getDesign({ data: { id: selected! } }),
    enabled: !!selected,
  });

  async function remove(id: string) {
    try {
      await deleteDesign({ data: { id } });
      if (selected === id) setSelected(null);
      await designs.refetch();
      toast.success("Design deleted");
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  function download() {
    if (!detail.data) return;
    const blob = new Blob([detail.data.markdown ?? ""], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${detail.data.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="w-80 shrink-0 overflow-y-auto border-r border-border p-4">
        <p className="label-mono pb-3 text-muted-foreground">Saved designs</p>
        <div className="space-y-2">
          {(designs.data ?? []).map((design) => (
            <button
              key={design.id}
              type="button"
              onClick={() => setSelected(design.id)}
              className={`w-full rounded-lg border p-3 text-left transition-colors ${
                selected === design.id
                  ? "border-primary/60 bg-accent"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <p className="truncate text-sm font-medium">{design.title}</p>
              <p className="label-mono mt-1 text-muted-foreground">
                {design.mode} · {design.source} · {new Date(design.created_at).toLocaleDateString()}
              </p>
            </button>
          ))}
          {designs.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nothing saved yet. Save a design from any session.
            </p>
          )}
        </div>
      </div>

      <div className="min-w-0 flex-1 overflow-y-auto">
        {!selected && (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">
            Select a design to read it.
          </div>
        )}
        {selected && detail.data && (
          <div className="mx-auto max-w-3xl px-8 py-8">
            <div className="mb-6 flex items-start justify-between gap-4">
              <h1 className="font-display text-2xl font-semibold">{detail.data.title}</h1>
              <div className="flex shrink-0 gap-2">
                <Button variant="outline" size="sm" onClick={download}>
                  <Download className="size-4" /> .md
                </Button>
                <Button variant="ghost" size="sm" onClick={() => remove(selected)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
            <MessageResponse>{detail.data.markdown ?? ""}</MessageResponse>
          </div>
        )}
      </div>
    </div>
  );
}
