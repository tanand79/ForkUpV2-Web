"use client";

import { useCallback, useEffect, useState } from "react";
import { Banknote, Loader2, Lock } from "lucide-react";
import { useCampaign } from "@/lib/campaign-context";
import { fetchSettlementReport, lockCampaignSettlement, type SettlementReport } from "@/lib/api";

export function ReportingSettlement() {
  const { state, goTo } = useCampaign();
  const slug = state.campaignSlug;
  const [report, setReport] = useState<SettlementReport | null>(null);
  const [loading, setLoading] = useState(!!slug);
  const [error, setError] = useState<string | null>(null);
  const [locking, setLocking] = useState(false);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      setReport(await fetchSettlementReport(slug));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settlement");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleLock = async () => {
    if (!slug || !confirm("Lock this campaign for final settlement? This cannot be undone.")) return;
    setLocking(true);
    try {
      await lockCampaignSettlement(slug);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to lock campaign");
    } finally {
      setLocking(false);
    }
  };

  if (!slug) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-12 text-center">
        <p className="text-muted-foreground">Launch a campaign to view settlement reporting.</p>
        <button type="button" onClick={() => goTo("dashboard")} className="btn-primary mt-4">
          Go to dashboard
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:px-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Reporting &amp; Settlement</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Business giveback settlement from approved receipts. Online donations are tracked separately
        and excluded from business settlement calculations.
      </p>

      {loading && (
        <div className="mt-10 flex justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      )}

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      {report && !loading && (
        <div className="mt-8 space-y-6">
          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-bold">{report.campaign.name}</h2>
            <p className="mt-1 text-sm capitalize text-muted-foreground">Status: {report.campaign.status}</p>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-2xl font-bold">{report.receiptStats.total}</p>
                <p className="text-xs text-muted-foreground">Receipts</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">{report.receiptStats.approved}</p>
                <p className="text-xs text-muted-foreground">Approved</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600">{report.receiptStats.pending}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="flex items-center gap-2 font-bold">
              <Banknote className="size-4 text-primary" />
              Business giveback summary
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Eligible sales, donation pool, platform fee, and net nonprofit amount are stored separately.
            </p>
            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <div className="flex justify-between rounded-lg bg-secondary/40 px-3 py-2">
                <dt>Eligible sales</dt>
                <dd className="font-semibold">${report.nonprofitReport.eligibleSales.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between rounded-lg bg-secondary/40 px-3 py-2">
                <dt>Donation pool</dt>
                <dd className="font-semibold">${report.nonprofitReport.donationPool.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between rounded-lg bg-secondary/40 px-3 py-2">
                <dt>ForkUp fee</dt>
                <dd className="font-semibold">${report.nonprofitReport.forkupFee.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between rounded-lg bg-primary/10 px-3 py-2">
                <dt>Net to nonprofit</dt>
                <dd className="font-bold text-primary">
                  ${report.nonprofitReport.netNonprofitAmount.toFixed(2)}
                </dd>
              </div>
            </dl>
          </section>

          {report.onlineDonations && report.onlineDonations.count > 0 && (
            <section className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-bold">Online donations</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Recorded separately from business giveback. Included in nonprofit reporting, excluded
                from business settlement.
              </p>
              <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <div className="flex justify-between rounded-lg bg-secondary/40 px-3 py-2">
                  <dt>Donation count</dt>
                  <dd className="font-semibold">{report.onlineDonations.count}</dd>
                </div>
                <div className="flex justify-between rounded-lg bg-primary/10 px-3 py-2">
                  <dt>Total donated online</dt>
                  <dd className="font-bold text-primary">
                    ${report.onlineDonations.total.toFixed(2)}
                  </dd>
                </div>
              </dl>
            </section>
          )}

          {report.businessReports.length > 0 && (
            <section className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-bold">By business / location</h2>
              <ul className="mt-4 space-y-3">
                {report.businessReports.map((b) => (
                  <li key={b.id} className="rounded-xl border border-border p-4 text-sm">
                    <p className="font-semibold">
                      {b.businessName} — {b.locationName}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      Sales ${b.eligibleSales.toFixed(2)} · Donation ${b.donationPool.toFixed(2)} ·
                      Net ${b.netNonprofitAmount.toFixed(2)} · {b.paymentStatus}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {!report.campaign.isLocked && (
            <button
              type="button"
              onClick={handleLock}
              disabled={locking}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {locking ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
              Lock campaign &amp; finalize settlement
            </button>
          )}
        </div>
      )}
    </main>
  );
}
