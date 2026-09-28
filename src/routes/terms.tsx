import { createFileRoute } from "@tanstack/react-router";
import { PageShell, pageHead } from "@/components/site-chrome";

export const Route = createFileRoute("/terms")({
  head: () =>
    pageHead("/terms", "Terms — System Design Architect", "Terms for using System Design Architect during beta."),
  component: TermsPage,
});

function TermsPage() {
  return (
    <PageShell>
      <div className="mx-auto max-w-3xl px-6 py-16 text-sm leading-relaxed">
        <p className="label-mono text-primary">Terms</p>
        <h1 className="mt-4">Terms of use</h1>
        <p className="label-mono mt-4 text-muted-foreground">Last updated: 28 September 2026</p>
        <ul className="mt-8 list-disc space-y-3 pl-5 text-muted-foreground">
          <li>The service is free during beta and provided as is. Access is by approval and can be withdrawn.</li>
          <li>Only upload internal documents and references you have the rights to use.</li>
          <li>Designs are AI-generated. Capacity and cost figures are estimates; final architectural decisions and accountability stay with you.</li>
          <li>Do not use the service or its API to abuse, overload or attack other systems.</li>
          <li>You own the designs you create.</li>
        </ul>
      </div>
    </PageShell>
  );
}
