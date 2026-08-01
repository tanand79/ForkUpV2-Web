/**
 * Campaign AI guidance panel (Nick V2 Layer 4).
 *
 * Purpose: Surface timing guidance, method mix, invite readiness score, and
 * campaign health nudges. Backend hard rules always win; AI text is optional polish.
 *
 * Inputs: optional campaign slug + builder state via useCampaign.
 * Outputs: UI only (calls /api/campaign-ai/*).
 */
"use client";

import { useState } from "react";
import { Loader2, Sparkles, HeartPulse, Gauge } from "lucide-react";
import { toast } from "sonner";
import { useCampaign, type SupportMethod } from "@/lib/campaign-context";
import {
  fetchCampaignAiHealth,
  postCampaignAiInviteReadiness,
  postCampaignAiMethodMix,
  postCampaignAiTimingGuidance,
  type CampaignAiHealth,
  type CampaignAiInviteReadiness,
  type CampaignAiMethodMix,
  type CampaignAiTimingGuidance,
} from "@/lib/api";

const SUPPORT_TO_API: Record<SupportMethod, string> = {
  giveback: "dine_and_donate",
  donations: "virtual_donations",
  ambassador: "ambassador_fundraising",
  guestBartending: "guest_bartending_event",
};

function selectedApiMethods(methods: Record<SupportMethod, boolean>): string[] {
  return (Object.keys(methods) as SupportMethod[])
    .filter((k) => methods[k])
    .map((k) => SUPPORT_TO_API[k]);
}

type Props = {
  /** When true, show compact builder-facing actions (no health/calendar). */
  compact?: boolean;
};

export function CampaignAiGuidance({ compact = false }: Props) {
  const { state } = useCampaign();
  const slug = state.campaignSlug;
  const [loading, setLoading] = useState<string | null>(null);
  const [timing, setTiming] = useState<CampaignAiTimingGuidance | null>(null);
  const [mix, setMix] = useState<CampaignAiMethodMix | null>(null);
  const [readiness, setReadiness] = useState<CampaignAiInviteReadiness | null>(null);
  const [health, setHealth] = useState<CampaignAiHealth | null>(null);

  const baseBody = () => ({
    slug: slug || undefined,
    methods: selectedApiMethods(state.methods),
    startDate: state.startDate || undefined,
    endDate: state.endDate || undefined,
    eventDate: state.eventDate || undefined,
    campaignName: state.title || undefined,
    hasStory: !!state.description.trim(),
    hasCover: !!state.cover,
    hasNonprofitProfile: !!state.nonprofitProfile,
    invitedBusinessCount:
      state.selectedBusinessIds.length + state.invited.length,
    hasBusinessContacts:
      state.invited.some((b) => b.email?.includes("@")) ||
      state.selectedBusinessIds.length > 0,
    persist: Boolean(slug),
  });

  const run = async (key: string, fn: () => Promise<void>) => {
    setLoading(key);
    try {
      await fn();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI guidance failed");
    } finally {
      setLoading(null);
    }
  };

  return (
    <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold">
            <Sparkles className="size-4 text-primary" />
            ForkUp AI guidance
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Hard timing and invite rules stay enforced. AI explains the situation and suggests next
            steps.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!!loading}
          onClick={() =>
            void run("timing", async () => {
              setTiming(await postCampaignAiTimingGuidance(baseBody()));
            })
          }
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-4 text-xs font-semibold hover:bg-secondary disabled:opacity-60"
        >
          {loading === "timing" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
          Timing guidance
        </button>
        <button
          type="button"
          disabled={!!loading}
          onClick={() =>
            void run("mix", async () => {
              setMix(await postCampaignAiMethodMix(baseBody()));
            })
          }
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-4 text-xs font-semibold hover:bg-secondary disabled:opacity-60"
        >
          {loading === "mix" ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Method mix
        </button>
        <button
          type="button"
          disabled={!!loading}
          onClick={() =>
            void run("ready", async () => {
              setReadiness(await postCampaignAiInviteReadiness(baseBody()));
            })
          }
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-4 text-xs font-semibold hover:bg-secondary disabled:opacity-60"
        >
          {loading === "ready" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Gauge className="size-3.5" />
          )}
          Invite readiness
        </button>
        {!compact && slug && (
          <button
            type="button"
            disabled={!!loading}
            onClick={() =>
              void run("health", async () => {
                setHealth(await fetchCampaignAiHealth(slug));
              })
            }
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-4 text-xs font-semibold hover:bg-secondary disabled:opacity-60"
          >
            {loading === "health" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <HeartPulse className="size-3.5" />
            )}
            Campaign health
          </button>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {timing && (
          <div className="rounded-2xl border border-border bg-background p-4 text-sm">
            <p className="font-semibold">Timing</p>
            <p className="mt-1 text-muted-foreground">{timing.summary}</p>
            {timing.timing.status !== "ok" && timing.timing.message && (
              <p className="mt-2 text-amber-800 dark:text-amber-300">{timing.timing.message}</p>
            )}
            {timing.aiExplanation && (
              <p className="mt-2 text-foreground/90">{timing.aiExplanation}</p>
            )}
          </div>
        )}
        {mix && (
          <div className="rounded-2xl border border-border bg-background p-4 text-sm">
            <p className="font-semibold">Recommended methods</p>
            <p className="mt-1 text-muted-foreground">{mix.summary}</p>
            <p className="mt-2 text-xs font-medium">
              {mix.recommended.join(" · ") || "None"}
            </p>
            {mix.aiExplanation && (
              <p className="mt-2 text-foreground/90">{mix.aiExplanation}</p>
            )}
          </div>
        )}
        {readiness && (
          <div className="rounded-2xl border border-border bg-background p-4 text-sm">
            <p className="font-semibold">
              Invite readiness: {readiness.score} / 100
            </p>
            <p className="mt-1 text-muted-foreground">{readiness.summary}</p>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {readiness.factors.map((f) => (
                <li key={f.label}>
                  {f.label}: {f.points} — {f.note}
                </li>
              ))}
            </ul>
            {readiness.aiExplanation && (
              <p className="mt-2 text-foreground/90">{readiness.aiExplanation}</p>
            )}
          </div>
        )}
        {health && (
          <div className="rounded-2xl border border-border bg-background p-4 text-sm">
            <p className="font-semibold">Campaign health</p>
            <p className="mt-1 text-muted-foreground">{health.summary}</p>
            <ul className="mt-2 space-y-2">
              {health.nudges.map((n, i) => (
                <li
                  key={`${n.severity}-${i}`}
                  className={
                    n.severity === "critical"
                      ? "text-destructive"
                      : n.severity === "warn"
                        ? "text-amber-800 dark:text-amber-300"
                        : "text-muted-foreground"
                  }
                >
                  {n.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
