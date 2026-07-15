/**
 * Platform-wide configuration for ForkUp financial and workflow rules.
 * Values are intentionally centralized so fee percentages and calculation
 * rules can be made configurable per-campaign or per-tenant later.
 *
 * TODO: Load from server config / admin settings when billing rules are finalized.
 */

/** Default ForkUp platform fee as a percentage of the donation pool (giveback). */
export const DEFAULT_PLATFORM_FEE_PERCENT = 15;

export interface GivebackFinancialBreakdown {
  /** Total eligible sales from approved receipts (business giveback path). */
  eligibleSales: number;
  /** Giveback percentage applied to eligible sales. */
  givebackPercentage: number;
  /** Donation pool = eligibleSales × givebackPercentage. */
  donationPool: number;
  /** ForkUp platform fee = donationPool × platformFeePercent. */
  platformFee: number;
  /** Net nonprofit amount = donationPool − platformFee. */
  netNonprofitAmount: number;
}

export interface OnlineDonationRecord {
  /** Donation amount from supporter (online donation path). */
  amount: number;
  /** Stored separately — excluded from business settlement calculations. */
  excludedFromSettlement: true;
}

/**
 * Calculate giveback financial breakdown from eligible sales.
 * Online donations are NOT included — use OnlineDonationRecord separately.
 */
export function calculateGivebackBreakdown(
  eligibleSales: number,
  givebackPercentage: number,
  platformFeePercent: number = DEFAULT_PLATFORM_FEE_PERCENT,
): GivebackFinancialBreakdown {
  const donationPool =
    Math.round(eligibleSales * (givebackPercentage / 100) * 100) / 100;
  const platformFee =
    Math.round(donationPool * (platformFeePercent / 100) * 100) / 100;
  const netNonprofitAmount =
    Math.round((donationPool - platformFee) * 100) / 100;

  return {
    eligibleSales,
    givebackPercentage,
    donationPool,
    platformFee,
    netNonprofitAmount,
  };
}

/** Example from product spec: $2,000 sales @ 15% giveback, 15% platform fee. */
export function exampleGivebackBreakdown(): GivebackFinancialBreakdown {
  return calculateGivebackBreakdown(2000, 15, DEFAULT_PLATFORM_FEE_PERCENT);
}
