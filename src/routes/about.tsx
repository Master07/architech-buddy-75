import { createFileRoute } from "@tanstack/react-router";
import { PageShell, pageHead } from "@/components/site-chrome";

export const Route = createFileRoute("/about")({
  head: () =>
    pageHead(
      "/about",
      "About — System Design Architect by Corbet AI",
      "Who builds System Design Architect, who it is for, and how it works.",
    ),
  component: AboutPage,
});

function AboutPage() {
  return (
    <PageShell>
      <div className="mx-auto max-w-3xl px-6 py-16 text-sm leading-relaxed">
        <p className="label-mono text-primary">About</p>
        <h1 className="mt-4">Built by Corbet AI</h1>
        <p className="mt-6 text-muted-foreground">
          System Design Architect is built by{" "}
          <a href="https://corbetai.com" className="underline">Corbet AI</a>. It exists because
          good systems are designed before they are built, and most design documents skip the
          capacity math, the rejected alternatives and the failure modes.
        </p>
        <h2 className="mt-10 text-base">Who it is for</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-muted-foreground">
          <li>Senior engineers and developers writing design docs before implementation.</li>
          <li>Architecture review teams checking existing designs against a rigorous checklist.</li>
          <li>Solo founders who need a second opinion on their stack and scaling path.</li>
          <li>Engineers preparing for system design interviews.</li>
        </ul>
        <h2 className="mt-10 text-base">Who is behind it</h2>
        <p className="mt-4 text-muted-foreground">
          Corbet AI is run by Navneet Kumar. Questions, feedback or deletion requests:{" "}
          <a href="mailto:navneet.jha07@gmail.com" className="underline">navneet.jha07@gmail.com</a>.
        </p>
        <h2 className="mt-10 text-base">Pricing</h2>
        <p className="mt-4 text-muted-foreground">Free during beta. Access is by approval while we grow capacity.</p>
      </div>
    </PageShell>
  );
}
