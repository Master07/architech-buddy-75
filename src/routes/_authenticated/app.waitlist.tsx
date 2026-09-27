import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { decideWaitlist, getMyAccess, listWaitlist } from "@/lib/waitlist.functions";

export const Route = createFileRoute("/_authenticated/app/waitlist")({
  head: () => ({ meta: [{ title: "Waitlist — System Design Architect" }] }),
  component: WaitlistAdmin,
});

type Filter = "pending" | "approved" | "rejected" | "all";

function WaitlistAdmin() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("pending");
  const [busy, setBusy] = useState<string | null>(null);
  const access = useQuery({ queryKey: ["my-access"], queryFn: () => getMyAccess() });
  const list = useQuery({
    queryKey: ["waitlist"],
    queryFn: () => listWaitlist(),
    enabled: access.data?.isAdmin === true,
  });

  if (access.data && !access.data.isAdmin) {
    return <div className="p-8 text-sm text-muted-foreground">Only admins can see the waitlist.</div>;
  }

  const rows = (list.data ?? []).filter((r) => filter === "all" || r.status === filter);
  const counts = (s: string) => (list.data ?? []).filter((r) => r.status === s).length;

  async function decide(userId: string, status: "approved" | "rejected" | "pending") {
    setBusy(userId);
    try {
      await decideWaitlist({ data: { userId, status } });
      await qc.invalidateQueries({ queryKey: ["waitlist"] });
      toast.success(status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : "Moved back to waiting");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-8 py-10">
        <p className="label-mono text-primary">Admin</p>
        <h1 className="mt-3 text-2xl">Waitlist</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          New sign-ups wait here until you approve them. Approved people can use the app and the API.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {(["pending", "approved", "rejected", "all"] as Filter[]).map((f) => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className="label-mono">
              {f} {f !== "all" && `(${counts(f)})`}
            </Button>
          ))}
        </div>

        <div className="mt-6 border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-card text-left">
              <tr>
                <th className="label-mono p-3">Person</th>
                <th className="label-mono p-3">Joined</th>
                <th className="label-mono p-3">Status</th>
                <th className="label-mono p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.user_id} className="border-b border-border last:border-0">
                  <td className="p-3">
                    <div>{r.display_name || r.email || "Unknown"}</div>
                    {r.display_name && <div className="text-xs text-muted-foreground">{r.email}</div>}
                  </td>
                  <td className="p-3 text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="label-mono p-3">{r.status}</td>
                  <td className="p-3">
                    <div className="flex justify-end gap-2">
                      {r.status !== "approved" && (
                        <Button size="sm" disabled={busy === r.user_id} onClick={() => decide(r.user_id, "approved")}>Approve</Button>
                      )}
                      {r.status !== "rejected" && (
                        <Button size="sm" variant="outline" disabled={busy === r.user_id} onClick={() => decide(r.user_id, "rejected")}>
                          {r.status === "approved" ? "Revoke" : "Reject"}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-muted-foreground">
                    {list.isLoading ? "Loading…" : "Nobody here."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
