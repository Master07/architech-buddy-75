import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageShell, pageHead } from "@/components/site-chrome";
import { MermaidDiagram } from "@/components/mermaid-diagram";
import { Button } from "@/components/ui/button";
import { getSample } from "@/lib/samples";

export const Route = createFileRoute("/samples/$slug")({
  loader: ({ params }) => {
    const sample = getSample(params.slug);
    if (!sample) throw notFound();
    return sample;
  },
  head: ({ params, loaderData }) =>
    pageHead(
      `/samples/${params.slug}`,
      `${loaderData?.title ?? "Sample"} — sample design document`,
      loaderData?.summary ?? "Sample system design document.",
    ),
  notFoundComponent: () => (
    <PageShell>
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1>Sample not found</h1>
        <Link to="/samples" className="mt-6 inline-block underline">All samples</Link>
      </div>
    </PageShell>
  ),
  component: SamplePage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="text-base">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SamplePage() {
  const s = Route.useLoaderData();
  return (
    <PageShell>
      <article className="mx-auto max-w-4xl px-6 py-16">
        <Link to="/samples" className="label-mono text-muted-foreground hover:text-foreground">← All samples</Link>
        <h1 className="mt-6">{s.title}</h1>
        <p className="mt-4 text-muted-foreground">{s.summary}</p>

        <Section title="1. Requirements">
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            {s.requirements.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </Section>

        <Section title="2. Capacity math">
          <div className="grid gap-px border border-border bg-border sm:grid-cols-2">
            {s.capacity.map((c) => (
              <div key={c.label} className="bg-background p-4">
                <p className="label-mono text-muted-foreground">{c.label}</p>
                <p className="mt-2 font-display text-lg">{c.value}</p>
                <p className="mt-2 font-mono text-xs text-muted-foreground">{c.math}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="3. Architecture">
          <MermaidDiagram code={s.diagram} />
        </Section>

        <Section title="4. Decisions and rejected alternatives">
          <div className="space-y-4">
            {s.decisions.map((d) => (
              <div key={d.choice} className="panel p-5 text-sm">
                <p><span className="label-mono text-primary">Chosen</span> {d.choice}</p>
                <p className="mt-2 text-muted-foreground"><span className="label-mono">Rejected</span> {d.rejected}</p>
                <p className="mt-3 leading-relaxed text-muted-foreground">{d.why}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="5. Failure modes">
          <ul className="space-y-3 text-sm">
            {s.failures.map((f) => (
              <li key={f.failure}><strong>{f.failure}:</strong> <span className="text-muted-foreground">{f.mitigation}</span></li>
            ))}
          </ul>
        </Section>

        <Section title="6. Scaling triggers">
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            {s.scaling.map((x) => <li key={x}>{x}</li>)}
          </ul>
        </Section>

        <div className="mt-16 border-t border-border pt-8">
          <p className="text-sm text-muted-foreground">Want one for your own system? Access is by approval, free during beta.</p>
          <Button asChild className="mt-4"><Link to="/auth" className="label-mono">Request access</Link></Button>
        </div>
      </article>
    </PageShell>
  );
}
