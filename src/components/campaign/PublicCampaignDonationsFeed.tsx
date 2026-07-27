"use client";

/**
 * GoFundMe-style recent donations list for public campaign pages.
 *
 * Inputs: campaign slug (fetches donations), optional refresh key after donate
 * Outputs: scrollable donation feed with donor initials and amounts
 */

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { formatCurrency } from "@/data/campaigns";
import { fetchCampaignDonations } from "@/lib/api";
import type { CampaignDonationsResponse } from "@/lib/campaign-types";

function donorInitials(name: string): string {
  if (name === "Anonymous") return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));
  if (diffSec < 60) return "Just now";
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function toneFromName(name: string): { bg: string; fg: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const tones = [
    { bg: "#E8DFD4", fg: "#5C4A3A" },
    { bg: "#D9E5DC", fg: "#3D5A45" },
    { bg: "#E5D9E8", fg: "#5A3D5C" },
    { bg: "#D9E0E8", fg: "#3D4A5A" },
  ];
  return tones[Math.abs(hash) % tones.length]!;
}

export function PublicCampaignDonationsFeed({
  slug,
  refreshKey = 0,
  data: preloaded,
}: {
  slug: string;
  refreshKey?: number;
  data?: CampaignDonationsResponse;
}) {
  const { data: fetched, isPending, isError } = useQuery({
    queryKey: ["campaign-donations", slug, refreshKey],
    queryFn: () => fetchCampaignDonations(slug),
    staleTime: 30_000,
    enabled: !preloaded,
  });

  const data = preloaded ?? fetched;
  const loading = !preloaded && isPending;

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !data || data.donations.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        Be the first to donate and show your support.
      </p>
    );
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-xl font-bold">Donations</h2>
        <span className="text-sm text-muted-foreground">
          {data.totalCount.toLocaleString()} total
        </span>
      </div>
      <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-card">
        {data.donations.map((d, i) => {
          const tone = toneFromName(d.donorName);
          return (
            <li key={`${d.createdAt}-${i}`} className="flex items-center gap-3 px-4 py-3.5">
              <div
                className="flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                style={{ backgroundColor: tone.bg, color: tone.fg }}
                aria-hidden
              >
                {donorInitials(d.donorName)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{d.donorName}</p>
                <p className="text-xs text-muted-foreground">{relativeTime(d.createdAt)}</p>
              </div>
              <p className="shrink-0 text-sm font-bold text-primary">{formatCurrency(d.amount)}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
