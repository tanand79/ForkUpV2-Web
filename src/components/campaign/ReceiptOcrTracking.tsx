"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Receipt, XCircle } from "lucide-react";
import { useCampaign } from "@/lib/campaign-context";
import {
  fetchCampaignReceipts,
  reviewReceipt,
  type ReceiptRecord,
} from "@/lib/api";

export function ReceiptOcrTracking() {
  const { state, goTo } = useCampaign();
  const slug = state.campaignSlug;
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [loading, setLoading] = useState(!!slug);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [eligibleInputs, setEligibleInputs] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      setReceipts(await fetchCampaignReceipts(slug));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load receipts");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleReview = async (id: number, action: "approve" | "reject") => {
    setBusyId(id);
    setError(null);
    try {
      let eligible: number | undefined;
      if (action === "approve") {
        const raw = eligibleInputs[id];
        const parsed = raw != null && raw.trim() !== "" ? Number(raw) : NaN;
        eligible = Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
      }
      await reviewReceipt(id, action, eligible);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed");
    } finally {
      setBusyId(null);
    }
  };

  if (!slug) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-12 text-center">
        <p className="text-muted-foreground">
          Launch a campaign first to review uploaded receipts.
        </p>
        <button type="button" onClick={() => goTo("dashboard")} className="btn-primary mt-4">
          Go to dashboard
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:px-6">
      <button
        onClick={() => goTo("dashboard")}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to campaign dashboard
      </button>
      <h1 className="text-2xl font-extrabold tracking-tight">Receipt &amp; OCR Review</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Approve or reject supporter receipts. Approved receipts update campaign totals and settlement.
      </p>

      {loading && (
        <div className="mt-10 flex justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      )}

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      {!loading && receipts.length === 0 && (
        <p className="mt-8 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No receipts uploaded yet for this campaign.
        </p>
      )}

      <ul className="mt-6 space-y-4">
        {receipts.map((r) => (
          <li key={r.id} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Receipt className="size-4 text-primary" />
                  <p className="font-semibold">
                    {r.businessName ?? "Business"} — {r.locationName ?? "Location"}
                  </p>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {r.supporterName} ({r.supporterEmail})
                </p>
                <p className="mt-2 text-sm">
                  OCR: <span className="font-medium">{r.ocrStatus}</span> · Review:{" "}
                  <span className="font-medium">{r.reviewStatus}</span>
                </p>
                {r.eligibleSubtotal != null && (
                  <p className="mt-1 text-sm">
                    Eligible: ${r.eligibleSubtotal.toFixed(2)}
                    {r.calculatedDonation != null && (
                      <> · Donation: ${r.calculatedDonation.toFixed(2)}</>
                    )}
                  </p>
                )}
              </div>
              {r.reviewStatus === "pending" && (
                <div className="flex shrink-0 flex-col items-stretch gap-2 sm:w-44">
                  <label className="text-xs font-medium text-muted-foreground">
                    Eligible amount
                    <div className="relative mt-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        $
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={
                          r.eligibleSubtotal != null ? r.eligibleSubtotal.toFixed(2) : "0.00"
                        }
                        value={eligibleInputs[r.id] ?? ""}
                        onChange={(e) =>
                          setEligibleInputs((prev) => ({ ...prev, [r.id]: e.target.value }))
                        }
                        className="w-full rounded-lg border border-border bg-background py-1.5 pl-6 pr-2 text-sm text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>
                  </label>
                  <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => handleReview(r.id, "approve")}
                    className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
                  >
                    {busyId === r.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-3.5" />
                    )}
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => handleReview(r.id, "reject")}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-4 py-2 text-xs font-semibold"
                  >
                    <XCircle className="size-3.5" />
                    Reject
                  </button>
                  </div>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
