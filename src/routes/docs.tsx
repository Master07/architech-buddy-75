import { createFileRoute } from "@tanstack/react-router";
import { PageShell, pageHead } from "@/components/site-chrome";

export const Route = createFileRoute("/docs")({
  head: () =>
    pageHead(
      "/docs",
      "API reference — System Design Architect",
      "Call the system design agent from your IDE, CI pipeline or another service. Endpoints, authentication and curl examples.",
    ),
  component: DocsPage,
});

const BASE = "https://sda.corbetai.com/api/public/v1";

const CREATE = `curl -X POST ${BASE}/design \\
  -H "Authorization: Bearer sda_..." \\
  -H "Content-Type: application/json" \\
  -d '{ "prompt": "Design a multi-region feature flag service", "mode": "design" }'

# → 202 { "designId": "...", "jobId": "...", "pollUrl": "/api/public/v1/designs/..." }`;

const POLL = `curl ${BASE}/designs/<designId> \\
  -H "Authorization: Bearer sda_..."

# → { "design": { "status": "running" | "ready" | "failed", "content": "..." },
#     "progress": { "percent": 40, "stage": "drafting", "remainingMs": 180000 } }`;

const STREAM = `curl -N -X POST ${BASE}/design \\
  -H "Authorization: Bearer sda_..." \\
  -H "Content-Type: application/json" \\
  -d '{ "prompt": "Review this architecture: ...", "mode": "review", "stream": true }'

# Server-Sent Events: design.started → delta … → design.completed`;

const ENDPOINTS: [string, string, string][] = [
  ["POST", "/design", "Start a design, review, stack recommendation or interview. Returns 202 and a design id."],
  ["GET", "/designs/:id", "Status, progress, estimated time left, and the finished document."],
  ["GET", "/designs", "List your saved designs."],
  ["POST", "/knowledge", "Search your uploaded library. Body: { query, limit }."],
];

function Code({ children }: { children: string }) {
  return <pre className="mt-3 overflow-x-auto border border-border bg-card p-4 font-mono text-xs">{children}</pre>;
}

function DocsPage() {
  return (
    <PageShell>
      <div className="mx-auto max-w-4xl px-6 py-16">
        <p className="label-mono text-primary">API reference</p>
        <h1 className="mt-4">Use it from your IDE, CI or services</h1>
        <p className="mt-4 text-muted-foreground">
          The same agent that runs in the app is available over HTTP. Create an API key under
          API keys after your account is approved, then send it as a Bearer token.
        </p>

        <h2 className="mt-12 text-base">Endpoints</h2>
        <div className="mt-4 border border-border">
          {ENDPOINTS.map(([m, p, d]) => (
            <div key={p + m} className="grid gap-2 border-b border-border p-4 last:border-b-0 md:grid-cols-[80px_180px_1fr]">
              <span className="label-mono text-primary">{m}</span>
              <code className="font-mono text-xs">{p}</code>
              <span className="text-sm text-muted-foreground">{d}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Modes: <code>design</code>, <code>review</code>, <code>stack</code>, <code>interview</code>.
        </p>

        <h2 className="mt-12 text-base">1. Start a design</h2>
        <Code>{CREATE}</Code>
        <h2 className="mt-10 text-base">2. Poll until ready</h2>
        <p className="mt-2 text-sm text-muted-foreground">A full design document takes several minutes. Poll every few seconds.</p>
        <Code>{POLL}</Code>
        <h2 className="mt-10 text-base">Or stream it live</h2>
        <Code>{STREAM}</Code>

        <h2 className="mt-12 text-base">Limits and errors</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Each API key can run up to 3 requests at once; extra requests wait their turn.</li>
          <li>401: missing or revoked key. 403: account not approved yet. 400: invalid body.</li>
          <li>Requests can be cancelled or resubmitted from the Request log in the app.</li>
        </ul>
      </div>
    </PageShell>
  );
}
