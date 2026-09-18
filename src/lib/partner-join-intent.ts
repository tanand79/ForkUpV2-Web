/**
 * Session intent for public-campaign → partner join request.
 *
 * Purpose: Remember which campaign a restaurant/local business wants to join
 * across guest giveback join / signup / claim, then submit the API request
 * once they have an authenticated business membership.
 */
import {
  createPartnerJoinRequest,
  fetchAuthContext,
  type PartnerJoinDoorType,
  type PartnerJoinRequest,
} from "@/lib/api";
import { getAuthToken } from "@/lib/auth-storage";
import { stashBusinessDoor, type BusinessDoor } from "@/lib/business-door";
import {
  defaultBusinessJoinDraft,
  loadBusinessJoinDraft,
  saveBusinessJoinDraft,
} from "@/lib/business-join-four-step-draft";

const KEY = "forkup-partner-join-intent";

export type PartnerJoinIntent = {
  campaignSlug: string;
  doorType: PartnerJoinDoorType;
  businessId?: number;
  locationId?: number;
  /**
   * When true (public Join as restaurant/local), user must complete
   * Find My Restaurant / business giveback join before sending the request.
   */
  requireFind?: boolean;
  /** Set after Find My Restaurant / giveback join finishes for this intent. */
  findCompleted?: boolean;
  /** User id that completed find / owns businessId — invalidate if another account logs in. */
  ownerUserId?: number;
  /** User chose “Find a different restaurant” — stay on Find even if they already have a business. */
  forceFind?: boolean;
};

const EXISTING_LOGIN_KEY = "forkup-partner-join-existing-login";

/** Stash a pending public-campaign join intent. */
export function stashPartnerJoinIntent(intent: PartnerJoinIntent) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(intent));
  } catch {
    /* ignore */
  }
}

/** Read pending join intent, if any. */
export function readPartnerJoinIntent(): PartnerJoinIntent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PartnerJoinIntent;
    if (!parsed?.campaignSlug) return null;
    if (parsed.doorType !== "restaurant" && parsed.doorType !== "local") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Clear pending join intent (+ existing-login flag). */
export function clearPartnerJoinIntent() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(KEY);
    sessionStorage.removeItem(EXISTING_LOGIN_KEY);
  } catch {
    /* ignore */
  }
}

/** Flag next auth as existing-business sign-in (skip find only for that account). */
export function stashPartnerJoinExistingLogin() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(EXISTING_LOGIN_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** Consume existing-business login flag (one-shot). */
export function consumePartnerJoinExistingLogin(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = sessionStorage.getItem(EXISTING_LOGIN_KEY);
    sessionStorage.removeItem(EXISTING_LOGIN_KEY);
    return v === "1";
  } catch {
    return false;
  }
}

/**
 * Keep intent only if it belongs to this user / their business memberships.
 * Clears foreign businessId from a previous account (e.g. Sovana → Pear login).
 */
export function reconcilePartnerJoinIntentForUser(input: {
  userId: number;
  ownedBusinessIds: number[];
}): PartnerJoinIntent | null {
  const intent = readPartnerJoinIntent();
  if (!intent) return null;
  // Without a known user, do not wipe intent (session still loading).
  if (!Number.isFinite(input.userId) || input.userId <= 0) return intent;

  const owned = new Set(input.ownedBusinessIds.filter((id) => Number.isFinite(id) && id > 0));

  if (intent.ownerUserId != null && intent.ownerUserId !== input.userId) {
    const reset: PartnerJoinIntent = {
      campaignSlug: intent.campaignSlug,
      doorType: intent.doorType,
      requireFind: true,
      findCompleted: false,
    };
    stashPartnerJoinIntent(reset);
    return reset;
  }

  if (intent.businessId != null && !owned.has(intent.businessId)) {
    const reset: PartnerJoinIntent = {
      campaignSlug: intent.campaignSlug,
      doorType: intent.doorType,
      requireFind: true,
      findCompleted: false,
    };
    stashPartnerJoinIntent(reset);
    return reset;
  }

  // findCompleted from a prior session without owner/business — force Find again.
  if (intent.findCompleted && intent.businessId == null) {
    const reset: PartnerJoinIntent = {
      campaignSlug: intent.campaignSlug,
      doorType: intent.doorType,
      requireFind: true,
      findCompleted: false,
    };
    stashPartnerJoinIntent(reset);
    return reset;
  }

  return intent;
}

/**
 * Seed the 4-step giveback draft so the campaign stays selected after join.
 */
export function seedBusinessJoinDraftForCampaign(
  campaignSlug: string,
  door: BusinessDoor,
) {
  const existing = loadBusinessJoinDraft() ?? defaultBusinessJoinDraft(door);
  saveBusinessJoinDraft({
    ...existing,
    door,
    causeMode: "pick_now",
    selectedCampaignSlug: campaignSlug,
  });
}

/**
 * Start public-campaign join: stash intent and open Find My Restaurant flow,
 * or Send join request when this browser already has a signed-in business.
 * Does not auto-submit a join request (that happens after confirm on send screen).
 */
export function beginPublicCampaignPartnerJoin(input: {
  campaignSlug: string;
  doorType: PartnerJoinDoorType;
}): { nextStep: "business-giveback-join" | "partner-campaign-join" } {
  stashBusinessDoor(input.doorType);
  seedBusinessJoinDraftForCampaign(input.campaignSlug, input.doorType);
  try {
    sessionStorage.setItem("forkup-auth-return-step", "partner-campaign-join");
    sessionStorage.setItem("forkup-login-role-hint", "business");
  } catch {
    /* ignore */
  }

  // Already signed in with a business → Send request UI (skip Find).
  if (getAuthToken()) {
    try {
      const raw = sessionStorage.getItem("forkup-user-session");
      if (raw) {
        const session = JSON.parse(raw) as {
          userId?: number;
          businessProfile?: { id?: number; locationId?: number } | null;
          businessMemberships?: { id: number; locationId?: number }[];
        };
        const owned =
          session.businessProfile ??
          session.businessMemberships?.[0] ??
          null;
        if (owned?.id && session.userId) {
          stashPartnerJoinIntent({
            campaignSlug: input.campaignSlug,
            doorType: input.doorType,
            requireFind: false,
            findCompleted: true,
            businessId: owned.id,
            locationId: owned.locationId,
            ownerUserId: session.userId,
          });
          return { nextStep: "partner-campaign-join" };
        }
      }
    } catch {
      /* fall through to Find */
    }
  }

  stashPartnerJoinIntent({
    campaignSlug: input.campaignSlug,
    doorType: input.doorType,
    requireFind: true,
    findCompleted: false,
  });
  return { nextStep: "business-giveback-join" };
}

/**
 * Mark Find My Restaurant complete so partner-campaign-join may send the request.
 */
export function markPartnerJoinFindCompleted(opts?: {
  businessId?: number;
  locationId?: number;
  ownerUserId?: number;
}) {
  const intent = readPartnerJoinIntent();
  if (!intent) return;
  stashPartnerJoinIntent({
    ...intent,
    requireFind: false,
    findCompleted: true,
    forceFind: false,
    businessId: opts?.businessId ?? intent.businessId,
    locationId: opts?.locationId ?? intent.locationId,
    ownerUserId: opts?.ownerUserId ?? intent.ownerUserId,
  });
}

/**
 * @deprecated Prefer beginPublicCampaignPartnerJoin — kept for older call sites.
 * Submit a join request when the user already has an authenticated business.
 * Otherwise stash intent and return needsOnboarding.
 */
export async function startPublicCampaignPartnerJoin(input: {
  campaignSlug: string;
  doorType: PartnerJoinDoorType;
}): Promise<
  | { status: "submitted"; request: PartnerJoinRequest }
  | { status: "needsOnboarding" }
  | { status: "error"; message: string }
> {
  beginPublicCampaignPartnerJoin(input);
  return { status: "needsOnboarding" };
}

/**
 * After signup / claim / dashboard load — submit stashed join intent if possible.
 */
export async function flushPendingPartnerJoinRequest(opts?: {
  businessId?: number;
  locationId?: number;
}): Promise<"submitted" | "skipped" | "error"> {
  const intent = readPartnerJoinIntent();
  if (!intent || !getAuthToken()) return "skipped";
  // Do not send until Find My Restaurant / giveback join completed.
  if (intent.requireFind && !intent.findCompleted) return "skipped";

  try {
    let businessId = opts?.businessId ?? intent.businessId;
    let locationId = opts?.locationId ?? intent.locationId;

    if (!businessId) {
      const ctx = await fetchAuthContext();
      const biz = ctx.businessProfile ?? ctx.businessProfiles[0] ?? null;
      if (!biz?.id) return "skipped";
      businessId = biz.id;
      locationId = locationId ?? biz.locations[0]?.id;
    }

    await createPartnerJoinRequest(intent.campaignSlug, {
      businessId,
      locationId,
      doorType: intent.doorType,
    });
    clearPartnerJoinIntent();
    return "submitted";
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    const status =
      err && typeof err === "object" && "status" in err
        ? Number((err as { status?: number }).status)
        : undefined;

    // Duplicate / already partnered — treat as done.
    if (/already pending|already invited|already partnered/i.test(message)) {
      clearPartnerJoinIntent();
      return "submitted";
    }

    // Stale intent (campaign gone) — clear so dashboard stops retrying.
    if (status === 404 && /campaign not found/i.test(message)) {
      clearPartnerJoinIntent();
      return "skipped";
    }

    // Nest "Not Found" usually means API process needs restart after deploy —
    // keep intent so a later visit can retry once routes are live.
    if (status === 404 || /^not found$/i.test(message.trim())) {
      return "skipped";
    }

    console.error("[partner-join] flush failed:", err);
    return "error";
  }
}
