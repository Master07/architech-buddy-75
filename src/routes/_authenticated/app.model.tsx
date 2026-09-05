import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  getAiProvider,
  saveAiProvider,
  setAiProviderEnabled,
  deleteAiProvider,
  testAiProvider,
} from "@/lib/ai-provider.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Cpu, PlugZap, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/model")({
  component: ModelPage,
  head: () => ({
    meta: [
      { title: "AI model settings · Architect OS" },
      {
        name: "description",
        content:
          "Use your own AI provider key — DeepSeek, Qwen, OpenAI or any OpenAI-compatible endpoint — for design generation and review.",
      },
      { property: "og:title", content: "AI model settings · Architect OS" },
      {
        property: "og:description",
        content: "Bring your own AI provider key for design generation and review.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const PRESETS = [
  { label: "DeepSeek", base_url: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  {
    label: "Qwen (DashScope)",
    base_url: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    model: "qwen-max",
  },
  { label: "OpenAI", base_url: "https://api.openai.com/v1", model: "gpt-4o" },
  { label: "Together", base_url: "https://api.together.xyz/v1", model: "deepseek-ai/DeepSeek-V3" },
];

function ModelPage() {
  const provider = useQuery({ queryKey: ["ai-provider"], queryFn: () => getAiProvider() });
  const saved = provider.data;

  const [label, setLabel] = useState("Custom provider");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (saved) {
      setLabel(saved.label);
      setBaseUrl(saved.base_url);
      setModel(saved.model);
    }
  }, [saved]);

  async function save() {
    if (!baseUrl.trim() || !model.trim() || apiKey.trim().length < 8) {
      toast.error("Address, model name and key are all required.");
      return;
    }
    setBusy(true);
    try {
      await saveAiProvider({
        data: {
          label: label.trim() || "Custom provider",
          base_url: baseUrl.trim(),
          model: model.trim(),
          api_key: apiKey.trim(),
          enabled: true,
        },
      });
      setApiKey("");
      await provider.refetch();
      toast.success("Saved. Your designs now run on this provider.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    try {
      const result = await testAiProvider();
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-8 py-10">
        <p className="label-mono text-primary">Model settings</p>
        <h1 className="mt-3 font-display text-3xl font-semibold">Use your own AI key</h1>
        <p className="mt-2 text-muted-foreground">
          Point the agent at your own provider — DeepSeek, Qwen, OpenAI, Together, or anything else
          that speaks the OpenAI-compatible protocol. Your key is stored encrypted and used only for
          your own designs, interviews and reviews. Book search keeps using the built-in search so
          your existing library still works. Leave this empty to stay on the built-in AI.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <Button
              key={preset.label}
              variant="outline"
              size="sm"
              onClick={() => {
                setLabel(preset.label);
                setBaseUrl(preset.base_url);
                setModel(preset.model);
              }}
            >
              {preset.label}
            </Button>
          ))}
        </div>

        <div className="mt-6 space-y-4 rounded-lg border border-border bg-card p-5">
          <div>
            <label className="label-mono text-muted-foreground">Name</label>
            <Input
              className="mt-1"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="DeepSeek"
            />
          </div>
          <div>
            <label className="label-mono text-muted-foreground">Address</label>
            <Input
              className="mt-1"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://api.deepseek.com/v1"
            />
          </div>
          <div>
            <label className="label-mono text-muted-foreground">Model name</label>
            <Input
              className="mt-1"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="deepseek-chat"
            />
          </div>
          <div>
            <label className="label-mono text-muted-foreground">
              Key {saved?.key_hint ? `(saved: ${saved.key_hint})` : ""}
            </label>
            <Input
              className="mt-1"
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={saved ? "Enter a new key to replace the saved one" : "sk-…"}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button onClick={save} disabled={busy}>
              <Cpu className="size-4" /> Save
            </Button>
            {saved && (
              <>
                <Button variant="outline" onClick={test} disabled={busy}>
                  <PlugZap className="size-4" /> Test connection
                </Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    await setAiProviderEnabled({ data: { enabled: !saved.enabled } });
                    await provider.refetch();
                  }}
                  disabled={busy}
                >
                  {saved.enabled ? "Pause — use built-in AI" : "Resume this provider"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={async () => {
                    await deleteAiProvider();
                    setApiKey("");
                    await provider.refetch();
                    toast.success("Removed. Back on the built-in AI.");
                  }}
                  disabled={busy}
                >
                  <Trash2 className="size-4" /> Remove
                </Button>
              </>
            )}
          </div>
        </div>

        <p className="mt-4 text-sm text-muted-foreground">
          {saved?.enabled
            ? `Active: ${saved.label} · ${saved.model}`
            : "Currently running on the built-in AI."}
        </p>
      </div>
    </div>
  );
}
