"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { fetchCampaigns } from "@/lib/api";
import { stashAccountIntent } from "@/lib/campaign-auth";
import { useCampaign } from "@/lib/campaign-context";
import type { CampaignListItem } from "@/lib/campaign-types";
import { CampaignDirectoryCard } from "./CampaignDirectoryCard";

export function CampaignDirectory() {
  const { goTo } = useCampaign();
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchCampaigns()
      .then(setCampaigns)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load campaigns"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-background">
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:px-6 md:py-16">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            Live Campaigns
          </h1>
          <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Browse active campaigns where local causes and businesses are working together.
            Choose one to learn the cause, find a participating business, and make an impact.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-12 sm:px-6 md:py-16">
        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        )}
        {error && <p className="text-center text-sm text-destructive">{error}</p>}
        {!loading && !error && campaigns.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
            No live campaigns right now. Check back soon or{" "}
            <button
              type="button"
              onClick={() => {
                stashAccountIntent("nonprofit");
                goTo("nonprofit-claim");
              }}
              className="font-semibold text-primary"
            >
              start a campaign
            </button>
            .
          </p>
        )}
        <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {campaigns.map((c) => (
            <CampaignDirectoryCard key={c.slug} campaign={c} />
          ))}
        </div>
      </section>
    </main>
  );
}
