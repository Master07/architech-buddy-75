import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MODE_META, type DesignMode } from "@/lib/design-agent";
import { saveDesign } from "@/lib/designs.functions";
import { ArrowUp, Compass, Save, Square } from "lucide-react";
import { toast } from "sonner";

type Props = {
  threadId: string;
  mode: DesignMode;
  initialMessages: UIMessage[];
  onFirstMessage?: (text: string) => void;
};

export function DesignChat({ threadId, mode, initialMessages, onFirstMessage }: Props) {
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const firstSent = useRef(initialMessages.length > 0);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<UIMessage>({
        api: "/api/chat",
        prepareSendMessagesRequest: async ({ messages, body }) => {
          const { data } = await supabase.auth.getSession();
          return {
            ...(data.session
              ? { headers: { Authorization: `Bearer ${data.session.access_token}` } }
              : {}),
            body: { ...body, messages, threadId, mode },
          };
        },
      }),
    [threadId, mode],
  );

  const { messages, sendMessage, status, stop, error } = useChat<UIMessage>({
    id: threadId,
    messages: initialMessages,
    transport,
    onError: (chatError) => toast.error(chatError.message),
  });

  const busy = status === "submitted" || status === "streaming";

  function submit() {
    const text = input.trim();
    if (!text || busy) return;
    if (!firstSent.current) {
      firstSent.current = true;
      onFirstMessage?.(text);
    }
    void sendMessage({ text });
    setInput("");
  }

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");

  async function save() {
    if (!lastAssistant) return;
    const markdown = lastAssistant.parts
      .filter((part) => part.type === "text")
      .map((part) => (part as { text: string }).text)
      .join("\n\n");
    if (!markdown.trim()) {
      toast.error("Nothing to save yet.");
      return;
    }
    setSaving(true);
    try {
      const firstPrompt = messages
        .find((message) => message.role === "user")
        ?.parts.filter((part) => part.type === "text")
        .map((part) => (part as { text: string }).text)
        .join(" ")
        .trim();
      const title =
        markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() || firstPrompt || "Saved design";
      await saveDesign({ data: { title: title.slice(0, 120), markdown, mode, threadId } });
      toast.success("Saved to your designs");
    } catch (saveError) {
      toast.error((saveError as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl">
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={<Compass className="size-8" />}
              title={MODE_META[mode].label}
              description={MODE_META[mode].blurb}
            >
              <div className="mt-4 flex flex-col gap-2">
                {MODE_META[mode].starters.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    onClick={() => setInput(starter)}
                    className="rounded-lg border border-border bg-background px-4 py-2.5 text-left text-sm transition-colors hover:border-primary hover:bg-secondary"
                  >
                    {starter}
                  </button>
                ))}
              </div>
            </ConversationEmptyState>
          ) : (
            messages.map((message) => (
              <Message key={message.id} from={message.role}>
                <MessageContent className={message.role === "assistant" ? "w-full" : ""}>
                  {message.parts.map((part, index) => {
                    if (part.type === "text") {
                      return (
                        <MessageResponse key={index}>{(part as { text: string }).text}</MessageResponse>
                      );
                    }
                    if (part.type === "tool-search_design_knowledge") {
                      const toolPart = part as unknown as {
                        state: "input-streaming" | "input-available" | "output-available" | "output-error";
                        input?: unknown;
                        output?: unknown;
                        errorText?: string;
                      };
                      return (
                        <Tool key={index} className="my-2">
                          <ToolHeader
                            type="tool-search_design_knowledge"
                            title="Library search"
                            state={toolPart.state}
                          />
                          <ToolContent>
                            <ToolInput input={toolPart.input} />
                            <ToolOutput
                              output={
                                toolPart.output ? (
                                  <pre className="overflow-x-auto text-xs">
                                    {JSON.stringify(toolPart.output, null, 2)}
                                  </pre>
                                ) : null
                              }
                              errorText={toolPart.errorText ?? ""}
                            />
                          </ToolContent>
                        </Tool>
                      );
                    }
                    return null;
                  })}
                </MessageContent>
              </Message>
            ))
          )}
          {status === "submitted" && <Shimmer>Thinking through the problem…</Shimmer>}
          {error && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
              {error.message}
            </p>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-border bg-card px-4 py-3">
        <div className="mx-auto w-full max-w-3xl">
          <div className="rounded-lg border border-border bg-background p-2 transition-colors focus-within:border-primary">
            <Textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submit();
                }
              }}
              placeholder={MODE_META[mode].placeholder}
              className="min-h-[72px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
            <div className="flex items-center justify-between gap-2 px-1 pb-0.5">
              <span className="label-mono text-muted-foreground">
                {MODE_META[mode].label} mode
              </span>
              <div className="flex items-center gap-2">
                {lastAssistant && (
                  <Button variant="ghost" size="sm" onClick={save} disabled={saving}>
                    <Save className="size-4" /> Save design
                  </Button>
                )}
                {busy ? (
                  <Button size="icon" variant="secondary" onClick={() => stop()}>
                    <Square className="size-4" />
                  </Button>
                ) : (
                  <Button size="icon" onClick={submit} disabled={!input.trim()}>
                    <ArrowUp className="size-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
