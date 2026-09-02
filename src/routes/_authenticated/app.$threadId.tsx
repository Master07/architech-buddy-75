import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import { DesignChat } from "@/components/design-chat";
import { getThread, renameThread } from "@/lib/threads.functions";
import { DESIGN_MODES, type DesignMode } from "@/lib/design-agent";

export const Route = createFileRoute("/_authenticated/app/$threadId")({
  component: ThreadPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-destructive">{(error as Error).message}</div>
  ),
});

function ThreadPage() {
  const { threadId } = Route.useParams();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["thread", threadId],
    queryFn: () => getThread({ data: { id: threadId } }),
  });

  if (query.isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading session…</div>;
  }
  if (query.error || !query.data) {
    return (
      <div className="p-8 text-sm text-destructive">
        {(query.error as Error)?.message ?? "Session not found"}
      </div>
    );
  }

  const { thread, messages } = query.data;
  const mode: DesignMode = DESIGN_MODES.includes(thread.mode as DesignMode)
    ? (thread.mode as DesignMode)
    : "interview";

  const initialMessages: UIMessage[] = messages.map((row) => ({
    id: row.message_id ?? row.id,
    role: row.role as UIMessage["role"],
    parts: (row.parts ?? []) as UIMessage["parts"],
  }));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-semibold">{thread.title}</p>
        </div>
      </header>
      <div className="min-h-0 flex-1">
        <DesignChat
          key={threadId}
          threadId={threadId}
          mode={mode}
          initialMessages={initialMessages}
          onFirstMessage={async (text) => {
            await renameThread({ data: { id: threadId, title: text.slice(0, 80) } });
            queryClient.invalidateQueries({ queryKey: ["threads"] });
            queryClient.setQueryData(["thread", threadId], (previous: typeof query.data) =>
              previous
                ? { ...previous, thread: { ...previous.thread, title: text.slice(0, 80) } }
                : previous,
            );
          }}
        />
      </div>
    </div>
  );
}
