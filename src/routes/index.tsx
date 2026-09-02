import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { MODE_META, DESIGN_MODES } from "@/lib/design-agent";
import { ArrowRight, BookOpen, GitBranch, Plug, ShieldCheck, Zap } from "lucide-react";

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

const BAND = [
  {
    icon: Zap,
    title: "Live streaming",
    body: "Watch the specification materialise section by section as you talk.",
  },
  {
    icon: BookOpen,
    title: "Your own books",
    body: "Upload the books and internal docs you trust. Passages are cited inline.",
  },
  {
    icon: Plug,
    title: "IDE & CI ready",
    body: "Per-user API keys run the same agent from scripts and pipelines.",
  },
];

const FEATURES = [
  {
    icon: GitBranch,
    title: "Documents, not chat transcripts",
    body: "Requirements, back-of-envelope capacity math, a Mermaid architecture diagram, API and data model, deep dives, failure modes and a scaling path.",
  },
  {
    icon: ShieldCheck,
    title: "Opinionated, with receipts",
    body: "Every major decision names the rejected alternative and the trade-off that decided it. Assumptions are stated, never hidden.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="grid size-7 place-items-center rounded bg-primary">
              <GitBranch className="size-4 text-primary-foreground" />
            </div>
            <span className="font-display text-sm font-bold tracking-tight">ARCHITECT_OS</span>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="ghost">
              <Link to="/auth">Documentation</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/auth">Sign in</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="grid-paper border-b border-border">
          <div className="mx-auto flex max-w-4xl flex-col items-center px-6 py-24 text-center">
            <span className="label-mono rounded-full border border-border bg-card px-3 py-1 text-primary">
              Design before implementation
            </span>
            <h1 className="mt-6 text-balance text-4xl font-bold leading-[1.08] tracking-tight md:text-6xl">
              System Design <span className="text-primary">Architect</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Most AI tools hand you a diagram and a confident shrug. This one runs the interview,
              does the capacity arithmetic out loud, commits to a recommendation, and names the
              alternative it rejected.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link to="/auth">
                  Start a design <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/auth">View the API</Link>
              </Button>
            </div>

            <div className="mt-20 grid w-full gap-10 border-t border-border pt-12 md:grid-cols-3">
              {BAND.map((item) => (
                <div key={item.title} className="flex flex-col items-center gap-2">
                  <div className="grid size-10 place-items-center rounded bg-secondary text-primary">
                    <item.icon className="size-5" />
                  </div>
                  <h2 className="label-mono text-muted-foreground">{item.title}</h2>
                  <p className="text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-border bg-card">
          <div className="mx-auto grid max-w-6xl gap-px bg-border md:grid-cols-4">
            {DESIGN_MODES.map((mode) => (
              <div key={mode} className="bg-card p-6">
                <p className="label-mono text-primary">{MODE_META[mode].label}</p>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {MODE_META[mode].blurb}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-6 md:grid-cols-2">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="panel p-8">
                <div className="grid size-10 place-items-center rounded bg-secondary text-primary">
                  <feature.icon className="size-5" />
                </div>
                <h2 className="mt-6 text-lg font-bold tracking-tight">{feature.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-border bg-card">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <h2 className="text-2xl font-bold tracking-tight">
              Where it is strong, and where it is not
            </h2>
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

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-8 text-xs text-muted-foreground">
          System Design Architect — design documents, reviews, and stack recommendations.
        </div>
      </footer>
    </div>
  );
}
