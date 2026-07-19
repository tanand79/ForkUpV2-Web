"use client";

import { ArrowLeft, ArrowRight, Heart, Quote, Sparkles, Store, Users } from "lucide-react";
import { successStories, formatCurrency, type Campaign } from "@/data/campaigns";
import { useCampaign } from "@/lib/campaign-context";

/**
 * Success Stories — a standalone public, curated proof-of-concept view (not a
 * homepage section). Opened from the Campaigns dropdown → "Success Stories".
 * Reuses selected completed campaign data with community-impact framing.
 */

function SuccessStoryCard({ campaign, onOpen }: { campaign: Campaign; onOpen: () => void }) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      <div className="relative aspect-[16/9] overflow-hidden bg-muted">
        <img
          src={campaign.image}
          alt={campaign.name}
          loading="lazy"
          width={1024}
          height={576}
          className="h-full w-full object-cover object-center"
          style={{ filter: "saturate(0.9) contrast(1.03) brightness(1.01)" }}
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
          </p>
          <h3 className="font-display text-xl font-semibold leading-tight tracking-tight text-foreground">
            {campaign.name}
          </h3>
        </div>

        <p className="inline-flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
          <Quote className="mt-0.5 size-4 shrink-0 text-primary/70" />
          <span>{campaign.story ?? campaign.description}</span>
        </p>

        {campaign.impact && (
          <p className="rounded-xl bg-accent/70 px-3 py-2 text-sm font-medium text-foreground">
            {campaign.impact}
          </p>
        )}

        <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Heart className="size-3.5 text-primary" />
            <span className="font-semibold text-foreground">{formatCurrency(campaign.raised)}</span> raised
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Store className="size-3.5" />
            {campaign.businesses.length} business partners
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-3.5" />
            {campaign.supporters} supporters
          </span>
        </div>

        <div className="mt-auto pt-2">
          <button
            onClick={onOpen}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-all hover:bg-primary-dark hover:-translate-y-0.5 active:scale-95"
          >
            View Story
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    </article>
  );
}

export function SuccessStories() {
  const { goTo } = useCampaign();

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
        <div className="grid gap-5 md:grid-cols-2">
          {successStories.map((c) => (
            <SuccessStoryCard key={c.slug} campaign={c} onOpen={() => goTo("campaign-directory")} />
          ))}
        </div>
      </section>
    </main>
  );
}
