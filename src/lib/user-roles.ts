import type { StepId } from "@/lib/campaign-context";

/** Active experience context — not a separate account type. */
export type UserRole = "nonprofit" | "business" | "supporter";

export interface RoleAvailability {
  nonprofit: boolean;
  business: boolean;
  supporter: boolean;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  nonprofit: "Nonprofit Organizer",
  business: "Business Partner",
  supporter: "Supporter",
};

export const ROLE_DASHBOARD: Record<UserRole, StepId> = {
  nonprofit: "nonprofit-dashboard",
  business: "business-dashboard",
  supporter: "supporter-dashboard",
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
  };
}

export function availableRoles(avail: RoleAvailability): UserRole[] {
  const roles: UserRole[] = [];
  if (avail.nonprofit) roles.push("nonprofit");
  if (avail.business) roles.push("business");
  if (avail.supporter) roles.push("supporter");
  return roles;
}

export function dashboardStepForRole(
  role: UserRole,
  hasNonprofitMembership: boolean,
  hasBusinessMembership: boolean,
): StepId {
  if (role === "supporter") return ROLE_DASHBOARD.supporter;
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
  if (roleHint) {
    return ROLE_DASHBOARD[roleHint];
  }

  if (returnStep && returnStep !== "auth-login") {
    return returnStep;
  }

  const roles = availableRoles(avail);

  if (roles.length > 1) return "account-hub";

  if (avail.nonprofit) return ROLE_DASHBOARD.nonprofit;
  if (avail.business) return ROLE_DASHBOARD.business;
  if (avail.supporter) return ROLE_DASHBOARD.supporter;

  return "account-hub";
}

export function pickDefaultActiveRole(
  avail: RoleAvailability,
  hint: UserRole | null,
  previous: UserRole | null,
): UserRole {
  if (hint === "nonprofit" || hint === "business" || hint === "supporter") {
    return hint;
  }
  if (previous && ((previous === "nonprofit" && avail.nonprofit) || (previous === "business" && avail.business) || previous === "supporter")) {
    return previous;
  }
  if (avail.nonprofit) return "nonprofit";
  if (avail.business) return "business";
  return "supporter";
}
