import type { ManageCampaignSummary } from "@/lib/api";

export type CampaignTab = "active" | "drafts" | "completed";

export type DashboardDraftItem = { kind: "server"; campaign: ManageCampaignSummary };

export function tabForStatus(status: string): CampaignTab {
  if (status === "live" || status === "invitation_phase" || status === "ready_to_launch") {
    return "active";
  }
  if (status === "closed" || status === "settlement") return "completed";
  return "drafts";
}

export function groupCampaigns(campaigns: ManageCampaignSummary[]) {
  const active: ManageCampaignSummary[] = [];
  const drafts: ManageCampaignSummary[] = [];
  const completed: ManageCampaignSummary[] = [];
  for (const c of campaigns) {
    const bucket = tabForStatus(c.status);
    if (bucket === "active") active.push(c);
    else if (bucket === "completed") completed.push(c);
    else drafts.push(c);
  }
  return { active, drafts, completed };
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
  };
}
