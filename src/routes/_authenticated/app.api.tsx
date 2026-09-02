import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listApiKeys, createApiKey, revokeApiKey } from "@/lib/apikeys.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Copy, KeyRound } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/api")({
  component: ApiPage,
});

const CURL = `curl -N -X POST https://your-app.lovable.app/api/public/v1/design \\
  -H "Authorization: Bearer sda_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "Design a multi-region feature flag service",
    "mode": "design",
    "stream": true
  }'`;


function ApiPage() {
  const [name, setName] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const keys = useQuery({ queryKey: ["api-keys"], queryFn: () => listApiKeys() });

  async function create() {
    if (!name.trim()) return;
    try {
      const result = await createApiKey({ data: { name: name.trim() } });
      setToken(result.token);
      setName("");
      await keys.refetch();
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-8 py-10">
        <p className="label-mono text-primary">Programmatic access</p>
        <h1 className="mt-3 font-display text-3xl font-semibold">API keys</h1>
        <p className="mt-2 text-muted-foreground">
          Call the agent from your IDE, CI pipeline, or another service. Keys are scoped to your
          account and your uploaded library.
        </p>

        <div className="mt-8 flex gap-2">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Key name (e.g. laptop, CI)"
          />
          <Button onClick={create} disabled={!name.trim()}>
            <KeyRound className="size-4" /> Create key
          </Button>
        </div>

        {token && (
          <div className="mt-4 rounded-lg border border-primary/40 bg-primary/5 p-4">
            <p className="label-mono text-primary">Copy it now — shown once</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-background px-3 py-2 font-mono text-xs">
                {token}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(token);
                  toast.success("Copied");
                }}
              >
                <Copy className="size-4" />
              </Button>
            </div>
          </div>
        )}

        <div className="mt-8 space-y-2">
          {(keys.data ?? []).map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{key.name}</p>
                <p className="label-mono mt-0.5 text-muted-foreground">
                  {key.prefix}… ·{" "}
                  {key.revoked
                    ? "revoked"
                    : key.last_used_at
                      ? `last used ${new Date(key.last_used_at).toLocaleDateString()}`
                      : "never used"}
                </p>
              </div>
              {!key.revoked && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    await revokeApiKey({ data: { id: key.id } });
                    await keys.refetch();
                  }}
                >
                  Revoke
                </Button>
              )}
            </div>
          ))}
          {keys.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">No keys yet.</p>
          )}
        </div>

        <div className="mt-12">
          <h2 className="font-display text-lg font-semibold">Endpoints</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <code className="text-foreground">POST /api/public/v1/design</code> — generate a
              design, review, or stack recommendation. Full documents take minutes, so pick a
              transport: <code className="text-foreground">"stream": true</code> returns
              Server-Sent Events (<code className="text-foreground">design.started</code>,{" "}
              <code className="text-foreground">delta</code>,{" "}
              <code className="text-foreground">design.completed</code>) and never idles out;{" "}
              <code className="text-foreground">"wait": false</code> returns 202 with a design id
              to poll. Omit both for the simple buffered response on short prompts.
            </li>

              <code className="text-foreground">GET /api/public/v1/designs</code> — list your saved
              designs.
            </li>
            <li>
              <code className="text-foreground">GET /api/public/v1/designs/:id</code> — fetch one
              design.
            </li>
            <li>
              <code className="text-foreground">POST /api/public/v1/knowledge</code> — semantic
              search across your uploaded books.
            </li>
          </ul>
          <pre className="mt-4 overflow-x-auto rounded-lg border border-border bg-card p-4 font-mono text-xs">
            {CURL}
          </pre>
        </div>
      </div>
    </div>
  );
}
