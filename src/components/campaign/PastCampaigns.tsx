"use client";

import { ArrowLeft, CheckCircle2, Store, Users } from "lucide-react";
import { pastCampaigns, formatCurrency, type Campaign } from "@/data/campaigns";
import { useCampaign } from "@/lib/campaign-context";

/**
 * Past Campaigns — a standalone public discovery view (not a homepage section).
 * Opened from the Campaigns dropdown → "Past Campaigns". Shows completed
 * campaigns and their final results with a "Back to Home" affordance.
 */

function PastCampaignCard({ campaign, onOpen }: { campaign: Campaign; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="group block w-full overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <img
          src={campaign.image}
          alt={campaign.name}
          loading="lazy"
          width={1024}
          height={768}
          className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
          style={{ filter: "saturate(0.85) contrast(1.02) brightness(0.99)" }}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-foreground/40" />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/80 px-2.5 py-1 text-[11px] font-medium text-foreground/85 ring-1 ring-background/40 backdrop-blur-md">
          <CheckCircle2 className="size-3 text-primary" />
          {campaign.finalStatus ?? "Completed"}
        </span>
        <span className="absolute right-3 top-3 rounded-full bg-foreground/55 px-2.5 py-1 text-xs font-medium text-background ring-1 ring-background/15 backdrop-blur-md">
          {campaign.dateRange}
        </span>
      </div>

      <div className="space-y-3 p-5">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {campaign.nonprofit}
          </p>
          <h3 className="font-display text-xl font-semibold leading-tight tracking-tight text-foreground transition-colors group-hover:text-primary">
            {campaign.name}
          </h3>
        </div>

        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{formatCurrency(campaign.raised)}</span>{" "}
          raised in total
        </p>

        <div className="space-y-1 pt-1 text-xs text-muted-foreground">
          <div className="inline-flex items-center gap-1.5">
            <Users className="size-3.5" />
            <span>
              <span className="font-medium text-foreground/80">{campaign.supporters}</span> supporters took part
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Store className="size-3.5" />
            <span>
              <span className="font-medium text-foreground/80">{campaign.businesses.length}</span> local
              businesses participated
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

export function PastCampaigns() {
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
          <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            Past Campaigns
          </h1>
          <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Completed campaigns and their final results — see what local communities accomplished together.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-12 sm:px-6 md:py-16">
        {pastCampaigns.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
            No past campaigns to show yet. Completed campaigns will appear here.
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {pastCampaigns.map((c) => (
              <PastCampaignCard key={c.slug} campaign={c} onOpen={() => goTo("campaign-directory")} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
