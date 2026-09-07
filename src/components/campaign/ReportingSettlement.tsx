"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Banknote, Download, Loader2, Lock, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useCampaign } from "@/lib/campaign-context";
import {
  fetchSettlementReport,
  lockCampaignSettlement,
  patchSettlementAchStatus,
  patchSettlementSettings,
  postCampaignAiSettlementNarrative,
  type SettlementReport,
} from "@/lib/api";
import { PayoutsPanel } from "@/components/campaign/PayoutsPanel";
import { SettlementCalculationBreakdown } from "@/components/campaign/SettlementCalculationBreakdown";
import { apiUrl } from "@/lib/api-config";
import { formatMoneyNumber, formatMoneyUSD } from "@/lib/money-format";

/** Wrap a value as a CSV field, escaping quotes and commas per RFC 4180. */
function csvField(value: string | number | null | undefined): string {
  const str = value == null ? "" : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

function csvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map(csvField).join(",");
}

/** Build a settlement CSV (summary + per-business breakdown) from loaded report data. */
function buildSettlementCsv(report: SettlementReport): string {
  const rows: string[] = [];
  rows.push(csvRow(["Campaign", report.campaign.name]));
  rows.push(csvRow(["Status", report.campaign.status]));
  rows.push(csvRow(["Start date", report.campaign.startDate ?? ""]));
  rows.push(csvRow(["End date", report.campaign.endDate ?? ""]));
  rows.push(csvRow(["Locked", report.campaign.isLocked ? "Yes" : "No"]));
  rows.push("");

  rows.push(csvRow(["Summary", "Amount"]));
  rows.push(csvRow(["Receipts (total)", report.receiptStats.total]));
  rows.push(csvRow(["Receipts (approved)", report.receiptStats.approved]));
  rows.push(csvRow(["Receipts (pending)", report.receiptStats.pending]));
  rows.push(csvRow(["Eligible sales", formatMoneyNumber(report.nonprofitReport.eligibleSales)]));
  rows.push(csvRow(["Donation pool", formatMoneyNumber(report.nonprofitReport.donationPool)]));
  rows.push(csvRow(["ForkUp fee", formatMoneyNumber(report.nonprofitReport.forkupFee)]));
  rows.push(csvRow(["Net to nonprofit", formatMoneyNumber(report.nonprofitReport.netNonprofitAmount)]));
  if (report.onlineDonations) {
    rows.push(csvRow(["Online donations (count)", report.onlineDonations.count]));
    rows.push(csvRow(["Online donations (total)", formatMoneyNumber(report.onlineDonations.total)]));
  }
  rows.push("");

  rows.push(
    csvRow([
      "Business",
      "Location",
      "Eligible sales",
      "Donation %",
      "Donation pool",
      "ForkUp fee",
      "Net to nonprofit",
      "Payment status",
      "Locked at",
    ]),
  );
  for (const b of report.businessReports) {
    rows.push(
      csvRow([
        b.businessName,
        b.locationName,
        formatMoneyNumber(b.eligibleSales),
        b.donationPercentage,
        formatMoneyNumber(b.donationPool),
        formatMoneyNumber(b.forkupFee),
        formatMoneyNumber(b.netNonprofitAmount),
        b.paymentStatus,
        b.lockedAt ?? "",
      ]),
    );
  }

  return rows.join("\r\n");
}

const ACH_OPTIONS = ["pending", "processing", "paid", "failed"] as const;

export function ReportingSettlement() {
  const { state, goTo } = useCampaign();
  const slug = state.campaignSlug;
  const [report, setReport] = useState<SettlementReport | null>(null);
  const [loading, setLoading] = useState(!!slug);
  const [error, setError] = useState<string | null>(null);
  const [locking, setLocking] = useState(false);
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [achBusyId, setAchBusyId] = useState<number | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [platformFee, setPlatformFee] = useState("");
  const [cardFee, setCardFee] = useState("");
  const [cardFixed, setCardFixed] = useState("");
  const [tips, setTips] = useState("");
  const [auction, setAuction] = useState("");

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      const next = await fetchSettlementReport(slug);
      setReport(next);
      setPlatformFee(
        next.campaign.platformFeePercent != null ? String(next.campaign.platformFeePercent) : "",
      );
      setCardFee(next.campaign.cardFeePercent != null ? String(next.campaign.cardFeePercent) : "");
      setCardFixed(next.campaign.cardFeeFixed != null ? String(next.campaign.cardFeeFixed) : "");
      setTips(String(next.campaign.bartenderTips ?? 0));
      setAuction(String(next.campaign.silentAuction ?? 0));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settlement");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDownloadCsv = () => {
    if (!report) return;
    const csv = buildSettlementCsv(report);
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `settlement-${slug ?? "campaign"}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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

  const handleAchStatus = async (
    settlementId: number,
    achStatus: (typeof ACH_OPTIONS)[number],
  ) => {
    if (!slug) return;
    setAchBusyId(settlementId);
    try {
      await patchSettlementAchStatus(slug, settlementId, achStatus);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update ACH status");
    } finally {
      setAchBusyId(null);
    }
  };

  const handleSaveSettings = async () => {
    if (!slug) return;
    setSettingsSaving(true);
    try {
      const parseOrNull = (raw: string) => {
        const t = raw.trim();
        if (!t) return null;
        const n = Number(t);
        return Number.isFinite(n) ? n : null;
      };
      await patchSettlementSettings(slug, {
        platformFeePercent: parseOrNull(platformFee),
        cardFeePercent: parseOrNull(cardFee),
        cardFeeFixed: parseOrNull(cardFixed),
        bartenderTips: Number(tips) || 0,
        silentAuction: Number(auction) || 0,
      });
      toast.success("Settlement settings saved. They apply at freeze/snapshot.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSettingsSaving(false);
    }
  };
  const handleSettlementNarrative = async () => {
    if (!slug) return;
    setNarrativeLoading(true);
    try {
      const res = await postCampaignAiSettlementNarrative(slug);
      setNarrative(res.summary);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to draft settlement narrative");
    } finally {
      setNarrativeLoading(false);
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
      <button
        onClick={() => goTo("dashboard")}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to campaign dashboard
      </button>
      <h1 className="text-2xl font-extrabold tracking-tight">Reporting &amp; Settlement</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        After the campaign end date plus grace period, ForkUp closes the campaign, waits a 24-hour
        adjustment window, then freezes totals. Settlement uses approved Dine &amp; Donate receipts
        and completed online donations, applies the platform fee and card processing fees, then
        emails PDF statements.
      </p>

      {loading && (
        <div className="mt-10 flex justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      )}

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      {report && !loading && (
        <div className="mt-8 space-y-6">
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={narrativeLoading}
              onClick={() => void handleSettlementNarrative()}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold transition-colors hover:bg-secondary disabled:opacity-60"
            >
              {narrativeLoading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              Draft AI settlement narrative
            </button>
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold transition-colors hover:bg-secondary"
            >
              <Download className="size-3.5" />
              Download CSV
            </button>
          </div>

          {narrative && (
            <section className="rounded-2xl border border-border bg-card p-5 text-sm">
              <h2 className="flex items-center gap-2 font-bold">
                <Sparkles className="size-4 text-primary" />
                Settlement narrative
              </h2>
              <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{narrative}</p>
            </section>
          )}

          {report.pipeline && (
            <section className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-bold">Settlement pipeline</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Grace period {report.campaign.graceDays ?? 7} days after the end date, then a 24-hour
                adjustment window. You can still lock early with the button below.
              </p>
              <ol className="mt-4 grid gap-2 text-sm sm:grid-cols-4">
                {(
                  [
                    ["Closed", report.pipeline.closed],
                    ["Frozen", report.pipeline.frozen],
                    ["Snapshot", report.pipeline.snapshot],
                    ["Statements sent", report.pipeline.statementsSent],
                  ] as const
                ).map(([label, done]) => (
                  <li
                    key={label}
                    className={`rounded-lg px-3 py-2 ${done ? "bg-primary/10 font-semibold" : "bg-secondary/40 text-muted-foreground"}`}
                  >
                    {done ? "Done" : "Pending"} — {label}
                  </li>
                ))}
              </ol>
              {report.campaign.adjustmentWindowEnd && !report.pipeline.frozen && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Adjustment window ends {new Date(report.campaign.adjustmentWindowEnd).toLocaleString()}
                </p>
              )}
            </section>
          )}

          {!report.pipeline?.frozen && (
            <section className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-bold">Fees &amp; manual amounts</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Optional overrides before freeze. Leave fees blank to use 15% platform and 2.9% +
                $0.30 card fees. Tips and silent auction are stored on the snapshot and excluded
                from giveback %.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="text-muted-foreground">Platform fee %</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={platformFee}
                    onChange={(e) => setPlatformFee(e.target.value)}
                    placeholder="15"
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-muted-foreground">Card fee %</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={cardFee}
                    onChange={(e) => setCardFee(e.target.value)}
                    placeholder="2.9"
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-muted-foreground">Card fixed fee $</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={cardFixed}
                    onChange={(e) => setCardFixed(e.target.value)}
                    placeholder="0.30"
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-muted-foreground">Bartender tips $</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={tips}
                    onChange={(e) => setTips(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-muted-foreground">Silent auction $</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={auction}
                    onChange={(e) => setAuction(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2"
                  />
                </label>
              </div>
              <button
                type="button"
                disabled={settingsSaving}
                onClick={() => void handleSaveSettings()}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold hover:bg-secondary disabled:opacity-60"
              >
                {settingsSaving ? <Loader2 className="size-3.5 animate-spin" /> : null}
                Save settlement settings
              </button>
            </section>
          )}

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
              Eligible sales, donation pool, platform fee, and net nonprofit amount are stored
              separately.
            </p>
            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <div className="flex justify-between rounded-lg bg-secondary/40 px-3 py-2">
                <dt>Eligible sales</dt>
                <dd className="font-semibold">{formatMoneyUSD(report.nonprofitReport.eligibleSales)}</dd>
              </div>
              <div className="flex justify-between rounded-lg bg-secondary/40 px-3 py-2">
                <dt>Donation pool</dt>
                <dd className="font-semibold">{formatMoneyUSD(report.nonprofitReport.donationPool)}</dd>
              </div>
              <div className="flex justify-between rounded-lg bg-secondary/40 px-3 py-2">
                <dt>ForkUp fee</dt>
                <dd className="font-semibold">{formatMoneyUSD(report.nonprofitReport.forkupFee)}</dd>
              </div>
              <div className="flex justify-between rounded-lg bg-primary/10 px-3 py-2">
                <dt>Net to nonprofit</dt>
                <dd className="font-bold text-primary">
                  {formatMoneyUSD(report.nonprofitReport.netNonprofitAmount)}
                </dd>
              </div>
            </dl>
          </section>

          {report.calculationReview && (
            <SettlementCalculationBreakdown review={report.calculationReview} />
          )}

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
                    {formatMoneyUSD(report.onlineDonations.total)}
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
                      Sales {formatMoneyUSD(b.eligibleSales)} · Donation{" "}
                      {formatMoneyUSD(b.donationPool)} · Net {formatMoneyUSD(b.netNonprofitAmount)} ·{" "}
                      {b.paymentStatus}
                    </p>
                    <label className="mt-3 flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">ACH status</span>
                      <select
                        value={(b.achStatus as (typeof ACH_OPTIONS)[number]) || "pending"}
                        disabled={achBusyId === b.id}
                        onChange={(e) =>
                          void handleAchStatus(
                            b.id,
                            e.target.value as (typeof ACH_OPTIONS)[number],
                          )
                        }
                        className="rounded-lg border border-border bg-background px-2 py-1 font-semibold capitalize"
                      >
                        {ACH_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </label>
                    {b.pdfBusinessPath && (
                      <a
                        href={apiUrl(b.pdfBusinessPath)}
                        className="mt-2 inline-block text-xs font-semibold text-primary hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Download statement PDF
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {report.statements?.nonprofitPdf && (
            <p className="text-sm">
              <a
                href={apiUrl(report.statements.nonprofitPdf)}
                className="font-semibold text-primary hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                Download nonprofit donation statement PDF
              </a>
            </p>
          )}

          {report.achApprovals && report.achApprovals.length > 0 && (
            <section className="rounded-2xl border border-amber-200 bg-amber-50/80 p-6 dark:border-amber-900 dark:bg-amber-950/30">
              <h2 className="font-bold">ACH approvals</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Businesses and nonprofits approve ACH via email links before transfers are initiated.
              </p>
              <ul className="mt-4 space-y-2 text-sm">
                {report.achApprovals.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2"
                  >
                    <span>
                      {a.approvalType === "nonprofit_payout"
                        ? "Online donation payout"
                        : `${a.businessName ?? "Business"}${a.locationName ? ` — ${a.locationName}` : ""}`}
                      {" · "}
                      {formatMoneyUSD(a.amount)}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                        a.status === "approved"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {a.status}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {report.onlineDonations &&
            report.onlineDonations.count > 0 &&
            report.achApprovals?.some(
              (a) => a.approvalType === "nonprofit_payout" && a.status === "pending",
            ) && (
              <p className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">
                Online donation settlement is ready — the nonprofit must approve the payout link
                sent by email before ACH is initiated.
              </p>
            )}

          <PayoutsPanel slug={slug} businessReports={report.businessReports} />

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
