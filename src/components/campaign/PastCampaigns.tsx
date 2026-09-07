"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2, Store, Users } from "lucide-react";
import { formatCurrency } from "@/data/campaigns";
import { fetchPastCampaigns } from "@/lib/api";
import { resolveCampaignImage } from "@/lib/campaign-images";
import { campaignPublicPath } from "@/lib/campaign-paths";
import type { CampaignListItem, CampaignStatus } from "@/lib/campaign-types";
import { useCampaign } from "@/lib/campaign-context";
import { netAfterPlatformFee } from "@/lib/platform-config";

/**
 * Past Campaigns — public discovery view for ended campaigns.
 * Data from GET /api/campaigns?status=past (closed, settlement, or past end date).
 */

function pastStatusLabel(status: CampaignStatus): string {
  if (status === "settlement") return "Settled";
  return "Completed";
}

function PastCampaignCard({ campaign }: { campaign: CampaignListItem }) {
  const displayRaised = netAfterPlatformFee(campaign.raised);
  const resolvedSrc = resolveCampaignImage(campaign.image);
  const placeholderSrc = resolveCampaignImage(null);

  return (
    <Link
      href={campaignPublicPath(campaign.slug)}
      className="group block w-full overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <img
          src={resolvedSrc}
          alt={campaign.name}
          loading="lazy"
          width={1024}
          height={768}
          className="h-full w-full object-contain object-center transition-transform duration-500 group-hover:scale-[1.02]"
          style={{ filter: "saturate(0.85) contrast(1.02) brightness(0.99)" }}
          onError={(e) => {
            const img = e.currentTarget;
            if (img.src !== placeholderSrc) img.src = placeholderSrc;
          }}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-foreground/40" />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/80 px-2.5 py-1 text-[11px] font-medium text-foreground/85 ring-1 ring-background/40 backdrop-blur-md">
          <CheckCircle2 className="size-3 text-primary" />
          {pastStatusLabel(campaign.campaignStatus)}
        </span>
        <span className="absolute right-3 top-3 rounded-full bg-foreground/55 px-2.5 py-1 text-xs font-medium text-background ring-1 ring-background/15 backdrop-blur-md">
          {campaign.dateRange}
        </span>
      </div>

      <div className="space-y-3 p-5">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {campaign.nonprofit}
            {campaign.nonprofitVerified && (
              <span className="ml-1.5 text-primary">· Verified</span>
            )}
          </p>
          <h3 className="font-display text-xl font-semibold leading-tight tracking-tight text-foreground transition-colors group-hover:text-primary">
            {campaign.name}
          </h3>
        </div>

        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{formatCurrency(displayRaised)}</span>{" "}
          raised in total
        </p>

        <div className="space-y-1 pt-1 text-xs text-muted-foreground">
          <div className="inline-flex items-center gap-1.5">
            <Users className="size-3.5" />
            <span>
              <span className="font-medium text-foreground/80">{campaign.supportersGoing}</span>{" "}
              supporters took part
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Store className="size-3.5" />
            <span>
              <span className="font-medium text-foreground/80">
                {campaign.participatingLocationCount}
              </span>{" "}
              local {campaign.participatingLocationCount === 1 ? "business" : "businesses"} participated
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function PastCampaigns() {
  const { goTo } = useCampaign();
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    void fetchPastCampaigns()
      .then(setCampaigns)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load past campaigns"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-background">
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:px-6 md:py-16">
          <button
            onClick={() => goTo("website-landing")}
            className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to Home
          </button>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            Past Campaigns
          </h1>
          <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Completed campaigns and their final results — see what local communities accomplished together.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-12 sm:px-6 md:py-16">
        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        )}
        {error && (
          <p className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-destructive">
            {error}
          </p>
        )}
        {!loading && !error && campaigns.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
            No past campaigns to show yet. Completed campaigns will appear here after they end.
          </p>
        )}
        {!loading && !error && campaigns.length > 0 && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((c) => (
              <PastCampaignCard key={c.slug} campaign={c} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
