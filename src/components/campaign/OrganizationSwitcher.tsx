"use client";

/**
 * OrganizationSwitcher
 * Purpose: Let one account switch the active nonprofit when linked to 2+ NPOs.
 * Inputs: campaign state nonprofitMemberships / nonprofitProfile via useCampaign.
 * Outputs: updates active nonprofit via switchActiveRole, navigates to nonprofit-dashboard.
 */
import { useCampaign } from "@/lib/campaign-context";
import { getAuthToken } from "@/lib/auth-storage";
import { useClientMounted } from "@/lib/use-client-mounted";
import { headerPillClass } from "./SiteHeader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    <div className="relative inline-flex shrink-0 items-center">
      <span className="sr-only">Switch nonprofit organization</span>
      <Select value={String(activeId)} onValueChange={onChange}>
        <SelectTrigger
          className={`${headerPillClass} h-8 max-w-[12rem] cursor-pointer truncate py-1.5 pl-3.5 pr-8 [&>svg]:size-3.5`}
          title="Switch between your nonprofit organizations"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-xl border-border bg-popover">
          {state.nonprofitMemberships.map((n) => (
            <SelectItem
              key={n.id}
              value={String(n.id)}
              className="rounded-lg focus:bg-accent"
            >
              {n.organizationName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
