"use client";

import { ChevronDown } from "lucide-react";
import { useCampaign } from "@/lib/campaign-context";
import { getAuthToken } from "@/lib/auth-storage";
import { useClientMounted } from "@/lib/use-client-mounted";
import { stashDashboardReturn, stashRoleHint } from "@/lib/campaign-auth";
import { isForeignNonprofitTarget } from "@/lib/foreign-nonprofit-target";
import {
  ROLE_CLAIM_STEP,
  ROLE_DASHBOARD,
  ROLE_LABELS,
  roleAvailability,
  type UserRole,
} from "@/lib/user-roles";
import { headerPillClass } from "./SiteHeader";

const ALL_ROLES: UserRole[] = ["nonprofit", "business", "fundraiser", "supporter"];

function roleLabel(role: UserRole, hasMembership: boolean): string {
  if (role === "nonprofit" && !hasMembership) return `${ROLE_LABELS.nonprofit} (set up)`;
  if (role === "business" && !hasMembership) return `${ROLE_LABELS.business} (set up)`;
  return ROLE_LABELS[role];
}

export function RoleSwitcher() {
  const { state, switchActiveRole, goTo } = useCampaign();
  const mounted = useClientMounted();

  if (!mounted || !getAuthToken()) return null;

  const avail = roleAvailability(
    state.nonprofitMemberships.length,
    state.businessMemberships.length,
    true,
  );

  const foreignDraft = isForeignNonprofitTarget(
    state.nonprofitProfile,
    state.nonprofitMemberships,
  );

  const active = foreignDraft
    ? "fundraiser"
    : state.accountIntent ??
      (avail.business && !avail.nonprofit
        ? "business"
        : avail.nonprofit
          ? "nonprofit"
          : avail.business
            ? "business"
            : "supporter");

  const navigateRole = (role: UserRole) => {
    // Draft for another NPO while this email already owns one → stay fundraiser.
    // Switching to Nonprofit Organizer would attach create/launch to the wrong org.
    if (
      role === "nonprofit" &&
      isForeignNonprofitTarget(state.nonprofitProfile, state.nonprofitMemberships)
    ) {
      switchActiveRole("fundraiser");
      stashRoleHint("fundraiser");
      goTo("ai-campaign-preview");
      return;
    }

    switchActiveRole(role);
    stashRoleHint(role);

    if (role === "nonprofit" && !avail.nonprofit) {
      goTo(ROLE_CLAIM_STEP.nonprofit!);
      return;
    }
    if (role === "business" && !avail.business) {
      goTo(ROLE_CLAIM_STEP.business!);
      return;
    }
    const dashboard = ROLE_DASHBOARD[role];
    stashDashboardReturn(dashboard, role);
    goTo(dashboard);
  };

  return (
    <label className="relative inline-flex shrink-0 items-center">
      <span className="sr-only">Switch role</span>
      <select
        value={active}
        onChange={(e) => navigateRole(e.target.value as UserRole)}
        className={`${headerPillClass} h-8 max-w-[11.5rem] cursor-pointer appearance-none truncate py-1.5 pl-3.5 pr-8`}
        title={
          foreignDraft
            ? "Raising for another nonprofit — stay on Fundraiser to send an invite"
            : "Switch between nonprofit, business, fundraiser, and supporter"
        }
      >
        {ALL_ROLES.map((role) => (
          <option key={role} value={role}>
            {roleLabel(
              role,
              role === "nonprofit" ? avail.nonprofit : role === "business" ? avail.business : true,
            )}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-muted-foreground" />
    </label>
  );
}
