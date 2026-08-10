"use client";

/**
 * Public campaign Top Fundraisers + Top Donors section.
 *
 * Purpose: Ranked leaderboards for the public campaign page (after story).
 * Inputs: campaign slug, optional refreshKey (e.g. after a donation)
 * Outputs: Two-column lists with inline "View all" expand
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { formatCurrency } from "@/data/campaigns";
import { fetchCampaignLeaderboard } from "@/lib/api";

const PREVIEW_LIMIT = 5;
const EXPANDED_LIMIT = 50;

function initials(name: string): string {
  if (name.toLowerCase() === "anonymous") return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "•";
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function Avatar({ name, tone }: { name: string; tone: "primary" | "muted" }) {
  const classes =
    tone === "primary"
      ? "bg-primary/10 text-primary"
      : "bg-secondary text-muted-foreground";
  return (
    <div
      className={`flex size-10 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${classes}`}
      aria-hidden
    >
      {initials(name)}
    </div>
  );
}

function EmptyList({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
      {message}
    </p>
  );
}

function ViewAllButton({
  expanded,
  canExpand,
  onToggle,
}: {
  expanded: boolean;
  canExpand: boolean;
  onToggle: () => void;
}) {
  if (!canExpand && !expanded) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      className="mt-2 inline-flex rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
    >
      {expanded ? "Show less" : "View all"}
    </button>
  );
}

export function PublicCampaignLeaderboard({
  slug,
  refreshKey = 0,
}: {
  slug: string;
  refreshKey?: number;
}) {
  const [fundraisersExpanded, setFundraisersExpanded] = useState(false);
  const [donorsExpanded, setDonorsExpanded] = useState(false);

  const fundraisersLimit = fundraisersExpanded ? EXPANDED_LIMIT : PREVIEW_LIMIT;
  const donorsLimit = donorsExpanded ? EXPANDED_LIMIT : PREVIEW_LIMIT;

  const { data, isPending, isError } = useQuery({
    queryKey: [
      "campaign-leaderboard",
      slug,
      refreshKey,
      fundraisersLimit,
      donorsLimit,
    ],
    queryFn: () =>
      fetchCampaignLeaderboard(slug, { fundraisersLimit, donorsLimit }),
    staleTime: 30_000,
  });

  if (isPending && !data) {
    return (
      <section className="mt-10">
        <div className="flex justify-center py-8">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </section>
    );
  }

  if (isError || !data) {
    return null;
  }

  const canExpandFundraisers = data.fundraisersTotalCount > PREVIEW_LIMIT;
  const canExpandDonors = data.donorsTotalCount > PREVIEW_LIMIT;

  return (
    <section className="mt-10" aria-label="Campaign leaderboards">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-10">
        <div>
          <h2 className="text-xl font-bold text-foreground">Top Fundraisers</h2>
          <ViewAllButton
            expanded={fundraisersExpanded}
            canExpand={canExpandFundraisers}
            onToggle={() => setFundraisersExpanded((v) => !v)}
          />
          {data.fundraisers.length === 0 ? (
            <div className="mt-4">
              <EmptyList message="Ambassador fundraising will appear here once supporters join." />
            </div>
          ) : (
            <ol className="mt-4 divide-y divide-border rounded-xl border border-border bg-card">
              {data.fundraisers.map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  className="flex items-center gap-3 px-4 py-3.5"
                >
                  <Avatar name={f.name} tone="primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{f.name}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      <span className="font-semibold text-foreground">
                        {formatCurrency(f.raised)}
                      </span>{" "}
                      raised
                      {f.donationCount > 0
                        ? ` · ${f.donationCount} donation${f.donationCount === 1 ? "" : "s"}`
                        : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div>
          <h2 className="text-xl font-bold text-foreground">Top Donors</h2>
          <ViewAllButton
            expanded={donorsExpanded}
            canExpand={canExpandDonors}
            onToggle={() => setDonorsExpanded((v) => !v)}
          />
          {data.donors.length === 0 ? (
            <div className="mt-4">
              <EmptyList message="Be the first to donate and show your support." />
            </div>
          ) : (
            <ol className="mt-4 divide-y divide-border rounded-xl border border-border bg-card">
              {data.donors.map((d, i) => (
                <li
                  key={`${d.donorName}-${i}`}
                  className="flex items-center gap-3 px-4 py-3.5"
                >
                  <Avatar name={d.donorName} tone="muted" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{d.donorName}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {d.donationCount} donation{d.donationCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-bold text-primary">
                    {formatCurrency(d.totalAmount)}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}
