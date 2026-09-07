"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Heart, Loader2, Quote, Sparkles, Store, Users } from "lucide-react";
import { formatCurrency } from "@/data/campaigns";
import { fetchSuccessStoryCampaigns } from "@/lib/api";
import { resolveCampaignImage } from "@/lib/campaign-images";
import { campaignPublicPath } from "@/lib/campaign-paths";
import type { CampaignListItem } from "@/lib/campaign-types";
import { useCampaign } from "@/lib/campaign-context";
import { netAfterPlatformFee } from "@/lib/platform-config";

/**
 * Success Stories — featured campaigns (top_event) from the API.
 * Past featured campaigns first; falls back to live top events.
 */

function SuccessStoryCard({ campaign }: { campaign: CampaignListItem }) {
  const displayRaised = netAfterPlatformFee(campaign.raised);
  const resolvedSrc = resolveCampaignImage(campaign.image);
  const placeholderSrc = resolveCampaignImage(null);
  const summary = `${campaign.nonprofit} ran ${campaign.dateRange} and raised ${formatCurrency(displayRaised)} with community support.`;

  return (
    <Link
      href={campaignPublicPath(campaign.slug)}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-muted">
        <img
          src={resolvedSrc}
          alt={campaign.name}
          loading="lazy"
          width={1024}
          height={576}
          className="h-full w-full object-contain object-center transition-transform duration-500 group-hover:scale-[1.02]"
          onError={(e) => {
            const img = e.currentTarget;
            if (img.src !== placeholderSrc) img.src = placeholderSrc;
          }}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-foreground/40" />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/80 px-2.5 py-1 text-[11px] font-medium text-foreground/85 ring-1 ring-background/40 backdrop-blur-md">
          <Sparkles className="size-3 text-primary" />
          Success Story
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-6">
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

        <p className="inline-flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
          <Quote className="mt-0.5 size-4 shrink-0 text-primary/70" />
          <span>{summary}</span>
        </p>

        <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Heart className="size-3.5 text-primary" />
            <span className="font-semibold text-foreground">{formatCurrency(displayRaised)}</span> raised
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Store className="size-3.5" />
            {campaign.participatingLocationCount} business partners
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-3.5" />
            {campaign.supportersGoing} supporters
          </span>
        </div>
      </div>
    </Link>
  );
}

export function SuccessStories() {
  const { goTo } = useCampaign();
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    void fetchSuccessStoryCampaigns()
      .then(setCampaigns)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load success stories"))
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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" />
            Success Stories
          </span>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            Success Stories
          </h1>
          <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Featured campaigns that show what can happen when nonprofits, local businesses, and supporters rally together.
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
            No success stories yet. Featured completed campaigns will appear here.
          </p>
        )}
        {!loading && !error && campaigns.length > 0 && (
          <div className="grid gap-5 md:grid-cols-2">
            {campaigns.map((c) => (
              <SuccessStoryCard key={c.slug} campaign={c} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
