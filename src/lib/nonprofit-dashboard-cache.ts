import type { ManageCampaignSummary, NonprofitPendingInvite } from "@/lib/api";

const dashboardCache = new Map<
  number,
  { campaigns: ManageCampaignSummary[]; invites: NonprofitPendingInvite[]; at: number }
>();

const CACHE_MS = 60_000;

export function readNonprofitDashboardCache(nonprofitId: number) {
  const hit = dashboardCache.get(nonprofitId);
  if (!hit || Date.now() - hit.at > CACHE_MS) return null;
  return hit;
}

export function writeNonprofitDashboardCache(
  nonprofitId: number,
  data: { campaigns: ManageCampaignSummary[]; invites: NonprofitPendingInvite[] },
) {
  dashboardCache.set(nonprofitId, { ...data, at: Date.now() });
}

export function invalidateNonprofitDashboardCache(nonprofitId?: number) {
  if (nonprofitId != null) {
    dashboardCache.delete(nonprofitId);
    return;
  }
  dashboardCache.clear();
}
