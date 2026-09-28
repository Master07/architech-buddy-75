import { createFileRoute } from "@tanstack/react-router";
import { PageShell, pageHead } from "@/components/site-chrome";

export const Route = createFileRoute("/privacy")({
  head: () =>
    pageHead(
      "/privacy",
      "Privacy — System Design Architect",
      "Where your uploads are stored, which AI provider processes them, and how to delete them.",
    ),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <PageShell>
      <div className="mx-auto max-w-3xl px-6 py-16 text-sm leading-relaxed">
        <p className="label-mono text-primary">Privacy</p>
        <h1 className="mt-4">Your data</h1>
        <p className="label-mono mt-4 text-muted-foreground">Last updated: 28 September 2026</p>
        <h2 className="mt-10 text-base">What we store</h2>
        <p className="mt-4 text-muted-foreground">
          Your account email, your conversations and designs, documents you upload to your
          library, evidence you paste, and your API keys (stored only as a one-way fingerprint).
          AI provider keys you add are encrypted before they are saved.
        </p>
        <h2 className="mt-10 text-base">Which AI provider processes your data</h2>
        <p className="mt-4 text-muted-foreground">
          By default, your requests are processed by Google Gemini models through Lovable's AI
          gateway. If you add your own AI provider key on the model settings page, your requests
          go to that provider instead, under your own agreement with them. Document search
          embeddings always use the built-in embedding model.
        </p>
        <h2 className="mt-10 text-base">Where it is stored</h2>
        <p className="mt-4 text-muted-foreground">
          Your data is stored in a database hosted in Singapore (ap-southeast-1). When you delete
          a document or design it is removed immediately; backups roll off within the hosting
          provider's standard retention window.
        </p>
        <h2 className="mt-10 text-base">Who can see it</h2>
        <p className="mt-4 text-muted-foreground">
          Everything you upload stays private to your account. Other users cannot see or search
          your library, designs or keys.
        </p>
        <h2 className="mt-10 text-base">AI training</h2>
        <p className="mt-4 text-muted-foreground">
          Your uploads and designs are never used to train AI models. They are sent to the AI
          model only to answer your own requests.
        </p>
        <h2 className="mt-10 text-base">Deleting your data</h2>
        <p className="mt-4 text-muted-foreground">
          Removing a document or design deletes it. To close your account and delete all of your
          data, email{" "}
          <a href="mailto:navneet.jha07@gmail.com" className="underline">navneet.jha07@gmail.com</a>{" "}
          from your account address and we will confirm deletion within 7 days.
        </p>
      </div>
    </PageShell>
  );
}
