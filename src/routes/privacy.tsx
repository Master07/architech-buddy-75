import { createFileRoute } from "@tanstack/react-router";
import { PageShell, pageHead } from "@/components/site-chrome";

export const Route = createFileRoute("/privacy")({
  head: () =>
    pageHead(
      "/privacy",
      "Privacy — System Design Architect",
      "Where your uploads are stored, how they are used, and how to delete them.",
    ),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <PageShell>
      <div className="mx-auto max-w-3xl px-6 py-16 text-sm leading-relaxed">
        <p className="label-mono text-primary">Privacy</p>
        <h1 className="mt-4">Your data</h1>
        <h2 className="mt-10 text-base">What we store</h2>
        <p className="mt-4 text-muted-foreground">
          Your account email, your conversations and designs, documents you upload to your
          library, evidence you paste, and your API keys (stored only as a one-way fingerprint).
          AI provider keys you add are encrypted before they are saved.
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
          Removing a document or design deletes it. Closing your account deletes all of your
          data. To close your account, contact Corbet AI through{" "}
          <a href="https://corbetai.com" className="underline">corbetai.com</a>.
        </p>
      </div>
    </PageShell>
  );
}
