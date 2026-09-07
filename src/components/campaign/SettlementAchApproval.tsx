/**
 * SettlementAchApproval — public screen for business ACH debit or nonprofit payout approval.
 *
 * Purpose: recipient opens email link (?step=settlement-ach-approval&token=…), reviews
 * amount, and approves so ForkUp can initiate ACH via the bank portal.
 *
 * Inputs: token query param. Outputs: calls approve API; shows confirmation.
 */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Landmark, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import {
  approveSettlementAch,
  fetchSettlementAchApproval,
  type SettlementAchApproval,
} from "@/lib/api-settlement-ach";
import { formatMoneyUSD } from "@/lib/money-format";

const inputClass =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";

export function SettlementAchApproval() {
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token")?.trim() ?? "", [searchParams]);

  const [approval, setApproval] = useState<SettlementAchApproval | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setError("Missing approval link. Open the link from your settlement email.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSettlementAchApproval(token);
      setApproval(res.approval);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load approval");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await approveSettlementAch(token, {
        approvedByName: name.trim(),
        approvedByEmail: email.trim(),
      });
      setApproval(res.approval);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setSubmitting(false);
    }
  };

  const title =
    approval?.approvalType === "nonprofit_payout"
      ? "Approve online donation payout"
      : "Approve ACH debit";

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Landmark className="size-5 text-primary" />
          {title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Review the settlement amount below and approve to authorize ForkUp to initiate ACH
          through our bank portal.
        </p>

        {loading && (
          <div className="mt-8 flex justify-center">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        )}

        {error && !loading && (
          <p className="mt-6 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </p>
        )}

        {approval && !loading && (
          <div className="mt-6 space-y-4">
            <dl className="space-y-2 rounded-xl bg-secondary/40 p-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Campaign</dt>
                <dd className="font-semibold text-right">{approval.campaignName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Organization</dt>
                <dd className="font-semibold text-right">{approval.organizationName}</dd>
              </div>
              {approval.businessName && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Business</dt>
                  <dd className="font-semibold text-right">
                    {approval.businessName}
                    {approval.locationName ? ` — ${approval.locationName}` : ""}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-4 border-t border-border pt-2">
                <dt className="text-muted-foreground">Amount</dt>
                <dd className="text-lg font-bold text-primary">{formatMoneyUSD(approval.amount)}</dd>
              </div>
            </dl>

            {approval.status === "approved" ? (
              <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
                <div>
                  <p className="font-semibold">ACH approved</p>
                  <p className="mt-1 text-xs opacity-90">
                    {approval.approvedByName
                      ? `Approved by ${approval.approvedByName}.`
                      : "This settlement has been approved."}{" "}
                    ForkUp will initiate the transfer via our bank portal.
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleApprove} className="space-y-3">
                <label className="block text-xs font-semibold text-muted-foreground">
                  Your name
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={`mt-1 ${inputClass}`}
                  />
                </label>
                <label className="block text-xs font-semibold text-muted-foreground">
                  Your email
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`mt-1 ${inputClass}`}
                  />
                </label>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                  Approve ACH
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
