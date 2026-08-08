"use client";

/**
 * Divert legacy Lovable builder screens (quick-start / campaign-review) into the AI funnel.
 *
 * Purpose: Deep links and saved drafts that still resolve to old step IDs never render
 * QuickStart or CampaignReview — they soft-navigate into the AI flow instead.
 *
 * Inputs: campaign context (profile, draft fields, aiDrafted).
 * Output: one navigation to an AI step (or startNewCampaign → ideas).
 */

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { useCampaign } from "@/lib/campaign-context";

function DivertSpinner({ label }: { label: string }) {
  return (
    <main className="mx-auto flex min-h-[40vh] max-w-2xl flex-col items-center justify-center px-5 py-10">
      <Loader2 className="size-6 animate-spin text-primary" />
      <p className="mt-3 text-sm text-muted-foreground">{label}</p>
    </main>
  );
}

/**
 * Replace rendered QuickStart: resume into AI build/preview, or start AI analyze → ideas.
 */
export function LegacyQuickStartDivert() {
  const { state, goTo, startNewCampaign } = useCampaign();
  const kicked = useRef(false);

  useEffect(() => {
    if (kicked.current) return;
    kicked.current = true;

    if (!state.nonprofitProfile) {
      goTo("nonprofit-claim");
      return;
    }

    if (state.aiDrafted) {
      goTo("ai-campaign-preview");
      return;
    }

    if (state.title.trim() && state.description.trim() && state.fundsSupport[0]?.trim()) {
      goTo("ai-campaign-preview");
      return;
    }

    if (state.title.trim() || state.description.trim()) {
      goTo("ai-campaign-build");
      return;
    }

    startNewCampaign();
  }, [state, goTo, startNewCampaign]);

  return <DivertSpinner label="Opening AI campaign setup…" />;
}

/**
 * Replace rendered CampaignReview: AI preview is the edit/review surface.
 */
export function LegacyCampaignReviewDivert() {
  const { goTo } = useCampaign();
  const kicked = useRef(false);

  useEffect(() => {
    if (kicked.current) return;
    kicked.current = true;
    goTo("ai-campaign-preview");
  }, [goTo]);

  return <DivertSpinner label="Opening AI campaign preview…" />;
}
