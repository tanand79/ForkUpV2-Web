"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowLeft,
  BarChart3,
  DollarSign,
  Loader2,
  Receipt,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { useCampaign } from "@/lib/campaign-context";
import { fetchCampaignAnalytics, type CampaignAnalytics as Analytics } from "@/lib/api";
import { formatDateUs } from "@/lib/date-only";
import { netAfterPlatformFee } from "@/lib/platform-config";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function fmtCurrency(value: number): string {
  return currency.format(value ?? 0);
}

function fmtDate(iso: string): string {
  return formatDateUs(iso);
}

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}

function KpiCard({ icon, label, value, hint }: KpiCardProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-extrabold tracking-tight text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function CampaignAnalytics() {
  const { state, goTo } = useCampaign();
  const slug = state.campaignSlug;
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(!!slug);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      setData(await fetchCampaignAnalytics(slug));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!slug) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-12 text-center">
        <p className="text-muted-foreground">Launch a campaign to view analytics &amp; insights.</p>
        <button type="button" onClick={() => goTo("dashboard")} className="btn-primary mt-4">
          Go to dashboard
        </button>
      </main>
    );
  }

  const raisedNet = data ? netAfterPlatformFee(data.campaign.raised) : 0;
  const poolNet = data ? netAfterPlatformFee(data.totals.donationPool) : 0;
  const timelineNet =
    data?.timeline.map((row) => ({
      ...row,
      donationPool: netAfterPlatformFee(row.donationPool),
    })) ?? [];
  const goalPct =
    data && data.campaign.goal > 0
      ? Math.min(100, Math.round((raisedNet / data.campaign.goal) * 100))
      : null;

  const approvalRate =
    data && data.totals.receiptsUploaded > 0
      ? Math.round((data.totals.receiptsApproved / data.totals.receiptsUploaded) * 100)
      : 0;

  const hasTimeline = !!data && data.timeline.length > 0;

  return (
    <main className="mx-auto max-w-4xl px-5 py-10 sm:px-6">
      <button
        onClick={() => goTo("dashboard")}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to campaign dashboard
      </button>
      <div className="flex items-center gap-2">
        <BarChart3 className="size-6 text-primary" />
        <h1 className="text-2xl font-extrabold tracking-tight">Analytics &amp; Insights</h1>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Campaign performance across receipts, giveback donations, supporters, and participating
        businesses.
      </p>

      {loading && (
        <div className="mt-10 flex justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      )}

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      {data && !loading && (
        <div className="mt-8 space-y-8">
          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-bold">{data.campaign.name}</h2>
            <p className="mt-1 text-sm capitalize text-muted-foreground">
              Status: {data.campaign.status.replace(/_/g, " ")}
            </p>
            <div className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-3xl font-extrabold tracking-tight">
                {fmtCurrency(raisedNet)}
              </span>
              <span className="text-sm text-muted-foreground">
                raised of {fmtCurrency(data.campaign.goal)} goal
              </span>
            </div>
            {goalPct != null && (
              <div className="mt-3">
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${goalPct}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{goalPct}% of goal</p>
              </div>
            )}
          </section>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              icon={<DollarSign className="size-4" />}
              label="Giveback pool"
              value={fmtCurrency(poolNet)}
              hint={`from ${fmtCurrency(data.totals.eligibleSales)} eligible sales`}
            />
            <KpiCard
              icon={<Receipt className="size-4" />}
              label="Receipts approved"
              value={`${data.totals.receiptsApproved}`}
              hint={`${data.totals.receiptsUploaded} uploaded · ${approvalRate}% approved`}
            />
            <KpiCard
              icon={<Users className="size-4" />}
              label="Supporters"
              value={`${data.totals.supporters}`}
              hint={
                data.totals.averageContribution > 0
                  ? `avg ${fmtCurrency(data.totals.averageContribution)} / receipt`
                  : undefined
              }
            />
            <KpiCard
              icon={<TrendingUp className="size-4" />}
              label="Online donations"
              value={fmtCurrency(data.totals.onlineDonationTotal)}
              hint={`${data.totals.onlineDonationCount} online gift${
                data.totals.onlineDonationCount === 1 ? "" : "s"
              }`}
            />
          </section>

          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="flex items-center gap-2 font-bold">
              <Receipt className="size-4 text-primary" />
              Receipt review status
            </h2>
            <div className="mt-4 grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-extrabold text-emerald-600">
                  {data.totals.receiptsApproved}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Approved</p>
              </div>
              <div>
                <p className="text-2xl font-extrabold text-amber-500">
                  {data.totals.receiptsPending}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Pending</p>
              </div>
              <div>
                <p className="text-2xl font-extrabold text-destructive">
                  {data.totals.receiptsRejected}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Rejected</p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="flex items-center gap-2 font-bold">
              <TrendingUp className="size-4 text-primary" />
              Donation pool over time
            </h2>
            {hasTimeline ? (
              <div className="mt-4 h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timelineNet} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="donationFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={fmtDate}
                      tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                      tickLine={false}
                      axisLine={false}
                      width={48}
                      tickFormatter={(v: number) => currency.format(v)}
                    />
                    <Tooltip
                      formatter={(value) => [fmtCurrency(Number(value)), "Donation pool"]}
                      labelFormatter={(label) => fmtDate(String(label))}
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        background: "var(--card)",
                        fontSize: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="donationPool"
                      stroke="var(--primary)"
                      strokeWidth={2}
                      fill="url(#donationFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                No receipt activity yet — the trend will appear once supporters start uploading
                receipts.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="flex items-center gap-2 font-bold">
              <Trophy className="size-4 text-primary" />
              Business leaderboard
            </h2>
            {data.businessLeaderboard.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                No participating businesses have generated donations yet.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Business</th>
                      <th className="py-2 pr-3 text-right font-medium">Receipts</th>
                      <th className="py-2 pr-3 text-right font-medium">Eligible sales</th>
                      <th className="py-2 text-right font-medium">Giveback pool</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.businessLeaderboard.map((b, i) => (
                      <tr
                        key={`${b.businessId ?? "x"}-${b.locationId ?? "x"}-${i}`}
                        className="border-b border-border/60 last:border-0"
                      >
                        <td className="py-2.5 pr-3">
                          <span className="font-semibold text-foreground">{b.businessName}</span>
                          {b.locationName && b.locationName !== "—" && (
                            <span className="block text-xs text-muted-foreground">
                              {b.locationName}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">{b.approvedReceipts}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">
                          {fmtCurrency(b.eligibleSales)}
                        </td>
                        <td className="py-2.5 text-right font-semibold tabular-nums">
                          {fmtCurrency(netAfterPlatformFee(b.donationPool))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
