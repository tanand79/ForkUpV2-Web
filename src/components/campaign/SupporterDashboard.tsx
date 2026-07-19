"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Compass, History, Loader2, Receipt } from "lucide-react";
import { useCampaign } from "@/lib/campaign-context";
import { fetchCampaigns, fetchCurrentUser } from "@/lib/api";
import { CampaignDirectoryCard } from "@/components/campaign/CampaignDirectoryCard";
import type { CampaignListItem } from "@/lib/campaign-types";

export function SupporterDashboard() {
  const { goTo } = useCampaign();
  const [accountName, setAccountName] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchCurrentUser()
      .then((user) => setAccountName(user.fullName?.trim() || user.email.split("@")[0]))
      .catch(() => setAccountName(null));
    void fetchCampaigns("live")
      .then((rows) => setCampaigns(rows.slice(0, 3)))
      .catch(() => setCampaigns([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 pb-24 sm:px-6 sm:py-12">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Supporter home</p>
        <h1 className="font-display mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">
          Welcome back{accountName ? `, ${accountName}` : ""}
        </h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Discover live campaigns, participate at local businesses, and support causes in your
          community.
        </p>
      </div>

      <section className="mt-10 grid gap-4 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => goTo("campaign-directory")}
          className="rounded-2xl border border-border bg-card p-6 text-left transition-colors hover:border-primary/40"
        >
          <Compass className="size-6 text-primary" />
          <p className="mt-3 font-semibold">Browse live campaigns</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Find participating businesses, donate online, or plan your visit.
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
            Explore <ArrowRight className="size-4" />
          </span>
        </button>
        <button
          type="button"
          onClick={() => goTo("receipt-upload")}
          className="rounded-2xl border border-border bg-primary/5 p-6 text-left transition-colors hover:border-primary/40"
        >
          <Receipt className="size-6 text-primary" />
          <p className="mt-3 font-semibold">Upload a receipt</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Visited a participating business? Turn your receipt into a donation.
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
            Upload <ArrowRight className="size-4" />
          </span>
        </button>
        <button
          type="button"
          onClick={() => goTo("supporter-receipts")}
          className="rounded-2xl border border-border bg-card p-6 text-left transition-colors hover:border-primary/40"
        >
          <History className="size-6 text-primary" />
          <p className="mt-3 font-semibold">My receipts</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Track the receipts you&rsquo;ve uploaded and their review status.
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
            View <ArrowRight className="size-4" />
          </span>
        </button>
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold">Featured campaigns</h2>
          <button
            type="button"
            onClick={() => goTo("campaign-directory")}
            className="text-sm font-semibold text-primary"
          >
            View all
          </button>
        </div>
        {loading ? (
          <div className="mt-6 flex justify-center">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : campaigns.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No live campaigns right now. Check back soon.
          </p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {campaigns.map((c) => (
              <CampaignDirectoryCard key={c.slug} campaign={c} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
