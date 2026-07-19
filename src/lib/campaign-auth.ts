import type { StepId } from "@/lib/campaign-context";
import { isStepId } from "@/lib/campaign-routes";
import { getAuthToken } from "@/lib/auth-storage";
import {
  dashboardStepForRole,
  resolvePostAuthDestination,
  roleAvailability,
  type UserRole,
} from "@/lib/user-roles";

const RETURN_KEY = "forkup-auth-return-step";
const ROLE_HINT_KEY = "forkup-login-role-hint";
const DASHBOARD_RETURN_KEY = "forkup-dashboard-return-step";

/** @deprecated Use UserRole from user-roles.ts */
export type AccountIntent = UserRole;

const BUSINESS_STEPS: StepId[] = ["business-claim", "business-invites-nonprofit", "business-dashboard"];

const DASHBOARD_STEPS: StepId[] = [
  "nonprofit-dashboard",
  "business-dashboard",
  "supporter-dashboard",
  "account-hub",
];

/** Screens that require a signed-in ForkUp account. */
export const CAMPAIGN_AUTH_STEPS: StepId[] = [
  "start",
  "account-hub",
  "nonprofit-claim",
  "nonprofit-dashboard",
  "business-dashboard",
  "supporter-dashboard",
  "business-claim",
  "business-invites-nonprofit",
  "choose-organizer-mode",
  "quick-start",
  "methods",
  "details",
  "businesses",
  "invite",
  "edit-invite",
  "business-invite-flow",
  "media",
  "review",
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
  currentStep?: StepId,
): StepId {
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
    (currentStep ? roleHintFromStep(currentStep) : null);

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
  if (raw === "nonprofit" || raw === "business" || raw === "supporter") return raw;
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

