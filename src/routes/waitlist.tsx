import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageShell, pageHead } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { joinWaitlist } from "@/lib/signups.functions";

export const Route = createFileRoute("/waitlist")({
  head: () =>
    pageHead(
      "/waitlist",
      "Join the waitlist — System Design Architect",
      "Get early access to the AI system design partner. Free during beta.",
    ),
  component: WaitlistPage,
});

const USES = ["Design docs at work", "Architecture reviews", "Building my startup", "Interview prep", "Other"];

function WaitlistPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [useCase, setUseCase] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await joinWaitlist({ data: { email, name, useCase, note } });
      setDone(true);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-xl px-6 py-16">
        <p className="label-mono text-primary">Free during beta</p>
        <h1 className="mt-4">Join the waitlist</h1>
        <p className="mt-4 text-muted-foreground">
          Leave your email and we'll let you know when your spot is ready.
        </p>
        {done ? (
          <div className="panel mt-10 p-6">
            <h2 className="text-base">You're on the list</h2>
            <p className="mt-3 text-sm text-muted-foreground">Thanks — we'll email {email} when access opens.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="panel mt-10 space-y-5 p-6">
            <div className="space-y-1.5">
              <Label htmlFor="wl-email">Email</Label>
              <Input id="wl-email" type="email" required maxLength={255} value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wl-name">Name (optional)</Label>
              <Input id="wl-name" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>What will you use it for?</Label>
              <div className="flex flex-wrap gap-2">
                {USES.map((u) => (
                  <Button key={u} type="button" size="sm" variant={useCase === u ? "default" : "outline"} onClick={() => setUseCase(useCase === u ? "" : u)}>
                    {u}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wl-note">Anything else? (optional)</Label>
              <Input id="wl-note" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Joining…" : "Join the waitlist"}
            </Button>
          </form>
        )}
      </div>
    </PageShell>
  );
}
