"use client";

/**
 * Wizard step `campaign-page` entry point.
 *
 * Purpose: any in-app navigation to `?step=campaign-page` should open the live
 * public campaign route (`/campaign/{slug}/` → PublicCampaignView) when a slug
 * is known, instead of the legacy one-view CampaignPage layout.
 *
 * Inputs: campaign context `state.campaignSlug`.
 * Outputs: browser redirect to `campaignPublicPath(slug)`, or falls back to
 * the design-mode CampaignPage when no slug is available yet.
 */

import { useEffect } from "react";
import { useCampaign } from "@/lib/campaign-context";
import { campaignPublicPath } from "@/lib/campaign-paths";
import { CampaignPage } from "@/components/campaign/CampaignPage";

export function PublicCampaignStepGate() {
  const { state } = useCampaign();
  const slug = state.campaignSlug?.trim() ?? "";

  useEffect(() => {
    if (!slug) return;
    window.location.assign(campaignPublicPath(slug));
  }, [slug]);

  if (slug) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-5 py-16 text-sm text-muted-foreground">
        Opening public campaign page…
      </div>
    );
  }

  return <CampaignPage />;
}
