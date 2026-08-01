import type { ManageCampaignSummary } from "@/lib/api";

export type CampaignTab = "active" | "in_review" | "drafts" | "completed";

export type DashboardDraftItem = { kind: "server"; campaign: ManageCampaignSummary };

/**
 * Maps a campaign_status value to the nonprofit dashboard tab.
 * Inputs: status string from manage API. Outputs: CampaignTab.
 */
export function tabForStatus(status: string): CampaignTab {
  if (status === "in_review") return "in_review";
  if (status === "live" || status === "invitation_phase" || status === "ready_to_launch") {
    return "active";
  }
  if (status === "closed" || status === "settlement") return "completed";
  return "drafts";
}

/**
 * Buckets manage campaigns into Active / In Review / Drafts / Completed.
 */
export function groupCampaigns(campaigns: ManageCampaignSummary[]) {
  const active: ManageCampaignSummary[] = [];
  const in_review: ManageCampaignSummary[] = [];
  const drafts: ManageCampaignSummary[] = [];
  const completed: ManageCampaignSummary[] = [];
  for (const c of campaigns) {
    const bucket = tabForStatus(c.status);
    if (bucket === "active") active.push(c);
    else if (bucket === "in_review") in_review.push(c);
    else if (bucket === "completed") completed.push(c);
    else drafts.push(c);
  }
  return { active, in_review, drafts, completed };
}

/** Dashboard draft list — API campaigns only (same source as manage endpoint). */
export function resolveDashboardDrafts(campaigns: ManageCampaignSummary[]) {
  const grouped = groupCampaigns(campaigns);
  const draftItems: DashboardDraftItem[] = grouped.drafts.map((campaign) => ({
    kind: "server",
    campaign,
  }));

  return {
    grouped,
    draftItems,
    draftCount: draftItems.length,
    inReviewCount: grouped.in_review.length,
  };
}
