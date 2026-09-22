import type { Business } from "@/data/businesses";
import bizRestaurant from "@/assets/biz-restaurant.jpg";
import { assetSrc } from "@/lib/utils";
import type {
  CampaignState,
  LockedBusinessPartner,
  SupportMethods,
} from "@/lib/campaign-context";
import type { NonprofitCampaignInvite } from "@/lib/api";
import type { BuilderCampaignState } from "@/lib/api";
import { apiBusinessId } from "@/lib/builder-submit";
import { toDateOnlyString } from "@/lib/date-only";
import type { BusinessInviteStatus, InvitedBusiness } from "@/lib/campaign-context";

const GIVEBACK_METHOD_TYPES = new Set([
  "dine_and_donate",
  "shop_and_donate",
  "service_giveback",
]);

/** Map API method type to builder support-method toggles. */
export function methodsFromApiType(methodType: string): SupportMethods {
  return {
    giveback: GIVEBACK_METHOD_TYPES.has(methodType),
    donations: methodType === "virtual_donations",
    guestBartending: methodType === "guest_bartending_event",
    ambassador: methodType === "ambassador_fundraising",
  };
}

/** Merge API method list into support-method toggles. */
export function methodsFromApiList(methodTypes: string[]): SupportMethods {
  const methods: SupportMethods = {
    giveback: false,
    donations: false,
    guestBartending: false,
    ambassador: false,
  };
  for (const type of methodTypes) {
    const mapped = methodsFromApiType(type);
    methods.giveback ||= mapped.giveback;
    methods.donations ||= mapped.donations;
    methods.guestBartending ||= mapped.guestBartending;
    methods.ambassador ||= mapped.ambassador;
  }
  return methods;
}

export function lockedPartnerToBusiness(partner: LockedBusinessPartner): Business {
  return {
    id: apiBusinessId(partner.businessId, partner.locationId),
    name:
      partner.locationLabel && !partner.businessName.includes("—")
        ? `${partner.businessName} — ${partner.locationLabel.split(",")[0]}`
        : partner.businessName,
    type: "Business",
    category: "Business",
    location: partner.locationLabel,
    image: assetSrc(bizRestaurant),
    status: "On ForkUp",
    supportMethods: [partner.methodType.replace(/_/g, " ")],
    description: `${partner.businessName} is partnering on this campaign.`,
    campaignTypes: [partner.methodType],
    supportsDineDonate: partner.methodType === "dine_and_donate",
    supportsShopDonate: partner.methodType === "shop_and_donate",
    supportsServiceGiveback: partner.methodType === "service_giveback",
    supportsGuestBartending: partner.methodType === "guest_bartending_event",
    supportsAmbassadorTracking: false,
  };
}

export function partnerFromInvite(invite: NonprofitCampaignInvite): LockedBusinessPartner {
  const locationLabel = [invite.location.name, invite.location.city, invite.location.state]
    .filter(Boolean)
    .join(", ");
  return {
    businessId: invite.business.id,
    locationId: invite.location.id,
    businessName: invite.business.name,
    locationLabel,
    methodType: invite.method.type,
    givebackPercentage: invite.givebackPercentage,
    acceptanceStatus: "accepted",
  };
}

/** Hydrate builder state after a nonprofit accepts a business-initiated invite. */
export function stateFromBusinessInvite(
  invite: NonprofitCampaignInvite,
  campaignSlug: string,
): Partial<CampaignState> {
  const partner = partnerFromInvite(invite);
  const businessId = apiBusinessId(partner.businessId, partner.locationId);
  const methods = methodsFromApiType(invite.method.type);

  return {
    campaignSlug,
    campaignOrigin: "business_invite",
    organizerMode: "guided",
    accountIntent: "nonprofit",
    title: invite.campaign.name,
    description: invite.campaign.story,
    startDate: invite.campaign.startDate ?? "",
    endDate: invite.campaign.endDate ?? "",
    giveback: invite.givebackPercentage,
    methods,
    lockedBusinessPartners: [partner],
    selectedBusinessIds: [businessId],
    businessStatuses: { [businessId]: "accepted" },
  };
}

function mapPartnerAcceptanceStatus(status: string): BusinessInviteStatus {
  if (status === "changes_requested") return "changes-requested";
  if (status === "accepted") return "accepted";
  if (status === "declined") return "declined";
  return "pending";
}

function invitedFromPartner(
  p: BuilderCampaignState["partners"][number],
): InvitedBusiness {
  const locationLabel = [p.locationName, p.city, p.state].filter(Boolean).join(", ");
  return {
    name: p.businessName,
    contactName: p.businessName,
    email: p.businessEmail ?? "",
    type: "Business",
    location: locationLabel,
    note: "",
    status: mapPartnerAcceptanceStatus(p.acceptanceStatus),
    givebackPercent: p.givebackPercentage,
    persisted: true,
  };
}

/** Hydrate builder state when resuming an existing draft from the API. */
export function stateFromBuilderCampaign(data: BuilderCampaignState): Partial<CampaignState> {
  const lockedPartners: LockedBusinessPartner[] = data.partners
    .filter((p) => p.acceptanceStatus === "accepted")
    .map((p) => ({
      businessId: p.businessId,
      locationId: p.locationId,
      businessName: p.businessName,
      locationLabel: [p.locationName, p.city, p.state].filter(Boolean).join(", "),
      methodType: p.methodType,
      givebackPercentage: p.givebackPercentage,
      acceptanceStatus: "accepted" as const,
    }));

  const selectedBusinessIds = data.partners.map((p) =>
    apiBusinessId(p.businessId, p.locationId),
  );
  const businessStatuses: Record<string, "accepted" | "pending"> = {};
  for (const p of data.partners) {
    const id = apiBusinessId(p.businessId, p.locationId);
    businessStatuses[id] = p.acceptanceStatus === "accepted" ? "accepted" : "pending";
  }

  const coverUrl = data.coverImageUrl?.trim();
  const origin = data.origin === "business_invite" ? "business_invite" : "nonprofit";
  const pendingInvites = data.partners
    .filter((p) => ["invited", "pending", "changes_requested"].includes(p.acceptanceStatus))
    .map(invitedFromPartner);

  return {
    campaignSlug: data.slug,
    serverCampaignStatus: data.status ?? null,
    inviteSenderUserId:
      typeof data.inviteSenderUserId === "number" && data.inviteSenderUserId > 0
        ? data.inviteSenderUserId
        : null,
    inviteFromName:
      typeof data.inviteFromName === "string" ? data.inviteFromName.trim() : "",
    campaignOrigin: origin,
    organizerMode: "guided",
    title: data.campaignName,
    description: data.campaignStory,
    startDate: toDateOnlyString(data.startDate),
    endDate: toDateOnlyString(data.endDate),
    goal: data.campaignGoal > 0 ? String(data.campaignGoal) : "",
    giveback: lockedPartners[0]?.givebackPercentage ?? 15,
    methods: methodsFromApiList(data.methods),
    lockedBusinessPartners: lockedPartners,
    selectedBusinessIds,
    businessStatuses,
    invited: pendingInvites,
    cover: coverUrl
      ? { id: `cover-${data.slug}`, url: coverUrl, name: "cover.jpg" }
      : null,
    /** Additive: hydrate featured YouTube from builder API when present. */
    featuredYoutubeUrl:
      typeof data.featuredYoutubeUrl === "string" && data.featuredYoutubeUrl.trim()
        ? data.featuredYoutubeUrl.trim()
        : null,
  };
}

export function hasLockedBusinessPartners(
  state: Pick<CampaignState, "lockedBusinessPartners">,
): boolean {
  return (state.lockedBusinessPartners?.length ?? 0) > 0;
}
