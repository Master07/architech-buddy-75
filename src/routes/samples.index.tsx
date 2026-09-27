import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell, pageHead } from "@/components/site-chrome";
import { SAMPLES } from "@/lib/samples";

export const Route = createFileRoute("/samples/")({
  head: () =>
    pageHead(
      "/samples",
      "Sample design documents — System Design Architect",
      "See real example output: requirements, capacity math, architecture diagrams, rejected alternatives and failure modes.",
    ),
  component: SamplesPage,
});

function SamplesPage() {
  return (
    <PageShell>
      <div className="mx-auto max-w-4xl px-6 py-16">
        <p className="label-mono text-primary">Sample output</p>
        <h1 className="mt-4">Example design documents</h1>
        <p className="mt-4 text-muted-foreground">
          The rate limiter is a complete, unedited document produced by the tool. The URL shortener is a shortened example.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {SAMPLES.map((s) => (
            <Link key={s.slug} to="/samples/$slug" params={{ slug: s.slug }} className="panel block p-6 hover:bg-card">
              <h2 className="text-base">{s.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{s.summary}</p>
              <p className="label-mono mt-4 text-primary">{s.realDoc ? "Real tool output · read →" : "Short example · read →"}</p>
            </Link>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
