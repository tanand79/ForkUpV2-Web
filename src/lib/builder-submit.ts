import type { CampaignState, InvitedBusiness, SupportMethod } from "@/lib/campaign-context";
import type { Business } from "@/data/businesses";
import { givebackMethodForBusiness } from "@/lib/method-timing";
import { subtractCalendarDays, toDateOnlyString } from "@/lib/date-only";
import { loadUserSession } from "@/lib/auth-session";

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
  startDate?: string;
  endDate?: string;
  eventDate?: string;
  coverImage: string;
  methods: ApiMethodType[];
  invitations?: {
    businessId: number;
    locationId: number;
    methodType: ApiMethodType;
    givebackPercentage?: number;
    businessEmail?: string;
    messageToBusiness?: string;
    proposedTerms?: string;
  }[];
  newBusinessInvites?: {
    businessName: string;
    businessEmail: string;
    methodType: ApiMethodType;
    messageToBusiness?: string;
    proposedTerms?: string;
  }[];
  termsAccepted: boolean;
  launch: boolean;
  /** When set, update this campaign instead of creating a new one. */
  existingSlug?: string;
  submitForForkupReview?: boolean;
  continueWithoutBusinessMethods?: boolean;
}

export interface CreateCampaignResult {
  slug: string;
  /** Additive: nonprofit owning this campaign (for guest→signup linking). */
  nonprofitId?: number;
  campaignStatus: string;
  campaignName: string;
  message: string;
  businessTimingStatus?: string;
  forkupReviewStatus?: string;
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
  // Guest Bartending always includes Ambassador Sharing (Nick V2 Layer 1).
  if (state.methods.guestBartending) {
    methods.add("ambassador_fundraising");
  }
  return [...methods];
}

/**
 * API method types for the current support-method toggles.
 * Purpose: Shared by create/update campaign and fundraiser invite payloads.
 */
export function campaignMethodsForApi(
  state: Pick<CampaignState, "methods">,
): ApiMethodType[] {
  return selectedMethods(state as CampaignState);
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

/**
 * Method types to invite a catalog business for, given selected campaign methods.
 * Purpose: Never force guest_bartending_event when the business cannot host it
 * (seed restaurants often only support dine_and_donate) — otherwise the server
 * silently skips the invite and the Business dashboard stays empty.
 * Inputs: builder method flags + optional catalog Business capabilities.
 * Outputs: one or more API method types to create partner invite rows for.
 */
function inviteMethodTypesForCatalogBusiness(
  methods: CampaignState["methods"],
  business: Business | undefined,
): ApiMethodType[] {
  const types: ApiMethodType[] = [];

  if (methods.giveback) {
    types.push(business ? givebackMethodForSelection(business) : "dine_and_donate");
  }

  if (methods.guestBartending) {
    if (!business || business.supportsGuestBartending) {
      types.push("guest_bartending_event");
    } else if (!methods.giveback) {
      // Guest bartending only: fall back to a giveback method the business supports.
      if (business.supportsDineDonate) types.push("dine_and_donate");
      else if (business.supportsShopDonate) types.push("shop_and_donate");
      else if (business.supportsServiceGiveback) types.push("service_giveback");
      else types.push("guest_bartending_event");
    }
  }

  if (types.length === 0) {
    types.push("dine_and_donate");
  }

  return [...new Set(types)];
}

/**
 * Method types for a free-form (name/email) business invite.
 * Purpose: Persist separate partner rows when both giveback and guest bartending
 * are selected, instead of only sending guest_bartending_event.
 */
function inviteMethodTypesForNewBusiness(
  methods: CampaignState["methods"],
  invite: CampaignState["invited"][number],
): ApiMethodType[] {
  const types: ApiMethodType[] = [];
  if (methods.giveback) {
    types.push(inferInviteMethodType(invite));
  }
  if (methods.guestBartending) {
    types.push("guest_bartending_event");
  }
  if (types.length === 0) {
    types.push(
      methods.guestBartending ? "guest_bartending_event" : inferInviteMethodType(invite),
    );
  }
  return [...new Set(types)];
}

/**
 * Returns a durable cover URL suitable for DB storage.
 * Prefers `storedUrl` (S3 or /uploads/…); never returns blob:/data: preview URLs.
 */
export function durableCoverImageUrl(state: CampaignState): string {
  const stored = state.cover?.storedUrl?.trim() ?? "";
  if (stored && !stored.startsWith("blob:") && !stored.startsWith("data:")) return stored;
  const url = state.cover?.url?.trim() ?? "";
  if (url && !url.startsWith("blob:") && !url.startsWith("data:")) return url;
  return "";
}

/** Durable URL for a gallery/cover image (never blob:/data:). */
export function durableCampaignImageUrl(img: {
  url?: string;
  storedUrl?: string;
} | null | undefined): string {
  if (!img) return "";
  const stored = img.storedUrl?.trim() ?? "";
  if (stored && !stored.startsWith("blob:") && !stored.startsWith("data:")) return stored;
  const url = img.url?.trim() ?? "";
  if (url && !url.startsWith("blob:") && !url.startsWith("data:")) return url;
  return "";
}

export const MAX_CAMPAIGN_GALLERY_IMAGES = 8;

/**
 * Builds PUT /api/campaign-images/:slug payload from wizard state (max 8).
 * Cover is marked isCover; gallery images from state.images fill the rest.
 */
export function buildCampaignGalleryPayload(state: CampaignState): {
  imageUrl: string;
  source?: string;
  sourceUrl?: string | null;
  isCover?: boolean;
}[] {
  const coverUrl = durableCoverImageUrl(state);
  const out: {
    imageUrl: string;
    source?: string;
    sourceUrl?: string | null;
    isCover?: boolean;
  }[] = [];
  const seen = new Set<string>();

  if (coverUrl) {
    seen.add(coverUrl);
    out.push({
      imageUrl: coverUrl,
      source: state.cover?.source ?? "manual",
      sourceUrl: state.cover?.sourceUrl ?? null,
      isCover: true,
    });
  }

  for (const img of state.images) {
    if (out.length >= MAX_CAMPAIGN_GALLERY_IMAGES) break;
    const url = durableCampaignImageUrl(img);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({
      imageUrl: url,
      source: img.source ?? "manual",
      sourceUrl: img.sourceUrl ?? null,
      isCover: false,
    });
  }

  return out;
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
      for (const methodType of inviteMethodTypesForCatalogBusiness(state.methods, business)) {
        invitations.push({
          businessId: parsed.businessId,
          locationId: parsed.locationId,
          methodType,
          givebackPercentage: state.giveback,
        });
      }
    }

    for (const invite of state.invited) {
      if (invite.persisted) continue;
      for (const methodType of inviteMethodTypesForNewBusiness(state.methods, invite)) {
        newBusinessInvites.push({
          businessName: invite.name,
          businessEmail: invite.email,
          methodType,
          messageToBusiness: invite.note?.trim() || undefined,
          proposedTerms: invite.proposedTerms?.trim() || undefined,
        });
      }
    }
  }

  // Brand-new AI/guest drafts often omit contactEmail; Launch requires @.
  // Prefer profile email, else signed-in account email.
  const sessionEmail = loadUserSession()?.email?.trim() ?? "";
  const contactEmail = nonprofit.contactEmail?.includes("@")
    ? nonprofit.contactEmail
    : sessionEmail.includes("@")
      ? sessionEmail
      : nonprofit.contactEmail;

  return {
    nonprofit: {
      organizationName: nonprofit.organizationName,
      contactName: nonprofit.contactName,
      contactEmail,
      mission: nonprofit.mission,
      causeCategory: nonprofit.causeCategory,
    },
    campaignName: state.title.trim(),
    campaignStory: state.description.trim(),
    campaignGoal: Number.parseInt(state.goal.replace(/\D/g, ""), 10) || 0,
    startDate: state.startDate || undefined,
    endDate: state.endDate || undefined,
    eventDate: state.eventDate || undefined,
    coverImage: durableCoverImageUrl(state),
    methods,
    invitations,
    newBusinessInvites,
    termsAccepted: state.termsAccepted,
    launch: options.launch,
    existingSlug: state.campaignSlug ?? undefined,
    submitForForkupReview: state.submitForForkupReview || undefined,
    continueWithoutBusinessMethods: state.continueWithoutBusinessMethods || undefined,
  };
}

/**
 * Invitation arrays only — for POST append after campaign is live / inviting.
 * Inputs: campaign state + selected catalog businesses + nonprofit profile.
 * Outputs: { invitations, newBusinessInvites } for appendCampaignBusinessInvitations.
 */
export function buildAppendBusinessInvitationsPayload(
  state: CampaignState,
  nonprofit: NonprofitProfileInput,
  selectedBusinesses: Business[],
): Pick<CreateCampaignPayload, "invitations" | "newBusinessInvites"> {
  const full = buildCreateCampaignPayload(state, nonprofit, selectedBusinesses, {
    launch: false,
  });
  return {
    invitations: full.invitations,
    newBusinessInvites: full.newBusinessInvites,
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
    coverImage:
      durableCoverImageUrl(state) ||
      (state.logo?.storedUrl && !state.logo.storedUrl.startsWith("blob:")
        ? state.logo.storedUrl
        : "") ||
      (state.logo?.url && !state.logo.url.startsWith("blob:") ? state.logo.url : "") ||
      DEFAULT_COVER,
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
