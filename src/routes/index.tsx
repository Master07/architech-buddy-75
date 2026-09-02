import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { MODE_META, DESIGN_MODES } from "@/lib/design-agent";
import { ArrowRight, BookOpen, GitBranch, Plug, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "System Design Architect — AI system design partner" },
      {
        name: "description",
        content:
          "Interview-driven AI architect that produces full system design documents, reviews existing architectures, and cites your own system design books.",
      },
      { property: "og:title", content: "System Design Architect — AI system design partner" },
      {
        property: "og:description",
        content:
          "Design before you implement. Requirements, capacity math, diagrams, trade-offs and failure modes — grounded in your own library.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: GitBranch,
    title: "Documents, not chat transcripts",
    body: "Requirements, back-of-envelope capacity math, a Mermaid architecture diagram, API and data model, deep dives, failure modes and a scaling path.",
  },
  {
    icon: BookOpen,
    title: "Grounded in your own books",
    body: "Upload the system design books and internal docs you trust. The agent retrieves passages and cites the source title inline.",
  },
  {
    icon: ShieldCheck,
    title: "Opinionated, with receipts",
    body: "Every major decision names the rejected alternative and the trade-off that decided it. Assumptions are stated, never hidden.",
  },
  {
    icon: Plug,
    title: "Callable from your IDE and CI",
    body: "A REST API with per-user keys means the same agent runs from scripts, pipelines, and coding assistants — not just this browser tab.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-md border border-primary/40 bg-primary/10">
              <GitBranch className="size-4 text-primary" />
            </div>
            <span className="font-display text-sm font-semibold tracking-tight">
              System Design Architect
            </span>
          </div>
          <Button asChild size="sm">
            <Link to="/auth">Sign in</Link>
          </Button>
        </div>
      </header>

      <main>
        <section className="grid-paper border-b border-border/60">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <p className="label-mono text-primary">Design before implementation</p>
            <h1 className="mt-5 max-w-3xl text-balance text-5xl font-semibold leading-[1.05] md:text-6xl">
              An architect that interrogates your problem before it draws a box.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Most AI tools hand you a diagram and a confident shrug. This one runs the interview,
              does the capacity arithmetic out loud, commits to a recommendation, and tells you
              exactly which alternative it rejected and why.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/auth">
                  Start a design <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/auth" search={{ redirect: "/app/api" }}>
                  View the API
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="border-b border-border/60">
          <div className="mx-auto grid max-w-6xl gap-px bg-border/60 px-0 md:grid-cols-4">
            {DESIGN_MODES.map((mode) => (
              <div key={mode} className="bg-background p-6">
                <p className="label-mono text-primary">{MODE_META[mode].label}</p>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {MODE_META[mode].blurb}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-10 md:grid-cols-2">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="flex gap-4">
                <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-md border border-border bg-card">
                  <feature.icon className="size-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-base font-semibold">{feature.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {feature.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-border/60 bg-card/40">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <h2 className="text-2xl font-semibold">Where it is strong, and where it is not</h2>
            <div className="mt-8 grid gap-8 md:grid-cols-2">
              <div>
                <p className="label-mono text-[color:var(--color-signal)]">Reliable</p>
                <ul className="mt-4 space-y-2 text-sm leading-relaxed text-muted-foreground">
                  <li>Structuring a vague idea into a reviewable design document.</li>
                  <li>Surfacing the failure modes and edge cases you forgot.</li>
                  <li>Naming trade-offs and defending a specific choice.</li>
                  <li>Critiquing an existing architecture against a rigorous checklist.</li>
                </ul>
              </div>
              <div>
                <p className="label-mono text-[color:var(--color-caution)]">Treat with care</p>
                <ul className="mt-4 space-y-2 text-sm leading-relaxed text-muted-foreground">
                  <li>Capacity numbers are order-of-magnitude sanity checks, not benchmarks.</li>
                  <li>Cost estimates need your real pricing and usage data.</li>
                  <li>It cannot know your org, legacy systems, or team skills unless you say.</li>
                  <li>Final architectural accountability stays with you.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto max-w-6xl px-6 py-8 text-xs text-muted-foreground">
          System Design Architect — design documents, reviews, and stack recommendations.
        </div>
      </footer>
    </div>
  );
}
