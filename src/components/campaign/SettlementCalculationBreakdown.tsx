/**
 * SettlementCalculationBreakdown — Task 14 review panel for settlement math.
 *
 * Purpose: show how ForkUp fee, card fees, net amounts, and amounts owed were
 * calculated so nonprofits can verify figures (e.g. $50 donation → $48.25 net).
 *
 * Inputs: calculationReview from settlement report API.
 * Outputs: read-only breakdown table with formulas.
 */
"use client";

import { Calculator } from "lucide-react";
import type { SettlementReport } from "@/lib/api";
import { formatMoneyUSD } from "@/lib/money-format";

type Review = NonNullable<SettlementReport["calculationReview"]>;

export function SettlementCalculationBreakdown({ review }: { review: Review }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="flex items-center gap-2 font-bold">
        <Calculator className="size-4 text-primary" />
        Settlement calculation review
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        ForkUp fee ({review.platformFeePercent}%) applies to business giveback only. Card fees (
        {review.cardFeePercent}% + {formatMoneyUSD(review.cardFeeFixed)} per donation) reduce online
        donation net. Example: a {formatMoneyUSD(50)} online donation yields{" "}
        {formatMoneyUSD(1.75)} card fee and {formatMoneyUSD(48.25)} net to the nonprofit.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-secondary/40 p-4 text-sm">
          <p className="font-semibold">Business giveback</p>
          <dl className="mt-2 space-y-1 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Eligible sales</dt>
              <dd>{formatMoneyUSD(review.business.eligibleSales)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Gross giveback</dt>
              <dd>{formatMoneyUSD(review.business.grossGiveback)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">ForkUp fee</dt>
              <dd>{formatMoneyUSD(review.business.forkupFee)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Net from giveback</dt>
              <dd>{formatMoneyUSD(review.business.netFromGiveback)}</dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-border pt-1 font-semibold">
              <dt>Business owes ForkUp (ACH)</dt>
              <dd>{formatMoneyUSD(review.business.amountOwedByBusiness)}</dd>
            </div>
          </dl>
        </div>

        {review.online && (
          <div className="rounded-xl bg-secondary/40 p-4 text-sm">
            <p className="font-semibold">Online donations</p>
            <dl className="mt-2 space-y-1 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Donations (gross)</dt>
                <dd>{formatMoneyUSD(review.online.donationsGross)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Card processing fee</dt>
                <dd>{formatMoneyUSD(review.online.cardProcessingFee)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Net after card fees</dt>
                <dd>{formatMoneyUSD(review.online.netAfterFees)}</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-border pt-1 font-semibold">
                <dt>Owed to nonprofit</dt>
                <dd>{formatMoneyUSD(review.online.amountOwedToNonprofit)}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[28rem] text-left text-xs">
          <thead className="bg-secondary/50 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-semibold">Line item</th>
              <th className="px-3 py-2 font-semibold">Formula</th>
              <th className="px-3 py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {review.lines.map((line) => (
              <tr key={line.label} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{line.label}</td>
                <td className="px-3 py-2 text-muted-foreground">{line.formula}</td>
                <td className="px-3 py-2 text-right font-semibold">
                  {formatMoneyUSD(line.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="mt-4 grid gap-2 rounded-xl bg-primary/5 p-4 text-sm sm:grid-cols-2">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Total net to nonprofit</dt>
          <dd className="font-bold text-primary">
            {formatMoneyUSD(review.totals.netToNonprofit)}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Outstanding business ACH</dt>
          <dd className="font-semibold">
            {formatMoneyUSD(review.totals.outstandingBusinessAch)}
          </dd>
        </div>
      </dl>
    </section>
  );
}
