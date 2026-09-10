"use client";

/**
 * OrganizationSwitcher
 * Purpose: Let one account switch the active nonprofit when linked to 2+ NPOs.
 * Inputs: campaign state nonprofitMemberships / nonprofitProfile via useCampaign.
 * Outputs: updates active nonprofit via switchActiveRole, navigates to nonprofit-dashboard.
 */
import { ChevronDown } from "lucide-react";
import { useCampaign } from "@/lib/campaign-context";
import { getAuthToken } from "@/lib/auth-storage";
import { useClientMounted } from "@/lib/use-client-mounted";
import { headerPillClass } from "./SiteHeader";

export function OrganizationSwitcher() {
  const { state, switchActiveRole, goTo } = useCampaign();
  const mounted = useClientMounted();

  if (!mounted || !getAuthToken()) return null;
  if (state.nonprofitMemberships.length < 2) return null;

  const activeId = state.nonprofitProfile?.id ?? state.nonprofitMemberships[0]?.id ?? "";

  const onChange = (raw: string) => {
    const id = Number(raw);
    if (!Number.isFinite(id) || id <= 0) return;
    if (id === state.nonprofitProfile?.id) return;
    switchActiveRole("nonprofit", id);
    goTo("nonprofit-dashboard");
  };

  return (
    <label className="relative inline-flex shrink-0 items-center">
      <span className="sr-only">Switch nonprofit organization</span>
      <select
        value={String(activeId)}
        onChange={(e) => onChange(e.target.value)}
        className={`${headerPillClass} h-8 max-w-[12rem] cursor-pointer appearance-none truncate py-1.5 pl-3.5 pr-8`}
        title="Switch between your nonprofit organizations"
      >
        {state.nonprofitMemberships.map((n) => (
          <option key={n.id} value={String(n.id)}>
            {n.organizationName}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-muted-foreground" />
    </label>
  );
}
