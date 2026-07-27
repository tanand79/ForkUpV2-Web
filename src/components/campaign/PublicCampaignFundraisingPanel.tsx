"use client";

/**
 * GoFundMe-style fundraising progress card for public campaign pages.
 *
 * Inputs: raised, goal, supporter stats, CTA handlers
 * Outputs: progress summary with donate/share/participate actions
 */

import { CheckCircle2, Heart, MapPin, Share2, Store, Users } from "lucide-react";
import { formatCurrency } from "@/data/campaigns";

function formatCompactGoal(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (n >= 10_000) return `$${Math.round(n / 1000)}K`;
  return formatCurrency(n);
}

export interface PublicCampaignFundraisingPanelProps {
  raised: number;
  goal: number;
  supportersGoing: number;
  participatingLocationCount: number;
  donationCount?: number;
  showDonate: boolean;
  showLocations: boolean;
  copied: boolean;
  onDonate: () => void;
  onShare: () => void;
  onParticipate: () => void;
  /** Compact layout for mobile inline block */
  compact?: boolean;
}

export function PublicCampaignFundraisingPanel({
  raised,
  goal,
  supportersGoing,
  participatingLocationCount,
  donationCount,
  showDonate,
  showLocations,
  copied,
  onDonate,
  onShare,
  onParticipate,
  compact = false,
}: PublicCampaignFundraisingPanelProps) {
  const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;

  return (
    <div
      className={
        compact
          ? "rounded-2xl border border-border bg-card p-5"
          : "rounded-2xl border border-border bg-card p-6 shadow-sm"
      }
    >
      {goal > 0 && (
        <p className="text-sm font-medium text-muted-foreground">{pct}% complete</p>
      )}
      <p className="mt-1 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        <span className="text-primary">{formatCurrency(raised)}</span>
        {goal > 0 && (
          <span className="text-lg font-semibold text-muted-foreground">
            {" "}
            raised of {formatCompactGoal(goal)} goal
          </span>
        )}
      </p>
      {goal > 0 && (
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        {donationCount != null && donationCount > 0 && (
          <span>
            {donationCount.toLocaleString()} donation{donationCount === 1 ? "" : "s"}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <Users className="size-3.5" />
          {supportersGoing} supporters
        </span>
        {participatingLocationCount > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <Store className="size-3.5" />
            {participatingLocationCount} locations
          </span>
        )}
      </div>

      <div className={`mt-5 flex flex-col gap-2.5 ${compact ? "" : ""}`}>
        {showDonate && (
          <button
            type="button"
            onClick={onDonate}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-md shadow-primary/20 transition-opacity hover:opacity-90"
          >
            <Heart className="size-4" />
            Donate now
          </button>
        )}
        <button
          type="button"
          onClick={onShare}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-background px-5 py-3 text-sm font-semibold transition-colors hover:bg-secondary/60"
        >
          {copied ? <CheckCircle2 className="size-4 text-primary" /> : <Share2 className="size-4" />}
          {copied ? "Link copied" : "Share"}
        </button>
        {showLocations && (
          <button
            type="button"
            onClick={onParticipate}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-background px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-secondary/60"
          >
            <MapPin className="size-4" />
            Where to participate
          </button>
        )}
      </div>
    </div>
  );
}
