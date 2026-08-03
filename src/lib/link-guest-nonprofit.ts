/**
 * Guest → signup/login ownership link.
 *
 * Purpose: Attach a guest-created nonprofit (and thus its campaigns) to the
 * newly authenticated user via the existing `/api/auth/link-organization` API.
 *
 * Inputs:
 * - nonprofitId — known from wizard nonprofitProfile when available
 * - campaignSlug — fallback when only the guest campaign slug is known
 * - alreadyLinkedIds — nonprofit memberships already on the auth session
 *
 * Outputs: the nonprofitId that was linked (or already linked), else null.
 */
import { fetchBuilderCampaign, linkUserOrganization } from "@/lib/api";

export async function ensureGuestNonprofitLinked(params: {
  nonprofitId?: number | null;
  campaignSlug?: string | null;
  alreadyLinkedIds: number[];
}): Promise<number | null> {
  let nonprofitId =
    typeof params.nonprofitId === "number" && Number.isFinite(params.nonprofitId)
      ? params.nonprofitId
      : null;

  if (!nonprofitId && params.campaignSlug?.trim()) {
    try {
      const campaign = await fetchBuilderCampaign(params.campaignSlug.trim());
      const fromCampaign = Number(campaign.nonprofitId);
      if (Number.isFinite(fromCampaign) && fromCampaign > 0) {
        nonprofitId = fromCampaign;
      }
    } catch {
      return null;
    }
  }

  if (!nonprofitId) return null;

  if (params.alreadyLinkedIds.includes(nonprofitId)) {
    return nonprofitId;
  }

  await linkUserOrganization({
    organizationType: "nonprofit",
    organizationId: nonprofitId,
    role: "admin",
  });

  return nonprofitId;
}
