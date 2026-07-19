import type { CampaignState, InvitedBusiness, SupportMethod } from "@/lib/campaign-context";
import type { Business } from "@/data/businesses";
import { givebackMethodForBusiness } from "@/lib/method-timing";
import { subtractCalendarDays, toDateOnlyString } from "@/lib/date-only";

export type ApiMethodType =
  | "dine_and_donate"
  | "shop_and_donate"
  | "service_giveback"
  | "virtual_donations"
  | "ambassador_fundraising"
  | "guest_bartending_event";

const SUPPORT_TO_API: Record<SupportMethod, ApiMethodType> = {
  giveback: "dine_and_donate",
  donations: "virtual_donations",
  ambassador: "ambassador_fundraising",
  guestBartending: "guest_bartending_event",
};

export interface NonprofitProfileInput {
  id?: number;
  organizationName: string;
  contactName: string;
  contactEmail: string;
  mission?: string;
  causeCategory?: string;
}

export interface CreateCampaignPayload {
  nonprofit: {
    organizationName: string;
    contactName: string;
    contactEmail: string;
    mission?: string;
    causeCategory?: string;
  };
  campaignName: string;
  campaignStory: string;
  campaignGoal: number;
  startDate: string;
  endDate: string;
  coverImage: string;
  methods: ApiMethodType[];
  invitations?: {
    businessId: number;
    locationId: number;
    methodType: ApiMethodType;
    givebackPercentage?: number;
  }[];
  newBusinessInvites?: {
    businessName: string;
    businessEmail: string;
    methodType: ApiMethodType;
  }[];
  termsAccepted: boolean;
  launch: boolean;
  /** When set, update this campaign instead of creating a new one. */
  existingSlug?: string;
}

export interface CreateCampaignResult {
  slug: string;
  campaignStatus: string;
  campaignName: string;
  message: string;
  invitationLinks?: {
    businessName: string;
    locationName: string;
    token: string;
    acceptanceStatus: string;
    acceptPath: string;
  }[];
}

/** Parse API-backed business selection id: `api-{businessId}-{locationId}` */
export function parseApiBusinessId(id: string): { businessId: number; locationId: number } | null {
  const match = /^api-(\d+)-(\d+)$/.exec(id);
  if (!match) return null;
  return { businessId: Number(match[1]), locationId: Number(match[2]) };
}

export function apiBusinessId(businessId: number, locationId: number): string {
  return `api-${businessId}-${locationId}`;
}

function selectedMethods(state: CampaignState): ApiMethodType[] {
  const methods = new Set<ApiMethodType>();
  (Object.keys(state.methods) as SupportMethod[]).forEach((key) => {
    if (state.methods[key]) methods.add(SUPPORT_TO_API[key]);
  });
  return [...methods];
}

function givebackMethodForSelection(business: Business): ApiMethodType {
  const uiType = givebackMethodForBusiness(business);
  const map: Record<string, ApiMethodType> = {
    dineDonate: "dine_and_donate",
    shopDonate: "shop_and_donate",
    serviceGiveback: "service_giveback",
  };
  return map[uiType] ?? "dine_and_donate";
}

export function buildCreateCampaignPayload(
  state: CampaignState,
  nonprofit: NonprofitProfileInput,
  selectedBusinesses: Business[],
  options: { launch: boolean },
): CreateCampaignPayload {
  const methods = selectedMethods(state);
  const invitations: CreateCampaignPayload["invitations"] = [];
  const newBusinessInvites: CreateCampaignPayload["newBusinessInvites"] = [];
  const lockedKeys = new Set(
    (state.lockedBusinessPartners ?? []).map((p) => `${p.businessId}:${p.locationId}`),
  );

  if (state.methods.giveback || state.methods.guestBartending) {
    for (const partner of state.lockedBusinessPartners ?? []) {
      let locationId = partner.locationId;
      if (!locationId) {
        const parsed = state.selectedBusinessIds
          .map((id) => parseApiBusinessId(id))
          .find((p) => p?.businessId === partner.businessId);
        locationId = parsed?.locationId ?? 0;
      }
      if (!partner.businessId || !locationId) continue;

      invitations.push({
        businessId: partner.businessId,
        locationId,
        methodType: partner.methodType as ApiMethodType,
        givebackPercentage: partner.givebackPercentage,
      });
    }

    for (const id of state.selectedBusinessIds) {
      const parsed = parseApiBusinessId(id);
      if (!parsed) continue;
      if (lockedKeys.has(`${parsed.businessId}:${parsed.locationId}`)) continue;

      const business = selectedBusinesses.find((b) => b.id === id);
      const methodType = state.methods.guestBartending
        ? "guest_bartending_event"
        : business
          ? givebackMethodForSelection(business)
          : "dine_and_donate";

      invitations.push({
        businessId: parsed.businessId,
        locationId: parsed.locationId,
        methodType,
        givebackPercentage: state.giveback,
      });
    }

    for (const invite of state.invited) {
      if (invite.persisted) continue;
      newBusinessInvites.push({
        businessName: invite.name,
        businessEmail: invite.email,
        methodType: state.methods.guestBartending
          ? "guest_bartending_event"
          : inferInviteMethodType(invite),
      });
    }
  }

  return {
    nonprofit: {
      organizationName: nonprofit.organizationName,
      contactName: nonprofit.contactName,
      contactEmail: nonprofit.contactEmail,
      mission: nonprofit.mission,
      causeCategory: nonprofit.causeCategory,
    },
    campaignName: state.title.trim(),
    campaignStory: state.description.trim(),
    campaignGoal: Number.parseInt(state.goal.replace(/\D/g, ""), 10) || 0,
    startDate: state.startDate,
    endDate: state.endDate,
    coverImage: state.cover?.storedUrl ?? state.cover?.url ?? "",
    methods,
    invitations,
    newBusinessInvites,
    termsAccepted: state.termsAccepted,
    launch: options.launch,
    existingSlug: state.campaignSlug ?? undefined,
  };
}

const DEFAULT_COVER = "/placeholder-cover.jpg";

function defaultCampaignDates(): { startDate: string; endDate: string } {
  const start = new Date();
  const end = new Date(start);
  end.setDate(end.getDate() + 30);
  return {
    startDate: toDateOnlyString(start),
    endDate: toDateOnlyString(end),
  };
}

/** Whether enough builder state exists to persist a draft row in the API. */
export function canSaveDraftToServer(state: CampaignState): boolean {
  return selectedMethods(state).length > 0;
}

/**
 * Build a draft payload for Save & Exit — fills required API fields with safe defaults
 * so progress is stored in the database (single source of truth), not localStorage.
 */
export function buildDraftSavePayload(
  state: CampaignState,
  nonprofit: NonprofitProfileInput,
  selectedBusinesses: Business[],
): CreateCampaignPayload | null {
  if (!canSaveDraftToServer(state)) return null;

  const defaults = defaultCampaignDates();
  const base = buildCreateCampaignPayload(state, nonprofit, selectedBusinesses, { launch: false });

  return {
    ...base,
    campaignName: state.title.trim() || `Support ${nonprofit.organizationName}`,
    campaignStory: state.description.trim() || "Campaign details in progress.",
    startDate: state.startDate || defaults.startDate,
    endDate: state.endDate || defaults.endDate,
    coverImage: state.cover?.storedUrl || state.cover?.url || state.logo?.storedUrl || state.logo?.url || DEFAULT_COVER,
    termsAccepted: false,
    launch: false,
    existingSlug: state.campaignSlug ?? undefined,
  };
}

function inferInviteMethodType(invite: InvitedBusiness): ApiMethodType {
  const caps = invite.capabilities;
  if (!caps) return "dine_and_donate";
  if (caps.supportsShopDonate) return "shop_and_donate";
  if (caps.supportsServiceGiveback) return "service_giveback";
  return "dine_and_donate";
}
