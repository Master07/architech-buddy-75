import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { MODE_META, DESIGN_MODES } from "@/lib/design-agent";
import { ArrowRight, BookOpen, GitBranch, Plug, ShieldCheck, Zap } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "System Design Architect — AI system design partner" },
      {
        name: "description",
        content:
          "Interview-driven AI architect that produces full system design documents, reviews existing architectures, and cites your own internal docs and references.",
      },
      { property: "og:title", content: "System Design Architect — AI system design partner" },
      {
        property: "og:description",
        content:
          "Design before you implement. Requirements, capacity math, diagrams, trade-offs and failure modes — grounded in your own library.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://sda.corbetai.com/" },
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
    title: "Your own references",
    body: "Upload internal docs and references you have rights to. Passages are cited inline.",
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

const AUDIENCE = [
  { title: "Senior engineers & developers", body: "Write the design doc before the first line of code." },
  { title: "Architecture review teams", body: "Score existing designs against a rigorous checklist." },
  { title: "Solo founders", body: "Get a second opinion on your stack and scaling path." },
  { title: "Interview prep", body: "Practise with scoped questions and full worked answers." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <main>
        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <p className="label-mono text-primary">Free during beta · access by approval</p>
            <h1 className="mt-6 max-w-4xl text-balance leading-[1.15]">Design before you implement</h1>
            <p className="mt-8 max-w-2xl text-base leading-relaxed text-muted-foreground">
              Requirements, capacity math, diagrams, trade-offs and failure modes — grounded in
              your own internal docs and references.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/waitlist" className="label-mono">
                  Join the waitlist <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/samples" className="label-mono">See a sample doc</Link>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <Link to="/docs" className="label-mono">View the API</Link>
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Already approved? <Link to="/auth" className="underline">Sign in</Link>.
            </p>

            <div className="mt-20 grid w-full gap-px border-t border-border bg-border pt-px md:grid-cols-3">
              {BAND.map((item) => (
                <div key={item.title} className="flex gap-4 bg-background px-1 py-10 md:px-6">
                  <item.icon className="mt-1 size-6 shrink-0" />
                  <div>
                    <h2 className="label-mono">{item.title}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {item.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <p className="label-mono text-primary">Who it is for</p>
            <div className="mt-6 grid gap-6 md:grid-cols-4">
              {AUDIENCE.map((a) => (
                <div key={a.title}>
                  <h2 className="text-sm">{a.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>



        <section id="how-it-works" className="border-b border-border">
          <div className="mx-auto max-w-5xl px-6 py-20">
            <p className="label-mono text-primary">How it works · 70 seconds</p>
            <h2 className="mt-4">See the tool in action</h2>
            <div className="panel mt-8 overflow-hidden bg-card p-0">
              <video
                className="block aspect-video w-full"
                src="/how-it-works.mp4"
                poster="/how-it-works-poster.jpg"
                controls
                playsInline
                preload="metadata"
              />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Free during beta. New accounts are approved from a waitlist.
            </p>
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
                <feature.icon className="size-6" />
                <h2 className="mt-6 text-base">{feature.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
              </div>
            ))}
          </div>
        </section>


        <section className="border-t border-border bg-card">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <h2>Where it is strong, and where it is not</h2>

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

      <SiteFooter />
    </div>
  );
}
