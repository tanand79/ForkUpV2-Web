/**
 * Guest business → signup ownership link (client).
 *
 * Purpose: After optional Create account from Join Us, attach the guest
 * businessProfile to the new user via /api/auth/link-organization.
 *
 * Inputs: businessId, alreadyLinkedIds from auth session.
 * Outputs: businessId linked (or already linked), else null.
 */
import { linkUserOrganization } from "@/lib/api";

export async function ensureGuestBusinessLinked(params: {
  businessId?: number | null;
  alreadyLinkedIds: number[];
}): Promise<number | null> {
  const businessId =
    typeof params.businessId === "number" && Number.isFinite(params.businessId)
      ? params.businessId
      : null;

  if (!businessId || businessId <= 0) return null;

  if (params.alreadyLinkedIds.includes(businessId)) {
    return businessId;
  }

  await linkUserOrganization({
    organizationType: "business",
    organizationId: businessId,
    role: "admin",
  });

  return businessId;
}
