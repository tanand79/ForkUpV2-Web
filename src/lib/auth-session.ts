import type {
  BusinessProfileState,
  NonprofitProfileState,
} from "@/lib/campaign-context";
import type { AccountIntent } from "@/lib/campaign-auth";
import {
  fetchAuthContext,
  type AuthContextResponse,
  type BusinessProfile,
  type NonprofitProfile,
} from "@/lib/api";
import { getAuthToken, setAuthToken } from "@/lib/auth-storage";
import {
  pickDefaultActiveRole,
  roleAvailability,
  type UserRole,
} from "@/lib/user-roles";

const SESSION_KEY = "forkup-user-session";
const ACTIVE_ROLE_KEY = "forkup-active-role";
const ACTIVE_NP_KEY = "forkup-active-nonprofit-id";
const ACTIVE_BIZ_KEY = "forkup-active-business-id";

export interface UserSession {
  userId: number;
  email: string;
  /** Active UI context — same login, switchable role. */
  activeRole: UserRole | null;
  /** @deprecated Use activeRole */
  accountIntent: UserRole | null;
  nonprofitMemberships: NonprofitProfileState[];
  businessMemberships: BusinessProfileState[];
  activeNonprofitId: number | null;
  activeBusinessId: number | null;
  /** Active nonprofit for campaign builder / dashboard */
  nonprofitProfile: NonprofitProfileState | null;
  /** Active business for business dashboard */
  businessProfile: BusinessProfileState | null;
}

let syncInFlight: Promise<UserSession | null> | null = null;
let lastSyncedAt = 0;
const SYNC_COOLDOWN_MS = 5000;

function mapNonprofitToState(np: NonprofitProfile): NonprofitProfileState {
  return {
    id: np.id,
    organizationName: np.organizationName,
    contactName: np.contactName ?? np.organizationName,
    contactEmail: np.contactEmail ?? "",
    mission: np.mission ?? undefined,
    causeCategory: np.causeCategory ?? undefined,
    verificationStatus: np.verificationStatus,
    claimStatus: np.claimStatus,
    accessRequestStatus: np.accessRequestStatus ?? null,
  };
}

function mapBusinessToState(biz: BusinessProfile): BusinessProfileState | null {
  const loc = biz.locations[0];
  if (!loc) return null;
  return {
    id: biz.id,
    businessName: biz.businessName,
    contactName: biz.contactName ?? biz.businessName,
    contactEmail: biz.contactEmail ?? "",
    locationId: loc.id,
    locationName: loc.locationName,
    capabilities: biz.capabilities,
    claimStatus: biz.claimStatus,
    businessStatus: biz.businessStatus,
    accessRequestStatus: biz.accessRequestStatus ?? null,
  };
}

function mapNonprofits(context: AuthContextResponse): NonprofitProfileState[] {
  const source =
    context.nonprofitProfiles?.length
      ? context.nonprofitProfiles
      : context.nonprofitProfile
        ? [context.nonprofitProfile]
        : [];
  return source.map(mapNonprofitToState);
}

function mapBusinesses(context: AuthContextResponse): BusinessProfileState[] {
  const source =
    context.businessProfiles?.length
      ? context.businessProfiles
      : context.businessProfile
        ? [context.businessProfile]
        : [];
  return source.map(mapBusinessToState).filter((b): b is BusinessProfileState => b !== null);
}

export function getStoredActiveRole(): UserRole | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(ACTIVE_ROLE_KEY);
  if (raw === "nonprofit" || raw === "business" || raw === "supporter" || raw === "fundraiser")
    return raw;
  return null;
}

/** Role hint when starting a flow (claim, login return path). Not a separate account. */
export function getStoredAccountIntent(): UserRole | null {
  return getStoredActiveRole();
}

function persistActiveRole(role: UserRole | null) {
  if (typeof window === "undefined") return;
  if (role) sessionStorage.setItem(ACTIVE_ROLE_KEY, role);
  else sessionStorage.removeItem(ACTIVE_ROLE_KEY);
}

function persistActiveOrgIds(nonprofitId: number | null, businessId: number | null) {
  if (typeof window === "undefined") return;
  if (nonprofitId != null) sessionStorage.setItem(ACTIVE_NP_KEY, String(nonprofitId));
  else sessionStorage.removeItem(ACTIVE_NP_KEY);
  if (businessId != null) sessionStorage.setItem(ACTIVE_BIZ_KEY, String(businessId));
  else sessionStorage.removeItem(ACTIVE_BIZ_KEY);
}

function loadActiveOrgIds(): { nonprofitId: number | null; businessId: number | null } {
  if (typeof window === "undefined") {
    return { nonprofitId: null, businessId: null };
  }
  const np = sessionStorage.getItem(ACTIVE_NP_KEY);
  const biz = sessionStorage.getItem(ACTIVE_BIZ_KEY);
  return {
    nonprofitId: np ? Number(np) : null,
    businessId: biz ? Number(biz) : null,
  };
}

export function persistUserSession(session: UserSession) {
  if (typeof window === "undefined") return;
  persistActiveRole(session.activeRole);
  persistActiveOrgIds(session.activeNonprofitId, session.activeBusinessId);
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* ignore */
  }
}

export function loadUserSession(): UserSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserSession;
    return {
      ...parsed,
      activeRole: parsed.activeRole ?? parsed.accountIntent ?? null,
      accountIntent: parsed.activeRole ?? parsed.accountIntent ?? null,
      nonprofitMemberships: parsed.nonprofitMemberships ?? (parsed.nonprofitProfile ? [parsed.nonprofitProfile] : []),
      businessMemberships: parsed.businessMemberships ?? (parsed.businessProfile ? [parsed.businessProfile] : []),
    };
  } catch {
    return null;
  }
}

export function clearUserSession() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SESSION_KEY);
    window.localStorage.removeItem("forkup-nonprofit-profile");
    window.localStorage.removeItem("forkup-business-profile");
    // Stale drafts often hold pre-reset business/nonprofit ids after db:reset.
    window.localStorage.removeItem("forkup-campaign-draft");
    window.localStorage.removeItem("forkup-ai-campaign-flow");
    window.localStorage.removeItem("forkup-ai-campaign-flow-pending");
  } catch {
    /* ignore */
  }
  sessionStorage.removeItem(ACTIVE_ROLE_KEY);
  sessionStorage.removeItem(ACTIVE_NP_KEY);
  sessionStorage.removeItem(ACTIVE_BIZ_KEY);
}

function pickActiveProfiles(
  nonprofits: NonprofitProfileState[],
  businesses: BusinessProfileState[],
  _activeRole: UserRole | null,
  preferredNpId: number | null,
  preferredBizId: number | null,
) {
  const nonprofitProfile =
    nonprofits.find((n) => n.id === preferredNpId) ?? nonprofits[0] ?? null;
  const businessProfile =
    businesses.find((b) => b.id === preferredBizId) ?? businesses[0] ?? null;

  return {
    nonprofitProfile,
    businessProfile,
    activeNonprofitId: nonprofitProfile?.id ?? null,
    activeBusinessId: businessProfile?.id ?? null,
  };
}

export function applyAuthContext(
  context: AuthContextResponse,
  roleHint: AccountIntent | null,
): UserSession {
  const nonprofitMemberships = mapNonprofits(context);
  const businessMemberships = mapBusinesses(context);
  const stored = loadUserSession();
  const orgIds = loadActiveOrgIds();

  const avail = roleAvailability(
    nonprofitMemberships.length,
    businessMemberships.length,
    true,
  );

  const activeRole = pickDefaultActiveRole(
    avail,
    roleHint ?? getStoredActiveRole(),
    stored?.activeRole ?? stored?.accountIntent ?? null,
  );

  const { nonprofitProfile, businessProfile, activeNonprofitId, activeBusinessId } =
    pickActiveProfiles(
      nonprofitMemberships,
      businessMemberships,
      activeRole,
      orgIds.nonprofitId ?? stored?.activeNonprofitId ?? null,
      orgIds.businessId ?? stored?.activeBusinessId ?? null,
    );

  const session: UserSession = {
    userId: context.user.id,
    email: context.user.email,
    activeRole,
    accountIntent: activeRole,
    nonprofitMemberships,
    businessMemberships,
    activeNonprofitId,
    activeBusinessId,
    nonprofitProfile,
    businessProfile,
  };

  persistUserSession(session);
  return session;
}

/** True when session data would not change app state. */
export function sessionMatchesState(
  session: UserSession,
  current: {
    accountIntent: AccountIntent | null;
    nonprofitProfile: NonprofitProfileState | null;
    businessProfile: BusinessProfileState | null;
    nonprofitMemberships?: NonprofitProfileState[];
    businessMemberships?: BusinessProfileState[];
  },
): boolean {
  const membershipsMatch =
    (session.nonprofitMemberships?.length ?? 0) === (current.nonprofitMemberships?.length ?? 0) &&
    (session.businessMemberships?.length ?? 0) === (current.businessMemberships?.length ?? 0);

  return (
    membershipsMatch &&
    session.activeRole === current.accountIntent &&
    session.nonprofitProfile?.id === current.nonprofitProfile?.id &&
    session.nonprofitProfile?.verificationStatus === current.nonprofitProfile?.verificationStatus &&
    session.nonprofitProfile?.accessRequestStatus === current.nonprofitProfile?.accessRequestStatus &&
    session.businessProfile?.id === current.businessProfile?.id &&
    session.businessProfile?.claimStatus === current.businessProfile?.claimStatus &&
    session.businessProfile?.accessRequestStatus === current.businessProfile?.accessRequestStatus
  );
}

export async function syncAuthSession(
  roleHint?: AccountIntent | null,
  options?: { force?: boolean },
): Promise<UserSession | null> {
  if (!getAuthToken()) {
    clearUserSession();
    syncInFlight = null;
    return null;
  }

  const force = options?.force ?? false;
  const now = Date.now();

  if (!force && syncInFlight) {
    return syncInFlight;
  }

  if (!force && now - lastSyncedAt < SYNC_COOLDOWN_MS) {
    return loadUserSession();
  }

  syncInFlight = (async () => {
    try {
      const context = await fetchAuthContext();
      const stored = loadUserSession();

      if (stored && stored.userId !== context.user.id) {
        clearUserSession();
      }

      const session = applyAuthContext(
        context,
        roleHint ?? getStoredActiveRole() ?? stored?.activeRole ?? null,
      );
      lastSyncedAt = Date.now();
      return session;
    } catch (err) {
      /**
       * After db:reset auth_sessions/users are gone. Keeping a cached session
       * shows empty dashboards / wrong org ids — clear on auth failure.
       */
      const status = (err as Error & { status?: number })?.status;
      const message = err instanceof Error ? err.message : "";
      if (
        status === 401 ||
        status === 403 ||
        /not authenticated|unauthorized|invalid token|invalid session/i.test(message)
      ) {
        clearAuthAndSession();
        return null;
      }
      return loadUserSession();
    } finally {
      syncInFlight = null;
    }
  })();

  return syncInFlight;
}

export function clearAuthAndSession() {
  setAuthToken(null);
  clearUserSession();
  syncInFlight = null;
  lastSyncedAt = 0;
}

export function buildSessionPatch(session: UserSession): {
  accountIntent: UserRole | null;
  nonprofitMemberships: NonprofitProfileState[];
  businessMemberships: BusinessProfileState[];
  nonprofitProfile: NonprofitProfileState | null;
  businessProfile: BusinessProfileState | null;
  activeNonprofitId: number | null;
  activeBusinessId: number | null;
} {
  return {
    accountIntent: session.activeRole,
    nonprofitMemberships: session.nonprofitMemberships,
    businessMemberships: session.businessMemberships,
    nonprofitProfile: session.nonprofitProfile,
    businessProfile: session.businessProfile,
    activeNonprofitId: session.activeNonprofitId,
    activeBusinessId: session.activeBusinessId,
  };
}
