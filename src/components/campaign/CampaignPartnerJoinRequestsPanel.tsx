"use client";

/**
 * NPO campaign dashboard: pending business join requests from the public page.
 *
 * Inputs: campaign slug. Outputs: list + Accept / Decline actions.
 * On accept, backend creates the normal invite; business completes acceptance.
 */
import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Store, X } from "lucide-react";
import {
  acceptPartnerJoinRequest,
  declinePartnerJoinRequest,
  fetchManagePartnerJoinRequests,
  type PartnerJoinRequest,
} from "@/lib/api";
import { getAuthToken } from "@/lib/auth-storage";

export function CampaignPartnerJoinRequestsPanel({ slug }: { slug: string }) {
  const [requests, setRequests] = useState<PartnerJoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(() => {
    if (!slug || !getAuthToken()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    void fetchManagePartnerJoinRequests(slug, "pending")
      .then((res) => setRequests(res.requests))
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load join requests");
        setRequests([]);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const onAccept = async (id: number) => {
    setBusyId(id);
    setError(null);
    try {
      await acceptPartnerJoinRequest(slug, id);
      setRequests((prev) => prev.filter((r) => r.id !== id));
      window.dispatchEvent(new Event("forkup-partner-invitation-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Accept failed");
    } finally {
      setBusyId(null);
    }
  };

  const onDecline = async (id: number) => {
    setBusyId(id);
    setError(null);
    try {
      await declinePartnerJoinRequest(slug, id);
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Decline failed");
    } finally {
      setBusyId(null);
    }
  };

  if (!slug || (!loading && requests.length === 0 && !error)) {
    return null;
  }

  return (
    <section className="animate-rise mb-8 rounded-3xl border border-border bg-card p-6 [animation-delay:50ms]">
      <h2 className="flex items-center gap-2 font-bold">
        <Store className="size-4 text-primary" />
        Business join requests
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Restaurants and local businesses who asked to join this campaign from the public page.
        Accept to send them the normal partnership invitation.
      </p>

      {loading && (
        <div className="mt-4 flex justify-center py-4">
          <Loader2 className="size-5 animate-spin text-primary" />
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {!loading && requests.length > 0 && (
        <ul className="mt-4 space-y-2">
          {requests.map((r) => (
            <li
              key={r.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{r.businessName}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {r.locationName}
                  {r.city || r.state
                    ? ` · ${[r.city, r.state].filter(Boolean).join(", ")}`
                    : ""}
                  {" · "}
                  {r.methodName}
                  {r.doorType ? ` · ${r.doorType}` : ""}
                </p>
                {r.message && (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{r.message}</p>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => void onAccept(r.id)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {busyId === r.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Check className="size-3.5" />
                  )}
                  Accept
                </button>
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => void onDecline(r.id)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold disabled:opacity-60"
                >
                  <X className="size-3.5" />
                  Decline
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
