import type { StepId } from "@/lib/campaign-context";
import { isStepId } from "@/lib/campaign-routes";
import { getAuthToken } from "@/lib/auth-storage";
import {
  dashboardStepForRole,
  resolvePostAuthDestination,
  roleAvailability,
  type UserRole,
} from "@/lib/user-roles";
import { stashPartnerJoinExistingLogin } from "@/lib/partner-join-intent";

const RETURN_KEY = "forkup-auth-return-step";
const ROLE_HINT_KEY = "forkup-login-role-hint";
const DASHBOARD_RETURN_KEY = "forkup-dashboard-return-step";

/** @deprecated Use UserRole from user-roles.ts */
export type AccountIntent = UserRole;

const BUSINESS_STEPS: StepId[] = [
  "business-claim",
  "business-ai-onboarding",
  "business-giveback-join",
  "partner-campaign-join",
  "business-invites-nonprofit",
  "business-dashboard",
  "ach-settings",
  "guest-business-claim",
];

const DASHBOARD_STEPS: StepId[] = [
  "nonprofit-dashboard",
  "business-dashboard",
  "supporter-dashboard",
  "fundraiser-dashboard",
  "account-hub",
];

/** Screens that require a signed-in ForkUp account. */
export const CAMPAIGN_AUTH_STEPS: StepId[] = [
  "start",
  "account-hub",
  // nonprofit-claim is intentionally public for org search (Lovable parity).
  // Auth is enforced inside NonprofitClaim on submit before claim/save.
  "nonprofit-dashboard",
  "fundraiser-dashboard",
  "business-dashboard",
  "ach-settings",
  "supporter-dashboard",
  "business-claim",
  "business-invites-nonprofit",
  "partner-campaign-join",
  "choose-organizer-mode",
  // Guest may build Online Donations + Ambassador drafts (3-word Quick Start + review).
  // Launch / business partners / settlement still require auth via later steps.
  "methods",
  "details",
  "businesses",
  "invite",
  "edit-invite",
  "business-invite-flow",
  "media",
  // Pass 2: review/launch allowed without signup (guest email claim instead).
  // "review" intentionally omitted from auth-required list.
  "created",
  "dashboard",
  "receipt-ocr",
  "reporting",
  "success-engine",
  "ambassador",
  "guestBartending",
];

export function isCampaignAuthenticated(): boolean {
  return Boolean(getAuthToken());
}

export function stepRequiresAuth(step: StepId): boolean {
  return CAMPAIGN_AUTH_STEPS.includes(step);
}

export function roleHintFromStep(step: StepId): UserRole | null {
  if (BUSINESS_STEPS.includes(step)) return "business";
  if (step === "supporter-dashboard") return "supporter";
  if (
    step === "nonprofit-dashboard" ||
    step === "nonprofit-claim" ||
    step === "start" ||
    step === "choose-organizer-mode" ||
    step === "quick-start" ||
    step === "campaign-review" ||
    step === "ai-find-org" ||
    step === "claimed-npo-chooser" ||
    step === "ai-connect-social" ||
    step === "ai-analyzing" ||
    step === "ai-campaign-ideas" ||
    step === "ai-campaign-purpose" ||
    step === "ai-campaign-build" ||
    step === "ai-campaign-dates" ||
    step === "ai-campaign-preview" ||
    step === "ai-continue-guest" ||
    step === "guest-launch-sent" ||
    step === "guest-campaign-claim" ||
    step === "guest-business-claim" ||
    step === "fundraiser-invite-sent" ||
    step === "methods"
  ) {
    return "nonprofit";
  }
  return null;
}

/** Remember which dashboard the user was on (survives Back to home). */
export function stashDashboardReturn(step: StepId, role?: UserRole | null) {
  if (typeof window === "undefined") return;
  if (!DASHBOARD_STEPS.includes(step)) return;
  sessionStorage.setItem(DASHBOARD_RETURN_KEY, step);
  const hint = role ?? roleHintFromStep(step);
  if (hint) stashRoleHint(hint);
}

export function getDashboardReturn(): StepId | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(DASHBOARD_RETURN_KEY);
  if (raw && isStepId(raw) && DASHBOARD_STEPS.includes(raw)) return raw;
  return null;
}

export function resolveDashboardStep(
  accountIntent: UserRole | null,
  hasNonprofitMembership: boolean,
  hasBusinessMembership: boolean,
  _currentStep?: StepId,
): StepId {
  // Active role always wins — avoids nonprofit dashboard when user is in business context.
  if (accountIntent) {
    return dashboardStepForRole(
      accountIntent,
      hasNonprofitMembership,
      hasBusinessMembership,
    );
  }

  const storedReturn = getDashboardReturn();
  if (storedReturn) {
    if (storedReturn === "business-dashboard" && hasBusinessMembership) return storedReturn;
    if (storedReturn === "nonprofit-dashboard" && hasNonprofitMembership) return storedReturn;
    if (storedReturn === "supporter-dashboard") return storedReturn;
    if (storedReturn === "account-hub") return storedReturn;
  }

  const role =
    accountIntent ??
    getRoleHint() ??
    (_currentStep ? roleHintFromStep(_currentStep) : null);

  if (!role) return "account-hub";
  return dashboardStepForRole(role, hasNonprofitMembership, hasBusinessMembership);
}

/** @deprecated Use stashRoleHint */
export function stashAccountIntent(intent: AccountIntent) {
  stashRoleHint(intent);
}

export function stashRoleHint(role: UserRole) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(ROLE_HINT_KEY, role);
}

export function getRoleHint(): UserRole | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(ROLE_HINT_KEY);
  if (raw === "nonprofit" || raw === "business" || raw === "supporter" || raw === "fundraiser")
    return raw;
  return null;
}

/** @deprecated Use getRoleHint */
export function getAccountIntent(): UserRole | null {
  return getRoleHint();
}

export function consumeRoleHint(): UserRole | null {
  if (typeof window === "undefined") return null;
  const hint = getRoleHint();
  sessionStorage.removeItem(ROLE_HINT_KEY);
  return hint;
}

/** @deprecated Use consumeRoleHint */
export function consumeAccountIntent(): UserRole | null {
  return consumeRoleHint();
}

export function stashAuthReturnStep(step: StepId) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(RETURN_KEY, step);
  const hint = roleHintFromStep(step);
  if (hint) stashRoleHint(hint);
}

export function consumeAuthReturnStep(): StepId | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(RETURN_KEY);
  sessionStorage.removeItem(RETURN_KEY);
  if (raw && isStepId(raw)) return raw;
  return null;
}

const AUTH_INITIAL_MODE_KEY = "forkup-auth-initial-mode";
/** Guest/claim flows: signup must use this email only (prefill + lock). */
const CLAIM_LOCK_EMAIL_KEY = "forkup-claim-lock-email";

/**
 * Remember the email that owns a guest claim / draft before signup.
 * Inputs: raw email. Outputs: stored normalized when valid.
 */
export function stashClaimLockEmail(email: string) {
  if (typeof window === "undefined") return;
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) return;
  sessionStorage.setItem(CLAIM_LOCK_EMAIL_KEY, normalized);
}

/**
 * Read claim/draft lock email without clearing (signup screen prefill).
 * Inputs: none. Outputs: normalized email or null.
 */
export function peekClaimLockEmail(): string | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(CLAIM_LOCK_EMAIL_KEY)?.trim().toLowerCase() || "";
  return raw.includes("@") ? raw : null;
}

/**
 * Clear claim/draft lock email after claim or finished auth.
 * Inputs: none. Outputs: session key removed.
 */
export function clearClaimLockEmail() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(CLAIM_LOCK_EMAIL_KEY);
}

/** Open sign-up after guest Join Us — return to partner join or dashboard. */
export function prepareBusinessJoinAuth() {
  stashRoleHint("business");
  if (typeof window === "undefined") return;
  sessionStorage.setItem(AUTH_INITIAL_MODE_KEY, "register");
  // Prefer returning to the public-campaign join flow when that intent is active.
  try {
    const raw = sessionStorage.getItem("forkup-partner-join-intent");
    if (raw) {
      const parsed = JSON.parse(raw) as { campaignSlug?: string };
      if (parsed?.campaignSlug) {
        stashAuthReturnStep("partner-campaign-join");
        return;
      }
    }
  } catch {
    /* fall through */
  }
  stashAuthReturnStep("business-dashboard");
}

/**
 * Existing ForkUp business signing in from public-campaign join (Find screen).
 * Opens login (not register) and returns to partner-campaign-join.
 */
export function prepareExistingBusinessPartnerJoinAuth() {
  stashRoleHint("business");
  if (typeof window === "undefined") return;
  sessionStorage.setItem(AUTH_INITIAL_MODE_KEY, "login");
  stashAuthReturnStep("partner-campaign-join");
  stashPartnerJoinExistingLogin();
}

/**
 * Destination for "Join as Business" — guest-first 4-step giveback join (Pass D2).
 */
export function stepForBusinessJoin(
  isAuthenticated: boolean,
  hasBusinessProfile: boolean,
): StepId {
  stashRoleHint("business");
  if (isAuthenticated && hasBusinessProfile) {
    return "business-dashboard";
  }
  return "business-giveback-join";
}

/** Existing business accounts should not re-run AI claim onboarding after sign-in. */
export function shouldSkipBusinessAiOnboarding(
  businessMembershipCount: number,
  hasBusinessProfile: boolean,
): boolean {
  return businessMembershipCount > 0 || hasBusinessProfile;
}

export function readAuthInitialMode(): "login" | "register" | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(AUTH_INITIAL_MODE_KEY);
  if (raw === "login" || raw === "register") {
    sessionStorage.removeItem(AUTH_INITIAL_MODE_KEY);
    return raw;
  }
  return null;
}

export function resolvePostAuthStep(
  returnStep: StepId | null,
  roleHint: UserRole | null,
  nonprofitCount: number,
  businessCount: number,
): StepId {
  const avail = roleAvailability(nonprofitCount, businessCount, true);
  return resolvePostAuthDestination(returnStep, roleHint, avail);
}

export function dashboardStepForAccount(
  activeRole: UserRole | null,
  hasNonprofitMembership: boolean,
  hasBusinessMembership: boolean,
): StepId {
  if (!activeRole) return "account-hub";
  return dashboardStepForRole(activeRole, hasNonprofitMembership, hasBusinessMembership);
}

export const ACCOUNT_INTENT_COPY: Record<
  AccountIntent,
  {
    title: string;
    signInDescription: string;
    registerDescription: string;
    fullNamePlaceholder: string;
    registerCta: string;
    signInCta: string;
  }
> = {
  nonprofit: {
    title: "Nonprofit organizer",
    signInDescription:
      "Use your ForkUp account to launch campaigns, invite business partners, and manage your nonprofit dashboard.",
    registerDescription:
      "Create one ForkUp account — you can add nonprofit, business, and supporter roles anytime.",
    fullNamePlaceholder: "Your name",
    registerCta: "Create account",
    signInCta: "Sign in",
  },
  business: {
    title: "Business partner",
    signInDescription:
      "Use your ForkUp account to accept campaign invitations, manage participation, and support local causes.",
    registerDescription:
      "Create one ForkUp account — you can add business partner and other roles later with the same email.",
    fullNamePlaceholder: "Your name (owner or manager)",
    registerCta: "Create account",
    signInCta: "Sign in",
  },
  supporter: {
    title: "Supporter",
    signInDescription:
      "Use your ForkUp account to discover live campaigns, participate locally, and track your impact.",
    registerDescription:
      "Create one ForkUp account to join campaigns and give back — no separate email needed for other roles.",
    fullNamePlaceholder: "Your name",
    registerCta: "Create account",
    signInCta: "Sign in",
  },
  fundraiser: {
    title: "Fundraiser",
    signInDescription:
      "Use your ForkUp account to raise for nonprofits you support and track partnership invites.",
    registerDescription:
      "Create one ForkUp account as a fundraiser — invite nonprofits to campaigns you build for them.",
    fullNamePlaceholder: "Your name",
    registerCta: "Create fundraiser account",
    signInCta: "Sign in",
  },
};

export const UNIFIED_AUTH_COPY = {
  title: "Your ForkUp account",
  description:
    "One email for every role — nonprofit organizer, business partner, and supporter. Sign in once, then switch contexts after login.",
  registerDescription:
    "Create your ForkUp account. You can set up a nonprofit, claim a business, or participate as a supporter — all with the same login.",
  registerCta: "Create account",
  signInCta: "Sign in",
};

