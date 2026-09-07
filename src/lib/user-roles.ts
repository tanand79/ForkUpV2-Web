/**
 * User experience roles — not separate accounts.
 * fundraiser: raise for nonprofits you don't belong to (invite flow).
 */
import type { StepId } from "@/lib/campaign-context";

/** Active experience context — not a separate account type. */
export type UserRole = "nonprofit" | "business" | "supporter" | "fundraiser";

export interface RoleAvailability {
  nonprofit: boolean;
  business: boolean;
  supporter: boolean;
  fundraiser: boolean;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  nonprofit: "Nonprofit Organizer",
  business: "Business Partner",
  supporter: "Supporter",
  fundraiser: "Fundraiser",
};

export const ROLE_DASHBOARD: Record<UserRole, StepId> = {
  nonprofit: "nonprofit-dashboard",
  business: "business-dashboard",
  supporter: "supporter-dashboard",
  fundraiser: "fundraiser-dashboard",
};

export const ROLE_CLAIM_STEP: Partial<Record<UserRole, StepId>> = {
  nonprofit: "nonprofit-claim",
  business: "business-claim",
};

export function roleAvailability(
  nonprofitCount: number,
  businessCount: number,
  isSignedIn: boolean,
): RoleAvailability {
  return {
    nonprofit: nonprofitCount > 0,
    business: businessCount > 0,
    supporter: isSignedIn,
    fundraiser: isSignedIn,
  };
}

export function availableRoles(avail: RoleAvailability): UserRole[] {
  const roles: UserRole[] = [];
  if (avail.nonprofit) roles.push("nonprofit");
  if (avail.business) roles.push("business");
  if (avail.fundraiser) roles.push("fundraiser");
  if (avail.supporter) roles.push("supporter");
  return roles;
}

export function dashboardStepForRole(
  role: UserRole,
  hasNonprofitMembership: boolean,
  hasBusinessMembership: boolean,
): StepId {
  if (role === "supporter") return ROLE_DASHBOARD.supporter;
  if (role === "fundraiser") return ROLE_DASHBOARD.fundraiser;
  if (role === "business") {
    return hasBusinessMembership ? ROLE_DASHBOARD.business : ROLE_CLAIM_STEP.business!;
  }
  return hasNonprofitMembership ? ROLE_DASHBOARD.nonprofit : ROLE_CLAIM_STEP.nonprofit!;
}

export function resolvePostAuthDestination(
  returnStep: StepId | null,
  roleHint: UserRole | null,
  avail: RoleAvailability,
): StepId {
  if (returnStep && returnStep !== "auth-login") {
    return returnStep;
  }

  if (roleHint) {
    return dashboardStepForRole(roleHint, avail.nonprofit, avail.business);
  }

  const roles = availableRoles(avail);

  if (roles.length > 1) return "account-hub";

  if (avail.nonprofit) return ROLE_DASHBOARD.nonprofit;
  if (avail.business) return ROLE_DASHBOARD.business;
  if (avail.fundraiser) return ROLE_DASHBOARD.fundraiser;
  if (avail.supporter) return ROLE_DASHBOARD.supporter;

  return "account-hub";
}

export function pickDefaultActiveRole(
  avail: RoleAvailability,
  hint: UserRole | null,
  previous: UserRole | null,
): UserRole {
  if (
    hint === "nonprofit" ||
    hint === "business" ||
    hint === "supporter" ||
    hint === "fundraiser"
  ) {
    return hint;
  }
  if (
    previous &&
    ((previous === "nonprofit" && avail.nonprofit) ||
      (previous === "business" && avail.business) ||
      previous === "supporter" ||
      (previous === "fundraiser" && avail.fundraiser))
  ) {
    return previous;
  }
  if (avail.business) return "business";
  if (avail.nonprofit) return "nonprofit";
  if (avail.fundraiser) return "fundraiser";
  return "supporter";
}

/** Dashboard steps that should match the user's active role. */
export const ROLE_HOME_DASHBOARD_STEPS: StepId[] = [
  "nonprofit-dashboard",
  "business-dashboard",
  "supporter-dashboard",
  "fundraiser-dashboard",
];
