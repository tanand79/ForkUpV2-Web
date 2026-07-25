import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  dashboardStepForAccount,
  isCampaignAuthenticated,
  stashAuthReturnStep,
  stashDashboardReturn,
  stepRequiresAuth,
  type AccountIntent,
} from "@/lib/campaign-auth";
import {
  inviteReviewFromSearch,
  locationUrl,
  pathForStep,
  pathForStepWithParams,
  stepFromLocation,
  stepToPath,
  type StepQueryParams,
} from "@/lib/campaign-routes";
import { syncAuthSession, sessionMatchesState, buildSessionPatch, loadUserSession, persistUserSession } from "@/lib/auth-session";
import type { UserRole } from "@/lib/user-roles";
import { dashboardStepForRole } from "@/lib/user-roles";
import { getAuthToken } from "@/lib/auth-storage";
import { storyRequirementMet } from "@/lib/story-validation";
import { assetSrc } from "@/lib/utils";
import { type Business } from "@/data/businesses";
import {
  hasLockedBusinessPartners,
  lockedPartnerToBusiness,
  stateFromBuilderCampaign,
} from "@/lib/campaign-flow";
import { createCampaign, fetchBuilderCampaign, fetchManageCampaigns, updateCampaign } from "@/lib/api";
import { buildDraftSavePayload, canSaveDraftToServer } from "@/lib/builder-submit";
import { subtractCalendarDays, toDateOnlyString } from "@/lib/date-only";
import { invalidateNonprofitDashboardCache } from "@/lib/nonprofit-dashboard-cache";

function businessesFromCatalog(s: CampaignState): Business[] {
  return s.businessCatalog ?? [];
}

function computeSelectedBusinesses(s: CampaignState): Business[] {
  const locked = (s.lockedBusinessPartners ?? []).map(lockedPartnerToBusiness);
  const lockedIds = new Set(locked.map((b) => b.id));
  const catalog = businessesFromCatalog(s);
  const fromCatalog = catalog.filter(
    (b) => s.selectedBusinessIds.includes(b.id) && !lockedIds.has(b.id),
  );
  const lockedSelected = locked.filter((b) => s.selectedBusinessIds.includes(b.id));
  return [...lockedSelected, ...fromCatalog];
}

const DRAFT_KEY = "forkup-campaign-draft";

const BUILDER_FLOW_STEPS: StepId[] = [
  "quick-start",
  "campaign-review",
  "methods",
  "details",
  "media",
  "review",
  "businesses",
  "invite",
];

function isBuilderFlowStep(step: StepId): boolean {
  return BUILDER_FLOW_STEPS.includes(step);
}

/**
 * Lovable campaign-creation order:
 *   Build (quick-start) → Review (campaign-review) → Partners (optional) → Launch (review).
 * Legacy methods/details/media screens remain in the codebase for Design Mode
 * deep-links only — they are not part of this flow.
 */
export function builderFlowForState(
  state: Pick<CampaignState, "methods" | "campaignOrigin" | "lockedBusinessPartners">,
): StepId[] {
  const steps: StepId[] = ["quick-start", "campaign-review"];
  const partnerLocked = hasLockedBusinessPartners(state);
  const needsBusinessStep =
    (state.methods.giveback || state.methods.guestBartending) && !partnerLocked;
  if (needsBusinessStep) steps.push("businesses");
  steps.push("review");
  return steps;
}

function persistDraft(state: CampaignState, lastStep: StepId): boolean {
  if (typeof window === "undefined" || !isBuilderFlowStep(lastStep)) return false;
  const draft: CampaignDraft = {
    state,
    lastStep,
    status: "draft",
  };
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

/** Where a returning user lands — prefer their last visited builder step when still valid. */
function resolveResumeStep(state: CampaignState, lastStep: StepId): StepId {
  const flow = builderFlowForState(state);
  if (!BUILDER_FLOW_STEPS.includes(lastStep)) {
    return firstIncompleteStep(state);
  }
  if (lastStep === "invite") return "invite";
  if (flow.includes(lastStep)) return lastStep;
  return firstIncompleteStep(state);
}

// ⚠️ DESIGN MODE — TEMPORARY. Do NOT ship/enable in production.
// Design Mode lets us jump between builder steps and bypass field validation
// while designing the screens. Production behavior (required fields, story
// minimums, valid dates, required media, at least one support method) is
// preserved whenever Design Mode is OFF. Remove this whole mechanism before
// going live.

interface CampaignDraft {
  state: CampaignState;
  lastStep: StepId;
  status: "draft";
}

function loadDraft(): CampaignDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;

    const draft = JSON.parse(raw) as Partial<CampaignDraft>;
    if (!draft?.state || draft.status !== "draft") {
      window.localStorage.removeItem(DRAFT_KEY);
      return null;
    }

    const resumeSteps: StepId[] = [
      "quick-start",
      "campaign-review",
      "methods",
      "details",
      "media",
      "review",
      "businesses",
      "invite",
    ];
    let lastStep = resumeSteps.includes(draft.lastStep as StepId)
      ? (draft.lastStep as StepId)
      : "quick-start";
    // Legacy builder steps → Lovable resume targets.
    if (lastStep === "methods") lastStep = "quick-start";
    if (lastStep === "details" || lastStep === "media") lastStep = "campaign-review";
    const savedState = draft.state as Partial<CampaignState>;

    return {
      status: "draft",
      lastStep,
      state: {
        ...initialState,
        ...savedState,
        methods: { ...initialState.methods, ...savedState.methods },
        methodTiming: savedState.methodTiming ?? {},
        fundsSupport: Array.isArray(savedState.fundsSupport) ? savedState.fundsSupport : [],
        selectedBusinessIds: Array.isArray(savedState.selectedBusinessIds) ? savedState.selectedBusinessIds : [],
        businessCatalog: Array.isArray(savedState.businessCatalog) ? savedState.businessCatalog : [],
        businessStatuses: savedState.businessStatuses ?? {},
        invited: Array.isArray(savedState.invited)
          ? savedState.invited.map((b) => ({ ...b, status: b.status ?? "pending" }))
          : [],
        ambassadors: Array.isArray(savedState.ambassadors) ? savedState.ambassadors : [],
        guestBartenders: Array.isArray(savedState.guestBartenders) ? savedState.guestBartenders : [],
        tasks: Array.isArray(savedState.tasks) ? savedState.tasks : [],
        activityLog: Array.isArray(savedState.activityLog) ? savedState.activityLog : [],
        logo: savedState.logo ?? null,
        cover: savedState.cover ?? null,
        images: Array.isArray(savedState.images) ? savedState.images : [],
        video: savedState.video ?? null,
        promotion: { ...initialState.promotion, ...savedState.promotion },
        storyAccepted: !!savedState.storyAccepted,
        aiDrafted: !!savedState.aiDrafted,
        organizerMode: savedState.organizerMode ?? null,
        accountIntent: savedState.accountIntent ?? null,
        nonprofitMemberships: Array.isArray(savedState.nonprofitMemberships)
          ? savedState.nonprofitMemberships
          : savedState.nonprofitProfile
            ? [savedState.nonprofitProfile]
            : [],
        businessMemberships: Array.isArray(savedState.businessMemberships)
          ? savedState.businessMemberships
          : savedState.businessProfile
            ? [savedState.businessProfile]
            : [],
        campaignOrigin: savedState.campaignOrigin ?? "nonprofit",
        lockedBusinessPartners: Array.isArray(savedState.lockedBusinessPartners)
          ? savedState.lockedBusinessPartners
          : [],
        // Always require the organizer to re-confirm launch terms on return.
        termsAccepted: false,
      },
    };
  } catch {
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore storage errors */
    }
    return null;
  }
}

export type StepId =
  | "start"
  // ⚠️ DESIGN MODE placeholders — pre-campaign entry / claim lifecycle.
  | "website-landing"
  | "campaign-directory"
  | "past-campaigns"
  | "success-stories"
  | "choose-account-type"
  | "nonprofit-claim"
  | "business-claim"
  | "business-invites-nonprofit"
  | "nonprofit-accepts-invite"
  | "nonprofit-dashboard"
  | "business-dashboard"
  | "supporter-dashboard"
  | "auth-login"
  | "account-hub"
  | "choose-organizer-mode"
  // GoFundMe-style first questions (who / region / purpose) before Find Org.
  | "create-fundraiser"
  // Simplified GoFundMe-style entry — asks a few questions, AI prepares a draft.
  | "quick-start"
  // Lovable Review Your Campaign (after Prepare My Draft) — not the old details/media tabs.
  | "campaign-review"
  | "methods"
  | "businesses"
  | "invite"
  | "edit-invite"
  // ⚠️ DESIGN MODE ONLY — mocked nonprofit→business invite & acceptance flow.
  | "business-invite-flow"
  | "details"
  | "media"
  | "review"
  | "created"
  | "dashboard"
  // ⚠️ DESIGN MODE reference — existing MVP receipt capture / OCR flow.
  | "receipt-ocr"
  // Supporter-facing receipt upload (submits to the OCR/review pipeline).
  | "receipt-upload"
  // Supporter-facing receipt history (auth-scoped).
  | "supporter-receipts"
  // ⚠️ DESIGN MODE placeholders — public campaign page & financial reporting.
  | "business-profile"
  | "campaign-page"
  // ⚠️ DESIGN MODE ONLY — business-facing invitation accept/decline flow.
  | "business-acceptance"
  | "reporting"
  // Nonprofit-facing campaign analytics & insights dashboard.
  | "analytics"
  // ⚠️ DESIGN MODE reference — reusable profile asset + management modules + map.
  | "nonprofit-profile"
  | "success-engine"
  | "architecture-map"
  // ⚠️ DESIGN MODE reference — admin-only profile preload workflow (hidden from public).
  | "admin-preload"
  // Admin-only — read-only email delivery log (hidden from public).
  | "admin-email-log"
  | "admin-access-requests"
  // Platform Super Admin console (verification, profile, AI, charges, SMTP).
  | "super-admin-login"
  | "super-admin-forgot-password"
  | "super-admin-reset-password"
  | "super-admin"
  // Reusable content + assets for the active organization.
  | "organization-library"
  | "guestBartending"
  | "ambassador"
  // ⚠️ DESIGN MODE ONLY — independent success-state previews.
  // ("Local Business Giveback Pending" is the real `created` route.)
  | "success-virtual"
  | "success-ambassador"
  | "success-bartending"
  | "success-giveback-live"
  | "success-mixed";

export type SupportMethod = "giveback" | "donations" | "guestBartending" | "ambassador";

export interface SupportMethods {
  giveback: boolean;
  donations: boolean;
  guestBartending: boolean;
  ambassador: boolean;
}

export interface PromotionChannels {
  facebookUrl: string;
  instagramHandle: string;
  websiteUrl: string;
  newsletter: string;
}

export interface CampaignImage {
  id: string;
  url: string;
  name: string;
  /**
   * Persistent storage reference (e.g. an `s3://...` key) returned by the API
   * after upload. `url` stays a local blob URL for instant preview; `storedUrl`
   * is what gets persisted on the campaign.
   */
  storedUrl?: string;
}

export interface CampaignVideo {
  id: string;
  url: string;
  name: string;
}

/**
 * Lifecycle status of a business in a campaign.
 *   • pending           — invited/selected but not yet confirmed. Private:
 *                         tracked in the nonprofit dashboard, NOT shown publicly.
 *   • accepted          — confirmed participant. Shown publicly in
 *                         "Choose where to participate".
 *   • changes-requested — business replied asking for different terms. Still
 *                         private (not shown publicly) until re-accepted.
 *   • declined          — opted out. Never shown publicly.
 */
export type BusinessInviteStatus =
  | "pending"
  | "accepted"
  | "changes-requested"
  | "declined";

/** A change request a business sends back to the nonprofit. */
export interface BusinessChangeRequest {
  preferredDate?: string;
  preferredGiveback?: number;
  message?: string;
}

export interface InvitedBusiness {
  name: string;
  contactName: string;
  email: string;
  type: string;
  location: string;
  note: string;
  // Acceptance lifecycle — defaults to "pending" when first invited.
  status: BusinessInviteStatus;
  // Populated when the business submits "Request Changes".
  changeRequest?: BusinessChangeRequest;
  // Optional public business-card fields, populated once accepted.
  givebackPercent?: number;
  participationMethod?: string;
  ctaLabel?: string;
  bookingUrl?: string;
  supporterCount?: number;
  // Capability flags this invited business supports. Inferred from its type at
  // invite time so it can only be matched to fundraising methods it supports.
  capabilities?: import("@/data/businesses").BusinessCapabilities;
  /** True once this invite row exists in the API (prevents duplicate sends on save). */
  persisted?: boolean;
}

export type AmbassadorRole =
  | "Board Member"
  | "Parent"
  | "Player"
  | "Coach"
  | "Volunteer"
  | "Ambassador"
  | "Local Personality"
  | "Other";

export type AmbassadorStatus = "Invited";

export interface Ambassador {
  name: string;
  email: string;
  role: AmbassadorRole;
  status: AmbassadorStatus;
}

export type GuestBartenderStatus = "Invited";

export interface GuestBartender {
  name: string;
  email: string;
  business: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  cashTips: boolean;
  status: GuestBartenderStatus;
}

export interface CampaignTask {
  id: string;
  title: string;
  dueDate: string;
  done: boolean;
}

/**
 * Campaign activity history entry. Records notable lifecycle events such as a
 * ForkUp Admin manually adding a business after launch (the rare override).
 */
export type CampaignActivityType =
  | "manual-business-added"
  | "invitation-window-closed"
  | "roster-locked"
  | "note";

export interface CampaignActivity {
  id: string;
  type: CampaignActivityType;
  message: string;
  /** Epoch ms; set at the time the event is recorded. */
  timestamp: number;
}


/**
 * Per-method timing overrides. A campaign is a parent container with one
 * window (startDate/endDate). Each method may optionally run on its own
 * timeline; when omitted, the method inherits the campaign window.
 */
export type MethodTimingMap = Partial<
  Record<SupportMethod, { startDate: string; endDate: string }>
>;

export interface NonprofitProfileState {
  id?: number;
  organizationName: string;
  contactName: string;
  contactEmail: string;
  mission?: string;
  causeCategory?: string;
  verificationStatus?: string;
  claimStatus?: string;
}

export interface BusinessProfileState {
  id: number;
  businessName: string;
  contactName: string;
  contactEmail: string;
  locationId: number;
  locationName: string;
  capabilities: {
    dineAndDonate: boolean;
    shopAndDonate: boolean;
    serviceGiveback: boolean;
    guestBartending: boolean;
  };
  claimStatus?: string;
  businessStatus?: string;
}

export type OrganizerMode = "guided" | "advanced";

export type CampaignOrigin = "nonprofit" | "business_invite";

/** Business partner already committed when a business initiates the campaign. */
export interface LockedBusinessPartner {
  businessId: number;
  locationId: number;
  businessName: string;
  locationLabel: string;
  methodType: string;
  givebackPercentage: number;
  acceptanceStatus: "accepted";
}

export interface CampaignState {
  /** Active UI context — switchable without a separate login. */
  accountIntent: AccountIntent | null;
  /** All nonprofit orgs this user can access. */
  nonprofitMemberships: NonprofitProfileState[];
  /** All business orgs this user can access. */
  businessMemberships: BusinessProfileState[];
  /** Guided = step-by-step with tips; Advanced = full controls. null until chosen. */
  organizerMode: OrganizerMode | null;
  /** Active nonprofit for builder + nonprofit dashboard */
  nonprofitProfile: NonprofitProfileState | null;
  /** Active business for business dashboard */
  businessProfile: BusinessProfileState | null;
  /** How this campaign was started — regulates which builder steps apply. */
  campaignOrigin: CampaignOrigin;
  /** Accepted business partners from a business-initiated invite (skip re-inviting). */
  lockedBusinessPartners: LockedBusinessPartner[];
  campaignSlug: string | null;
  title: string;
  startDate: string;
  endDate: string;
  /**
   * Deadline for businesses to accept their invitation. Once this date passes
   * the participating business list is finalized and the campaign moves from
   * the Invitation Phase into Ready To Launch.
   */
  invitationCloseDate: string;
  /**
   * Manual admin override to close invitations early. When true, the campaign
   * is treated as past the invitation window regardless of invitationCloseDate.
   */
  invitationsClosed: boolean;
  /** Optional per-method timeline overrides (inherit campaign window if unset). */
  methodTiming: MethodTimingMap;
  description: string;
  /**
   * GoFundMe-style create entry: who the fundraiser supports.
   * Additive — older drafts without this field remain valid.
   */
  fundraisingFor?: "nonprofit" | "someone_else" | "myself" | null;
  /**
   * GoFundMe-style create entry: country or "Country|State" for US.
   * Additive — older drafts without this field remain valid.
   */
  createRegion?: string;
  giveback: number;
  goal: string;
  fundsSupport: string[];
  methods: SupportMethods;
  selectedBusinessIds: string[];
  /** Businesses loaded from the API for the builder catalog (not mock data). */
  businessCatalog: Business[];
  // Acceptance status for selected (curated) businesses, keyed by business id.
  // A selected business defaults to "pending" until explicitly accepted.
  businessStatuses: Record<string, BusinessInviteStatus>;
  invited: InvitedBusiness[];
  ambassadors: Ambassador[];
  guestBartenders: GuestBartender[];
  tasks: CampaignTask[];
  // Campaign activity history — tracks notable lifecycle events (e.g. manual
  // admin additions after launch). Append-only audit trail.
  activityLog: CampaignActivity[];
  logo: CampaignImage | null;
  cover: CampaignImage | null;
  images: CampaignImage[];
  video: CampaignVideo | null;
  // Optional promotion channels used by the Success Engine to prepare posts,
  // reminders, emails, and sharing tools. All fields are optional.
  promotion: PromotionChannels;
  // True once the organizer has improved/approved their campaign story.
  storyAccepted: boolean;
  // True when the title/story were pre-filled from the AI/library quick-start
  // draft and haven't been reviewed yet. Purely informational.
  aiDrafted?: boolean;
  // True once the organizer has reviewed and accepted launch terms.
  termsAccepted: boolean;
}


const PROFILE_KEY = "forkup-nonprofit-profile";
const BUSINESS_PROFILE_KEY = "forkup-business-profile";

function saveStoredProfile(profile: NonprofitProfileState | null) {
  if (typeof window === "undefined") return;
  try {
    if (profile) window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    else window.localStorage.removeItem(PROFILE_KEY);
  } catch {
    /* ignore */
  }
}

function saveStoredBusinessProfile(profile: BusinessProfileState | null) {
  if (typeof window === "undefined") return;
  try {
    if (profile) window.localStorage.setItem(BUSINESS_PROFILE_KEY, JSON.stringify(profile));
    else window.localStorage.removeItem(BUSINESS_PROFILE_KEY);
  } catch {
    /* ignore */
  }
}

const initialState: CampaignState = {
  accountIntent: null,
  nonprofitMemberships: [],
  businessMemberships: [],
  organizerMode: null,
  nonprofitProfile: null,
  businessProfile: null,
  campaignOrigin: "nonprofit",
  lockedBusinessPartners: [],
  campaignSlug: null,
  title: "",
  startDate: "",
  endDate: "",
  invitationCloseDate: "",
  invitationsClosed: false,
  methodTiming: {},
  description: "",
  fundraisingFor: null,
  createRegion: "",
  giveback: 15,
  goal: "",
  fundsSupport: [],
  methods: { giveback: true, donations: true, guestBartending: false, ambassador: false },
  selectedBusinessIds: [],
  businessCatalog: [],
  businessStatuses: {},
  invited: [],
  ambassadors: [],
  guestBartenders: [],
  tasks: [],
  activityLog: [],
  logo: null,
  cover: null,
  images: [],
  video: null,
  promotion: { facebookUrl: "", instagramHandle: "", websiteUrl: "", newsletter: "" },
  storyAccepted: false,
  aiDrafted: false,
  termsAccepted: false,
};

// Human-readable labels for each builder screen. The progress indicator is
// built dynamically from the active flow so the step count reflects the
// support methods the nonprofit selected.
const STEP_LABELS: Partial<Record<StepId, string>> = {
  "choose-organizer-mode": "Choose Experience",
  "quick-start": "Build",
  "campaign-review": "Campaign Review",
  methods: "Fundraising Methods",
  details: "Campaign Basics",
  businesses: "Choose / Invite Businesses",
  media: "Campaign Assets",
  review: "Review & Launch",
};

/** Lovable four-stage journey: Build → Review → Partners → Launch. */
export const SETUP_STAGES = ["Build", "Review", "Partners", "Launch"] as const;

/** Steps that show the Lovable SetupProgress header. */
export const SETUP_STEPS: StepId[] = [
  "quick-start",
  "campaign-review",
  "businesses",
  "invite",
  "review",
  // Legacy advanced builder still maps into the four stages when resumed.
  "methods",
  "details",
  "media",
];

/** Map a step to its four-stage index (or -1 when it is not a setup step). */
export function setupStageIndex(step: StepId): number {
  switch (step) {
    case "quick-start":
    case "methods":
      return 0;
    case "campaign-review":
    case "details":
    case "media":
      return 1;
    case "businesses":
    case "invite":
      return 2;
    case "review":
      return 3;
    default:
      return -1;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Campaign Launch Checklist
//
// Each builder step gets a status so organizers who build over multiple
// sessions always know what's complete, what needs attention, and what's
// blocking launch. Guest Bartenders and Ambassadors are intentionally NOT
// part of this checklist — they are activated post-launch in the Success
// Dashboard.
// ─────────────────────────────────────────────────────────────────────────
export type ChecklistStatus = "complete" | "attention" | "optional" | "notStarted";

export interface ChecklistItem {
  id: StepId;
  label: string;
  status: ChecklistStatus;
  required: boolean;
  /** Shown when the step is required but not yet complete. */
  message?: string;
}

export const CHECKLIST_STATUS_LABEL: Record<ChecklistStatus, string> = {
  complete: "Complete",
  attention: "Needs Attention",
  optional: "Optional",
  notStarted: "Not Started",
};

function givebackValid(state: CampaignState): boolean {
  return !state.methods.giveback || (state.giveback >= 5 && state.giveback <= 50);
}

export function computeChecklist(state: CampaignState): ChecklistItem[] {
  const order = builderFlowForState(state);

  return order.map((id): ChecklistItem => {
    const label = STEP_LABELS[id] ?? id;
    switch (id) {
      case "quick-start": {
        const any =
          state.methods.giveback ||
          state.methods.donations ||
          state.methods.guestBartending ||
          state.methods.ambassador;
        const purposeOk = (state.fundsSupport[0] ?? "").trim().length > 0 || !!state.aiDrafted;
        const complete = any && purposeOk;
        return {
          id,
          label,
          required: true,
          status: complete ? "complete" : any || purposeOk ? "attention" : "notStarted",
          message: "Answer purpose, goal, and fundraising methods.",
        };
      }
      case "campaign-review": {
        const started =
          !!state.title.trim() ||
          !!state.startDate ||
          !!state.endDate ||
          !!state.description.trim() ||
          !!state.cover;
        // Lovable Review attention: title, dates, featured image. Logo optional.
        const complete =
          !!state.title.trim() &&
          !!state.startDate &&
          !!state.endDate &&
          !!state.description.trim() &&
          !!state.cover &&
          givebackValid(state);
        return {
          id,
          label,
          required: true,
          status: complete ? "complete" : started ? "attention" : "notStarted",
          message: "Finish campaign review: title, dates, story, and featured image.",
        };
      }
      case "methods": {
        const any =
          state.methods.giveback || state.methods.donations || state.methods.guestBartending || state.methods.ambassador;
        return {
          id,
          label,
          required: true,
          status: any ? "complete" : "notStarted",
          message: "Select at least one way supporters can help.",
        };
      }
      case "details": {
        const started =
          !!state.title.trim() || !!state.startDate || !!state.endDate || !!state.description.trim();
        const storyOk = storyRequirementMet(state.description);
        const complete =
          !!state.title.trim() &&
          !!state.startDate &&
          !!state.endDate &&
          storyOk &&
          givebackValid(state);
        const message = !storyOk
          ? "Add your campaign title, dates, and story (at least 12 words)."
          : "Add your campaign title, dates, and details.";
        return {
          id,
          label,
          required: true,
          status: complete ? "complete" : started ? "attention" : "notStarted",
          message,
        };
      }
      case "businesses": {
        const lockedCount = state.lockedBusinessPartners?.length ?? 0;
        const count = state.selectedBusinessIds.length + state.invited.length + lockedCount;
        // Only blocking when Giveback is the ONLY method. With other methods
        // present, businesses can be invited while launch proceeds.
        const givebackOnly =
          state.methods.giveback &&
          !state.methods.donations &&
          !state.methods.ambassador &&
          !state.methods.guestBartending;
        const partnerLocked = lockedCount > 0;
        return {
          id,
          label,
          required: givebackOnly && !partnerLocked,
          status:
            count > 0 || partnerLocked
              ? "complete"
              : givebackOnly
                ? "notStarted"
                : "optional",
          message: partnerLocked
            ? "Your business partner is already confirmed."
            : "Select or invite at least one business.",
        };
      }
      case "media": {
        const complete = !!state.cover;
        const started = !!state.logo || !!state.cover;
        return {
          id,
          label,
          required: true,
          status: complete ? "complete" : started ? "attention" : "notStarted",
          message: "Featured campaign image required.",
        };
      }
      case "review":
      default:
        return {
          id,
          label,
          required: true,
          status: state.termsAccepted ? "complete" : "notStarted",
          message: "Review campaign terms before launch.",
        };
    }
  });
}

/** First required step that is not yet complete (where a returning user lands). */
export function firstIncompleteStep(state: CampaignState): StepId {
  const incomplete = computeChecklist(state).find((i) => i.required && i.status !== "complete");
  return incomplete?.id ?? "review";
}

// ─────────────────────────────────────────────────────────────────────────
// Campaign Lifecycle Stage
//
// A campaign moves through a clear, date-driven lifecycle. The dashboard
// (Campaign Command Center) changes what it shows based on the current stage.
//
//   draft        — being built; not yet launched.
//   invitation   — launched, businesses can still accept. today < invitationCloseDate.
//   ready        — invitation window closed, list finalized. invitationCloseDate
//                  passed AND today < startDate.
//   live         — startDate <= today <= endDate. Public page is active.
//   closed       — today > endDate. No new participation.
//   settlement   — closed and settlement finalized.
//
// invitationsClosed is a manual admin override to close invitations early; when
// true the invitation window is treated as already past.
// ─────────────────────────────────────────────────────────────────────────
export type CampaignStage =
  | "draft"
  | "invitation"
  | "ready"
  | "live"
  | "closed"
  | "settlement";

export const CAMPAIGN_STAGE_META: Record<
  CampaignStage,
  { label: string; description: string }
> = {
  draft: { label: "Draft", description: "Set up your campaign and invite businesses." },
  invitation: {
    label: "Invitation Phase",
    description: "Businesses are deciding whether to participate.",
  },
  ready: { label: "Ready to Launch", description: "Your business list is finalized — prepare to launch." },
  live: { label: "Live", description: "Your campaign is live and accepting support." },
  closed: { label: "Closed", description: "Your campaign has ended." },
  settlement: { label: "Settlement", description: "Finalizing donations and reporting." },
};

/** Midnight (local) for a YYYY-MM-DD date string; null when empty/invalid. */
function dayStart(date: string): number | null {
  if (!date) return null;
  const t = new Date(date + "T00:00:00").getTime();
  return Number.isNaN(t) ? null : t;
}

// ─────────────────────────────────────────────────────────────────────────
// Invitation Window Rules (platform behavior)
//
// Every campaign has an Invitation Acceptance Deadline. Businesses must accept
// before this date; once it passes the participating business list LOCKS and
// the Success Engine may generate campaign content. The default deadline is
// 7 days before the campaign start date.
// ─────────────────────────────────────────────────────────────────────────
export const DEFAULT_INVITATION_LEAD_DAYS = 7;

/** Default acceptance deadline: 7 days before start. "" when no start date. */
export function defaultInvitationCloseDate(startDate: string): string {
  if (!startDate) return "";
  return subtractCalendarDays(startDate, DEFAULT_INVITATION_LEAD_DAYS);
}

/** Explicit deadline if set, otherwise the 7-days-before-start default. */
export function effectiveInvitationCloseDate(state: CampaignState): string {
  return state.invitationCloseDate || defaultInvitationCloseDate(state.startDate);
}

/**
 * Whether the invitation window has closed (roster is locked). True when the
 * acceptance deadline has passed OR an admin manually closed it early.
 * `now` is injectable for testing / Design Mode previews.
 */
export function isInvitationWindowClosed(
  state: CampaignState,
  now: number = Date.now(),
): boolean {
  if (state.invitationsClosed) return true;
  const close = dayStart(effectiveInvitationCloseDate(state));
  if (close == null) return false;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return today.getTime() >= close;
}

/**
 * Derive the current lifecycle stage from campaign dates and launch state.
 * `today` is injectable for testing / Design Mode previews.
 *
 * V1 boundaries:
 *   Invitation:  today < invitationCloseDate (and not manually closed)
 *   Ready:       invitationCloseDate passed AND today < startDate
 *   Live:        startDate <= today <= endDate
 *   Closed:      today > endDate
 */
export function computeCampaignStage(
  state: CampaignState,
  now: number = Date.now(),
): CampaignStage {
  // Not launched yet → always Draft.
  if (!state.termsAccepted) return "draft";

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  const start = dayStart(state.startDate);
  const end = dayStart(state.endDate);
  // Use the effective deadline (explicit, or default 7 days before start).
  const close = dayStart(effectiveInvitationCloseDate(state));

  // Closed first — once the end date passes, nothing else applies.
  if (end != null && todayMs > end) return "closed";

  // Live — within the campaign window.
  if (start != null && todayMs >= start) return "live";

  // Before start date: split invitation vs. ready by the invitation deadline.
  const windowClosed =
    state.invitationsClosed || (close != null && todayMs >= close);
  if (windowClosed) return "ready";

  return "invitation";
}

// Suggested due date for a post-launch activation task. If the campaign start
// is more than 14 days away, the task is due 14 days before start; otherwise
// it's due as soon as possible (today).
function successTaskDueDate(startDate: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (!startDate) return toDateOnlyString(today);
  const start = new Date(startDate + "T00:00:00");
  const fourteenBefore = new Date(start);
  fourteenBefore.setDate(fourteenBefore.getDate() - 14);
  return fourteenBefore <= today ? toDateOnlyString(today) : toDateOnlyString(fourteenBefore);
}

export type GoToOptions = {
  statePatch?: Partial<CampaignState>;
  query?: StepQueryParams;
};

interface CampaignContextValue {
  step: StepId;
  goTo: (step: StepId, options?: GoToOptions) => void;
  next: () => void;
  back: () => void;
  launchCampaign: () => void;
  setNonprofitProfile: (profile: NonprofitProfileState | null) => void;
  setBusinessProfile: (profile: BusinessProfileState | null) => void;
  switchActiveRole: (role: UserRole, organizationId?: number) => void;
  state: CampaignState;
  update: (patch: Partial<CampaignState>) => void;
  setMethodTiming: (m: SupportMethod, patch: { startDate?: string; endDate?: string }) => void;
  clearMethodTiming: (m: SupportMethod) => void;
  toggleMethod: (m: SupportMethod) => void;
  hasAnyMethod: boolean;
  toggleBusiness: (id: string) => void;
  setBusinessStatus: (id: string, status: BusinessInviteStatus) => void;
  addInvited: (b: Omit<InvitedBusiness, "status"> & { status?: BusinessInviteStatus }) => void;
  setInvitedStatus: (index: number, status: BusinessInviteStatus) => void;
  setInvitedChangeRequest: (index: number, req: BusinessChangeRequest) => void;
  removeInvited: (index: number) => void;
  addAmbassador: (a: Ambassador) => void;
  editAmbassador: (index: number, a: Ambassador) => void;
  removeAmbassador: (index: number) => void;
  addGuestBartender: (g: GuestBartender) => void;
  editGuestBartender: (index: number, g: GuestBartender) => void;
  removeGuestBartender: (index: number) => void;
  addTask: (t: CampaignTask) => void;
  removeTask: (id: string) => void;
  addImages: (imgs: CampaignImage[]) => void;

  removeImage: (id: string) => void;
  selectedBusinesses: Business[];
  flow: StepId[];
  progressSteps: { id: StepId; label: string }[];
  activeProgressIndex: number;
  // Campaign Launch Checklist
  checklist: ChecklistItem[];
  completedCount: number;
  requiredRemaining: number;
  reviewUnlocked: boolean;
  firstIncompleteStepId: StepId;
  // Derived lifecycle stage (respects Design Mode override when set).
  campaignStage: CampaignStage;
  // ── Invitation Window Rules (platform behavior) ──
  /** Acceptance deadline in effect (explicit, or default 7 days before start). */
  effectiveInvitationCloseDate: string;
  /** True once the invitation window has closed (deadline passed or admin override). */
  invitationWindowClosed: boolean;
  /** True once the participating business list is locked (== invitationWindowClosed). */
  rosterLocked: boolean;
  /** Confirmed participants only (accepted) — the official, public-facing roster. */
  participatingBusinesses: Business[];
  participatingInvited: InvitedBusiness[];
  /** Total confirmed participants (curated + invited). */
  participatingCount: number;
  /** Success Engine may generate campaign content only after the roster is finalized. */
  successEngineReady: boolean;
  /** True only when the campaign is actually Live (date arrived + window closed). */
  campaignLive: boolean;
  // Campaign activity history + admin override to add a business after launch.
  activityLog: CampaignActivity[];
  addActivity: (type: CampaignActivityType, message: string) => void;
  adminAddBusiness: (b: Omit<InvitedBusiness, "status">) => void;
  resumedFromDraft: boolean;
  dismissResumed: () => void;
  nonprofitName: string;
  reset: () => void;
  hasDraft: boolean;
  /** Reload draft campaigns from the API (single source of truth). */
  refreshServerDrafts: () => Promise<void>;
  /** Clear any legacy browser-only draft data. */
  discardLocalDraft: (opts?: { slug?: string; force?: boolean }) => void;
  saveAndExit: () => void;
  resumeDraft: () => void;
  resumeCampaignBuilder: (slug: string) => Promise<void>;
  startNewCampaign: () => void;
  // ⚠️ Temporary Design Mode — remove before production.
  designMode: boolean;
  toggleDesignMode: () => void;
  // ⚠️ Design Mode only — force a lifecycle stage for previewing the dashboard.
  stageOverride: CampaignStage | null;
  setStageOverride: (s: CampaignStage | null) => void;
}


const CampaignContext = createContext<CampaignContextValue | null>(null);

export function CampaignProvider({
  children,
  initialStep = "website-landing",
}: {
  children: ReactNode;
  initialStep?: StepId;
}) {
  const [step, setStep] = useState<StepId>(initialStep);
  const [state, setState] = useState<CampaignState>(() => ({ ...initialState }));
  // Start false so SSR and the first client render match; detect any saved
  // draft after mount to avoid a hydration mismatch on the start screen.
  const [hasDraft, setHasDraft] = useState<boolean>(false);
  const sessionBootstrapped = useRef(false);
  const stepRef = useRef(step);
  const stateRef = useRef(state);
  const draftSavePromiseRef = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!getAuthToken()) {
      if (sessionBootstrapped.current) return;
      sessionBootstrapped.current = true;
      setState((prev) => {
        if (
          !prev.nonprofitProfile &&
          !prev.businessProfile &&
          !prev.accountIntent &&
          prev.nonprofitMemberships.length === 0 &&
          prev.businessMemberships.length === 0
        ) {
          return prev;
        }
        return {
          ...prev,
          accountIntent: null,
          nonprofitProfile: null,
          businessProfile: null,
          nonprofitMemberships: [],
          businessMemberships: [],
        };
      });
      return;
    }

    // Show cached org/profile immediately — do not wait for /auth/context.
    const cached = loadUserSession();
    if (cached) {
      setState((prev) => {
        const patch = buildSessionPatch(cached);
        if (
          prev.nonprofitProfile?.id === patch.nonprofitProfile?.id &&
          prev.businessProfile?.id === patch.businessProfile?.id &&
          prev.nonprofitMemberships.length === patch.nonprofitMemberships.length &&
          prev.businessMemberships.length === patch.businessMemberships.length
        ) {
          return prev;
        }
        return { ...prev, ...patch };
      });
    }

    if (sessionBootstrapped.current) return;
    sessionBootstrapped.current = true;

    void syncAuthSession(undefined, { force: true }).then((session) => {
      if (!session) return;
      setState((prev) => {
        if (sessionMatchesState(session, prev)) return prev;
        return {
          ...prev,
          ...buildSessionPatch(session),
          title:
            !prev.title.trim() && session.nonprofitProfile?.organizationName
              ? `Support ${session.nonprofitProfile.organizationName}`
              : prev.title,
        };
      });
    });
  }, []);
  // True right after a Save & Exit draft is resumed, so the builder can show a
  // "Welcome back" message. Cleared once dismissed or a new campaign starts.
  const [resumedFromDraft, setResumedFromDraft] = useState(false);
  // ⚠️ Temporary Design Mode state — design review only, not for production.
  const [designMode, setDesignMode] = useState(false);
  // ⚠️ Design Mode only — manual lifecycle stage override for previewing.
  const [stageOverride, setStageOverride] = useState<CampaignStage | null>(null);

  const toggleDesignMode = () => setDesignMode((v) => !v);

  const refreshServerDrafts = useCallback(async () => {
    const npId = stateRef.current.nonprofitProfile?.id;
    if (!npId || !getAuthToken()) {
      setHasDraft(false);
      return;
    }
    try {
      const campaigns = await fetchManageCampaigns(npId);
      setHasDraft(campaigns.some((c) => c.status === "draft"));
    } catch {
      setHasDraft(false);
    }
  }, []);

  const persistDraftToServer = useCallback(async (): Promise<boolean> => {
    const current = stateRef.current;
    const np = current.nonprofitProfile;
    if (!np?.id || !getAuthToken() || !canSaveDraftToServer(current)) {
      return false;
    }
    const payload = buildDraftSavePayload(current, np, computeSelectedBusinesses(current));
    if (!payload) return false;

    if (draftSavePromiseRef.current) {
      return draftSavePromiseRef.current;
    }

    const promise = (async () => {
      try {
        const slug = stateRef.current.campaignSlug;
        const result = slug
          ? await updateCampaign(slug, payload)
          : await createCampaign(payload);
        setState((prev) => ({
          ...prev,
          campaignSlug: result.slug,
          invited: prev.invited.map((b) => ({ ...b, persisted: true })),
        }));
        setHasDraft(true);
        invalidateNonprofitDashboardCache(np.id);
        await refreshServerDrafts();
        return true;
      } catch {
        return false;
      } finally {
        draftSavePromiseRef.current = null;
      }
    })();

    draftSavePromiseRef.current = promise;
    return promise;
  }, [refreshServerDrafts]);

  const navigateToStep = useCallback((s: StepId, query?: StepQueryParams) => {
    setStep(s);
    if (typeof window !== "undefined") {
      const url = query
        ? pathForStepWithParams(s, query, window.location.pathname, window.location.search)
        : pathForStep(s, window.location.pathname, window.location.search);
      const current = locationUrl(window.location.pathname, window.location.search);
      if (current !== url || window.history.state?.step !== s) {
        window.history.pushState({ step: s }, "", url);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  const goTo = useCallback(
    (s: StepId, options?: GoToOptions) => {
      if (options?.statePatch) {
        setState((prev) => ({ ...prev, ...options.statePatch }));
      }
      const from = stepRef.current;
      const leavingBuilder = isBuilderFlowStep(from) && !isBuilderFlowStep(s);
      if (leavingBuilder) {
        void persistDraftToServer().finally(() => navigateToStep(s, options?.query));
        return;
      }
      navigateToStep(s, options?.query);
    },
    [persistDraftToServer, navigateToStep],
  );

  // Keep the browser URL in sync with the active screen (back/forward + direct loads).
  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncFromLocation = () => {
      const next = stepFromLocation(
        window.location.pathname,
        window.location.search,
        window.history.state?.step,
      );
      const from = stepRef.current;
      if (isBuilderFlowStep(from) && !isBuilderFlowStep(next)) {
        void persistDraftToServer().finally(() => {
          setStep(next);
          window.scrollTo({ top: 0, behavior: "auto" });
        });
        return;
      }
      if (next === "business-invite-flow") {
        const { campaignSlug } = inviteReviewFromSearch(window.location.search);
        if (campaignSlug) {
          setState((prev) =>
            prev.campaignSlug === campaignSlug ? prev : { ...prev, campaignSlug },
          );
        }
      }
      setStep(next);
      window.scrollTo({ top: 0, behavior: "auto" });
    };

    const url = pathForStep(step, window.location.pathname, window.location.search);
    const current = locationUrl(window.location.pathname, window.location.search);
    if (current !== url || window.history.state?.step !== step) {
      window.history.replaceState({ step }, "", url);
    }

    window.addEventListener("popstate", syncFromLocation);
    return () => window.removeEventListener("popstate", syncFromLocation);
  }, [step, persistDraftToServer]);

  // Campaign creation and nonprofit management require a signed-in account.
  useEffect(() => {
    if (typeof window === "undefined" || designMode) return;
    if (step === "auth-login") return;
    if (!stepRequiresAuth(step)) return;
    if (isCampaignAuthenticated()) return;

    stashAuthReturnStep(step);
    setStep("auth-login");
    window.history.replaceState({ step: "auth-login" }, "", stepToPath("auth-login"));
  }, [step, designMode]);

  // Remember the last dashboard visited so "Back to dashboard" returns to the right role.
  useEffect(() => {
    if (typeof window === "undefined") return;
    stashDashboardReturn(step, state.accountIntent);
  }, [step, state.accountIntent]);

  const discardLocalDraft = useCallback((opts?: { slug?: string; force?: boolean }) => {
    if (!opts?.force && opts?.slug) {
      const draft = loadDraft();
      const draftSlug = draft?.state?.campaignSlug ?? null;
      const activeSlug = stateRef.current.campaignSlug;
      if (draftSlug && draftSlug !== opts.slug && activeSlug !== opts.slug) {
        return;
      }
    }

    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore storage errors */
      }
    }
    setResumedFromDraft(false);
    if (opts?.slug && stateRef.current.campaignSlug === opts.slug) {
      setState((prev) => ({ ...prev, campaignSlug: null }));
    }
  }, []);

  useEffect(() => {
    if (!getAuthToken() || !state.nonprofitProfile?.id) {
      setHasDraft(false);
      return;
    }
    void refreshServerDrafts();
  }, [state.nonprofitProfile?.id, refreshServerDrafts]);

  // Auto-save draft progress while moving through the builder.
  useEffect(() => {
    if (!isBuilderFlowStep(step) || !canSaveDraftToServer(state)) return;
    const timer = window.setTimeout(() => {
      void persistDraftToServer();
    }, 400);
    return () => window.clearTimeout(timer);
  }, [
    step,
    state.methods,
    state.title,
    state.description,
    state.startDate,
    state.endDate,
    state.campaignSlug,
    persistDraftToServer,
  ]);

  const saveAndExit = useCallback(() => {
    void (async () => {
      const current = stateRef.current;
      const saved = await persistDraftToServer();
      if (saved) {
        discardLocalDraft({ force: true });
      } else if (isBuilderFlowStep(stepRef.current) && canSaveDraftToServer(current)) {
        persistDraft(current, stepRef.current);
        setHasDraft(true);
      }
      goTo(
        dashboardStepForRole(
          current.accountIntent ?? "supporter",
          current.nonprofitMemberships.length > 0,
          current.businessMemberships.length > 0,
        ),
      );
    })();
  }, [goTo, discardLocalDraft, persistDraftToServer]);

  const dismissResumed = () => setResumedFromDraft(false);

  const startNewCampaign = () => {
    if (!state.nonprofitProfile) {
      goTo("nonprofit-claim");
      return;
    }
    setState((prev) => ({
      ...initialState,
      nonprofitProfile: prev.nonprofitProfile,
      // Default GoFundMe-style guided builder; advanced remains via choose-organizer-mode.
      organizerMode: "guided",
      nonprofitMemberships: prev.nonprofitMemberships,
      businessMemberships: prev.businessMemberships,
      accountIntent: prev.accountIntent,
      title: prev.nonprofitProfile
        ? `Support ${prev.nonprofitProfile.organizationName}`
        : "",
    }));
    discardLocalDraft({ force: true });
    void refreshServerDrafts();
    goTo("quick-start");
  };


  const resumeCampaignBuilder = useCallback(
    async (slug: string) => {
      const data = await fetchBuilderCampaign(slug);
      const patch = stateFromBuilderCampaign(data);
      setState((prev) => ({
        ...prev,
        ...patch,
        nonprofitProfile: prev.nonprofitProfile,
        nonprofitMemberships: prev.nonprofitMemberships,
        organizerMode: prev.organizerMode ?? "guided",
        accountIntent: "nonprofit",
      }));
      setResumedFromDraft(true);
      const merged = { ...stateRef.current, ...patch };
      goTo(firstIncompleteStep(merged));
    },
    [goTo],
  );

  const resumeDraft = useCallback(() => {
    void (async () => {
      const slug = stateRef.current.campaignSlug;
      if (slug) {
        await resumeCampaignBuilder(slug);
        return;
      }
      const npId = stateRef.current.nonprofitProfile?.id;
      if (!npId) {
        goTo("quick-start");
        return;
      }
      try {
        const campaigns = await fetchManageCampaigns(npId);
        const draft = campaigns.find((c) => c.status === "draft");
        if (draft) {
          await resumeCampaignBuilder(draft.slug);
          return;
        }
      } catch {
        /* fall through */
      }
      goTo("quick-start");
    })();
  }, [goTo, resumeCampaignBuilder]);

  // Nick V2 / Lovable: Build → Review → Partners (optional) → Launch.
  // Guest Bartender and Ambassador activation remain post-launch.
  const flow = useMemo<StepId[]>(() => builderFlowForState(state), [
    state.methods.giveback,
    state.methods.guestBartending,
    state.campaignOrigin,
    state.lockedBusinessPartners,
  ]);

  // The progress indicator is built from the active flow so the step count
  // updates dynamically with the chosen support methods.
  const progressSteps = useMemo(
    () => flow.map((id) => ({ id, label: STEP_LABELS[id] ?? id })),
    [flow],
  );

  const activeFlowId: StepId = step === "invite" ? "businesses" : step;
  const activeProgressIndex = progressSteps.findIndex((s) => s.id === activeFlowId);

  const next = () => {
    // Lovable path: Campaign Review → Partners (if needed) or Launch review.
    if (step === "campaign-review") {
      if (state.methods.giveback || state.methods.guestBartending) goTo("businesses");
      else goTo("review");
      return;
    }
    const current = step === "invite" ? "businesses" : step;
    const idx = flow.indexOf(current);
    if (idx >= 0 && idx < flow.length - 1) {
      goTo(flow[idx + 1]);
      return;
    }
    // After inviting businesses (last flow step), return to Review to launch.
    if (current === "businesses") {
      goTo("review");
      return;
    }
    if (step === "review") goTo("created");
  };

  const back = () => {
    if (step === "campaign-review") {
      goTo("quick-start");
      return;
    }
    const current = step === "invite" ? "businesses" : step;
    const idx = flow.indexOf(current);
    if (idx > 0) goTo(flow[idx - 1]);
    else goTo("start");
  };

  // Launch the campaign: generate post-launch success tasks for any selected
  // people-powered method that has no participants yet, then show the success
  // screen. Timing: if the campaign start is more than 14 days away, the task
  // is due 14 days before start; otherwise it's due as soon as possible.
  const setNonprofitProfile = useCallback((profile: NonprofitProfileState | null) => {
    saveStoredProfile(profile);
    setState((prev) => {
      if (
        prev.nonprofitProfile?.id === profile?.id &&
        prev.nonprofitProfile?.organizationName === profile?.organizationName
      ) {
        return prev;
      }
      const memberships = profile
        ? [
            ...prev.nonprofitMemberships.filter((n) => n.id !== profile.id),
            profile,
          ]
        : prev.nonprofitMemberships;
      return {
        ...prev,
        nonprofitMemberships: memberships,
        nonprofitProfile: profile,
        title:
          profile?.organizationName && !prev.title.trim()
            ? `Support ${profile.organizationName}`
            : prev.title,
      };
    });
  }, []);

  const setBusinessProfile = useCallback((profile: BusinessProfileState | null) => {
    saveStoredBusinessProfile(profile);
    setState((prev) => {
      if (
        prev.businessProfile?.id === profile?.id &&
        prev.businessProfile?.businessName === profile?.businessName
      ) {
        return prev;
      }
      const memberships = profile
        ? [
            ...prev.businessMemberships.filter((b) => b.id !== profile.id),
            profile,
          ]
        : prev.businessMemberships;
      return { ...prev, businessMemberships: memberships, businessProfile: profile };
    });
  }, []);

  const switchActiveRole = useCallback((role: UserRole, organizationId?: number) => {
    setState((prev) => {
      const nonprofitProfile =
        role === "nonprofit"
          ? prev.nonprofitMemberships.find((n) => n.id === organizationId) ??
            prev.nonprofitMemberships[0] ??
            null
          : prev.nonprofitProfile;
      const businessProfile =
        role === "business"
          ? prev.businessMemberships.find((b) => b.id === organizationId) ??
            prev.businessMemberships[0] ??
            null
          : prev.businessProfile;

      const next = {
        ...prev,
        accountIntent: role,
        nonprofitProfile,
        businessProfile,
      };

      const stored = loadUserSession();
      if (stored) {
        persistUserSession({
          ...stored,
          activeRole: role,
          accountIntent: role,
          nonprofitProfile,
          businessProfile,
          activeNonprofitId: nonprofitProfile?.id ?? null,
          activeBusinessId: businessProfile?.id ?? null,
        });
      }

      return next;
    });
  }, []);

  const launchCampaign = () => {
    const dueDate = successTaskDueDate(state.startDate);
    if (state.methods.guestBartending && state.guestBartenders.length === 0) {
      addTask({ id: "task-add-guest-bartenders", title: "Add guest bartenders", dueDate, done: false });
    }
    if (state.methods.ambassador && state.ambassadors.length === 0) {
      addTask({ id: "task-add-ambassadors", title: "Add ambassadors", dueDate, done: false });
    }
    goTo("created");
  };

  const update = useCallback((patch: Partial<CampaignState>) => {
    setState((prev) => {
      const keys = Object.keys(patch) as (keyof CampaignState)[];
      if (keys.every((k) => Object.is(prev[k], patch[k]))) return prev;
      return { ...prev, ...patch };
    });
  }, []);

  const setMethodTiming = (
    m: SupportMethod,
    patch: { startDate?: string; endDate?: string },
  ) =>
    setState((prev) => {
      const existing = prev.methodTiming[m] ?? { startDate: "", endDate: "" };
      return {
        ...prev,
        methodTiming: { ...prev.methodTiming, [m]: { ...existing, ...patch } },
      };
    });

  const clearMethodTiming = (m: SupportMethod) =>
    setState((prev) => {
      const next = { ...prev.methodTiming };
      delete next[m];
      return { ...prev, methodTiming: next };
    });



  const toggleMethod = (m: SupportMethod) =>
    setState((prev) => ({
      ...prev,
      methods: { ...prev.methods, [m]: !prev.methods[m] },
    }));

  const toggleBusiness = (id: string) =>
    setState((prev) => {
      const isSelected = prev.selectedBusinessIds.includes(id);
      const selectedBusinessIds = isSelected
        ? prev.selectedBusinessIds.filter((x) => x !== id)
        : [...prev.selectedBusinessIds, id];
      const businessStatuses = { ...prev.businessStatuses };
      if (isSelected) {
        // Deselecting clears any acceptance state.
        delete businessStatuses[id];
      } else {
        // Newly selected businesses start as pending (private) until accepted.
        businessStatuses[id] = "pending";
      }
      return { ...prev, selectedBusinessIds, businessStatuses };
    });

  const setBusinessStatus = (id: string, status: BusinessInviteStatus) =>
    setState((prev) => ({
      ...prev,
      businessStatuses: { ...prev.businessStatuses, [id]: status },
    }));

  const addInvited = (
    b: Omit<InvitedBusiness, "status"> & { status?: BusinessInviteStatus },
  ) =>
    setState((prev) => ({
      ...prev,
      // New invites are private/pending until the business accepts.
      invited: [...prev.invited, { ...b, status: b.status ?? "pending" }],
    }));

  const setInvitedStatus = (index: number, status: BusinessInviteStatus) =>
    setState((prev) => ({
      ...prev,
      invited: prev.invited.map((b, i) => (i === index ? { ...b, status } : b)),
    }));

  const setInvitedChangeRequest = (index: number, req: BusinessChangeRequest) =>
    setState((prev) => ({
      ...prev,
      invited: prev.invited.map((b, i) =>
        i === index ? { ...b, status: "changes-requested", changeRequest: req } : b,
      ),
    }));

  const removeInvited = (index: number) =>
    setState((prev) => ({ ...prev, invited: prev.invited.filter((_, i) => i !== index) }));

  const addAmbassador = (a: Ambassador) =>
    setState((prev) => ({ ...prev, ambassadors: [...prev.ambassadors, a] }));

  const editAmbassador = (index: number, a: Ambassador) =>
    setState((prev) => ({
      ...prev,
      ambassadors: prev.ambassadors.map((x, i) => (i === index ? a : x)),
    }));

  const removeAmbassador = (index: number) =>
    setState((prev) => ({ ...prev, ambassadors: prev.ambassadors.filter((_, i) => i !== index) }));

  const addGuestBartender = (g: GuestBartender) =>
    setState((prev) => ({ ...prev, guestBartenders: [...prev.guestBartenders, g] }));

  const editGuestBartender = (index: number, g: GuestBartender) =>
    setState((prev) => ({
      ...prev,
      guestBartenders: prev.guestBartenders.map((x, i) => (i === index ? g : x)),
    }));

  const removeGuestBartender = (index: number) =>
    setState((prev) => ({
      ...prev,
      guestBartenders: prev.guestBartenders.filter((_, i) => i !== index),
    }));

  const addTask = (t: CampaignTask) =>
    setState((prev) =>
      prev.tasks.some((x) => x.id === t.id)
        ? prev
        : { ...prev, tasks: [...prev.tasks, t] },
    );

  const removeTask = (id: string) =>
    setState((prev) => ({ ...prev, tasks: prev.tasks.filter((t) => t.id !== id) }));


  const addImages = (imgs: CampaignImage[]) =>
    setState((prev) => ({ ...prev, images: [...prev.images, ...imgs] }));

  const removeImage = (id: string) =>
    setState((prev) => ({ ...prev, images: prev.images.filter((i) => i.id !== id) }));

  // Append an entry to the campaign activity history.
  const addActivity = (type: CampaignActivityType, message: string) =>
    setState((prev) => ({
      ...prev,
      activityLog: [
        ...prev.activityLog,
        { id: `act-${Date.now()}-${prev.activityLog.length}`, type, message, timestamp: Date.now() },
      ],
    }));

  // ForkUp Admin override: manually add a business after the roster has locked
  // (e.g. after launch). This should be rare; every addition is recorded in the
  // campaign activity history. The business is added as an accepted participant.
  const adminAddBusiness = (b: Omit<InvitedBusiness, "status">) =>
    setState((prev) => ({
      ...prev,
      invited: [...prev.invited, { ...b, status: "accepted" }],
      activityLog: [
        ...prev.activityLog,
        {
          id: `act-${Date.now()}-${prev.activityLog.length}`,
          type: "manual-business-added",
          message: `Admin manually added ${b.name} to the participating business list.`,
          timestamp: Date.now(),
        },
      ],
    }));

  const reset = () => {
    setState(initialState);
    setStep("start");
    discardLocalDraft({ force: true });
    void refreshServerDrafts();
  };

  const lockedBusinessCards = useMemo(
    () => (state.lockedBusinessPartners ?? []).map(lockedPartnerToBusiness),
    [state.lockedBusinessPartners],
  );

  const selectedBusinesses = useMemo(() => {
    const lockedIds = new Set(lockedBusinessCards.map((b) => b.id));
    const catalog = businessesFromCatalog(state);
    const fromCatalog = catalog.filter(
      (b) => state.selectedBusinessIds.includes(b.id) && !lockedIds.has(b.id),
    );
    const lockedSelected = lockedBusinessCards.filter((b) =>
      state.selectedBusinessIds.includes(b.id),
    );
    return [...lockedSelected, ...fromCatalog];
  }, [state.selectedBusinessIds, state.businessCatalog, lockedBusinessCards]);

  const hasAnyMethod =
    state.methods.giveback || state.methods.donations || state.methods.guestBartending || state.methods.ambassador;

  const checklist = useMemo(() => computeChecklist(state), [state]);
  const completedCount = checklist.filter((i) => i.status === "complete").length;
  const requiredRemaining = checklist.filter((i) => i.required && i.status !== "complete").length;
  const firstIncompleteStepId = useMemo(() => firstIncompleteStep(state), [state]);
  // Review unlocks once Build steps (methods/details/media) are complete.
  // Businesses come AFTER review in Nick's V2 order, so they do not gate Review.
  const reviewUnlocked = checklist
    .filter((i) => i.required && i.id !== "review" && i.id !== "businesses")
    .every((i) => i.status === "complete");

  // Derived lifecycle stage. Design Mode can force any stage for previewing.
  const derivedStage = useMemo(() => computeCampaignStage(state), [state]);
  const campaignStage = stageOverride ?? derivedStage;

  // ── Invitation Window Rules (derived platform behavior) ──
  // When Design Mode forces a stage, respect it so previews stay consistent.
  const effectiveCloseDate = effectiveInvitationCloseDate(state);
  const invitationWindowClosed = useMemo(() => {
    if (stageOverride) {
      // ready / live / closed / settlement all imply the window has closed.
      return stageOverride !== "draft" && stageOverride !== "invitation";
    }
    return isInvitationWindowClosed(state);
  }, [state, stageOverride]);
  // Once the invitation window closes, the participating business list locks.
  const rosterLocked = invitationWindowClosed;
  // Confirmed participants only (accepted) — the official public-facing roster.
  const participatingBusinesses = useMemo(
    () => {
      const lockedIds = new Set(lockedBusinessCards.map((b) => b.id));
      const catalog = businessesFromCatalog(state);
      const fromCatalog = catalog.filter(
        (b) =>
          state.selectedBusinessIds.includes(b.id) &&
          state.businessStatuses[b.id] === "accepted" &&
          !lockedIds.has(b.id),
      );
      const lockedAccepted = lockedBusinessCards.filter(
        (b) => state.businessStatuses[b.id] === "accepted",
      );
      return [...lockedAccepted, ...fromCatalog];
    },
    [state.selectedBusinessIds, state.businessStatuses, state.businessCatalog, lockedBusinessCards],
  );
  const participatingInvited = useMemo(
    () => state.invited.filter((b) => b.status === "accepted"),
    [state.invited],
  );
  const participatingCount = participatingBusinesses.length + participatingInvited.length;
  // The Success Engine generates campaign content only after the roster is final.
  const successEngineReady = rosterLocked;
  // A campaign is Live only when the start date has arrived AND the window closed.
  const campaignLive = campaignStage === "live";




  const value: CampaignContextValue = {
    step,
    goTo,
    next,
    back,
    launchCampaign,
    setNonprofitProfile,
    setBusinessProfile,
    switchActiveRole,
    state,
    update,
    setMethodTiming,
    clearMethodTiming,
    toggleMethod,
    hasAnyMethod,
    toggleBusiness,
    setBusinessStatus,
    addInvited,
    setInvitedStatus,
    setInvitedChangeRequest,
    removeInvited,
    addAmbassador,
    editAmbassador,
    removeAmbassador,
    addGuestBartender,
    editGuestBartender,
    removeGuestBartender,
    addTask,
    removeTask,
    addImages,

    removeImage,
    selectedBusinesses,
    flow,
    progressSteps,
    activeProgressIndex,
    checklist,
    completedCount,
    requiredRemaining,
    reviewUnlocked,
    firstIncompleteStepId,
    resumedFromDraft,
    dismissResumed,
    nonprofitName: state.nonprofitProfile?.organizationName ?? "",
    reset,
    hasDraft,
    refreshServerDrafts,
    discardLocalDraft,
    saveAndExit,
    resumeDraft,
    resumeCampaignBuilder,
    startNewCampaign,
    designMode,
    toggleDesignMode,
    campaignStage,
    effectiveInvitationCloseDate: effectiveCloseDate,
    invitationWindowClosed,
    rosterLocked,
    participatingBusinesses,
    participatingInvited,
    participatingCount,
    successEngineReady,
    campaignLive,
    activityLog: state.activityLog,
    addActivity,
    adminAddBusiness,
    stageOverride,
    setStageOverride,
  };



  return <CampaignContext.Provider value={value}>{children}</CampaignContext.Provider>;
}

export function useCampaign() {
  const ctx = useContext(CampaignContext);
  if (!ctx) throw new Error("useCampaign must be used within CampaignProvider");
  return ctx;
}

export const SUPPORT_METHOD_META: Record<
  SupportMethod,
  { title: string; short: string }
> = {
  giveback: { title: "Dine & Donate / Local Giveback", short: "Local businesses give back" },
  donations: { title: "Virtual Donations", short: "Online contributions" },
  guestBartending: { title: "Guest Bartending Event", short: "In-person event fundraising" },
  ambassador: { title: "Ambassador Fundraising", short: "Network-based online fundraising" },
};
