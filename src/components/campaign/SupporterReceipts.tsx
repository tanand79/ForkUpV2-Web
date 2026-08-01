"use client";

import { useCallback, useEffect, useState } from "react";
import { Receipt, Loader2, Clock, CheckCircle2, XCircle, Plus } from "lucide-react";
import { useCampaign } from "@/lib/campaign-context";
import { fetchMyReceipts, type MyReceipt } from "@/lib/api";
import { formatDateTimeUs, formatDateUs, looksLikeIsoDateTime } from "@/lib/date-only";

const REVIEW_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  rejected: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
};

function ReviewBadge({ status }: { status: string }) {
  const Icon = status === "approved" ? CheckCircle2 : status === "rejected" ? XCircle : Clock;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
        REVIEW_STYLE[status] ?? REVIEW_STYLE.pending
      }`}
    >
      <Icon className="size-3" />
      {status}
    </span>
  );
}

function formatWhen(value: string): string {
  return looksLikeIsoDateTime(value) ? formatDateTimeUs(value) : formatDateUs(value);
}

export function SupporterReceipts() {
  const { goTo } = useCampaign();
  const [receipts, setReceipts] = useState<MyReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNeedsAuth(false);
    try {
      setReceipts(await fetchMyReceipts());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load your receipts";
      if (/sign in/i.test(message)) setNeedsAuth(true);
      else setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totalDonation = receipts.reduce((sum, r) => sum + (r.calculatedDonation ?? 0), 0);
  const approvedCount = receipts.filter((r) => r.reviewStatus === "approved").length;

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:px-6">
      <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
        <Receipt className="size-6 text-primary" />
        My receipts
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Every receipt you&rsquo;ve uploaded and where it stands in review.
      </p>

      {loading && (
        <div className="mt-10 flex justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      )}

      {needsAuth && !loading && (
        <div className="mt-8 rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Sign in to see the receipts you&rsquo;ve uploaded.
          </p>
          <button type="button" onClick={() => goTo("auth-login")} className="btn-primary mt-4">
            Sign in
          </button>
        </div>
      )}

      {error && !loading && <p className="mt-4 text-sm text-destructive">{error}</p>}

      {!loading && !needsAuth && !error && receipts.length === 0 && (
        <div className="mt-8 rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            You haven&rsquo;t uploaded any receipts yet.
          </p>
          <button
            type="button"
            onClick={() => goTo("campaign-directory")}
            className="btn-primary mt-4 inline-flex items-center gap-2"
          >
            <Plus className="size-4" />
            Find a campaign to support
          </button>
        </div>
      )}

      {!loading && !needsAuth && receipts.length > 0 && (
        <>
          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-2xl font-bold">{receipts.length}</p>
              <p className="text-xs text-muted-foreground">Uploaded</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-2xl font-bold text-emerald-600">{approvedCount}</p>
              <p className="text-xs text-muted-foreground">Approved</p>
            </div>
            <div className="rounded-2xl border border-border bg-primary/10 p-4">
              <p className="text-2xl font-bold text-primary">${totalDonation.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Donations generated</p>
            </div>
          </div>

          <ul className="mt-6 space-y-4">
            {receipts.map((r) => (
              <li key={r.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{r.campaignName ?? "Campaign"}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {r.businessName ?? "Business"}
                      {r.locationName ? ` — ${r.locationName}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Uploaded {formatWhen(r.uploadedAt)}
                    </p>
                    {(r.eligibleSubtotal != null || r.calculatedDonation != null) && (
                      <p className="mt-2 text-sm">
                        {r.eligibleSubtotal != null && (
                          <>Eligible ${r.eligibleSubtotal.toFixed(2)}</>
                        )}
                        {r.calculatedDonation != null && (
                          <>
                            {r.eligibleSubtotal != null ? " · " : ""}
                            Donation{" "}
                            <span className="font-semibold text-primary">
                              ${r.calculatedDonation.toFixed(2)}
                            </span>
                          </>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0">
                    <ReviewBadge status={r.reviewStatus} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
