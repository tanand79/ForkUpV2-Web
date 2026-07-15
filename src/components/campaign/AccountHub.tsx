"use client";

import { ArrowRight, HeartHandshake, Plus, Store, Users } from "lucide-react";
import { useCampaign } from "@/lib/campaign-context";
import { getAuthToken } from "@/lib/auth-storage";
import {
  ROLE_DASHBOARD,
  ROLE_LABELS,
  ROLE_CLAIM_STEP,
  roleAvailability,
  type UserRole,
} from "@/lib/user-roles";
import { stashRoleHint } from "@/lib/campaign-auth";

const ROLE_ICONS: Record<UserRole, typeof HeartHandshake> = {
  nonprofit: HeartHandshake,
  business: Store,
  supporter: Users,
};

export function AccountHub() {
  const { goTo, state, switchActiveRole } = useCampaign();
  const signedIn = Boolean(getAuthToken());

  const avail = roleAvailability(
    state.nonprofitMemberships.length,
    state.businessMemberships.length,
    signedIn,
  );

  const openRole = (role: UserRole) => {
    switchActiveRole(role);
    if (role === "nonprofit" && !avail.nonprofit) {
      stashRoleHint("nonprofit");
      goTo(ROLE_CLAIM_STEP.nonprofit!);
      return;
    }
    if (role === "business" && !avail.business) {
      stashRoleHint("business");
      goTo(ROLE_CLAIM_STEP.business!);
      return;
    }
    goTo(ROLE_DASHBOARD[role]);
  };

  const cards: {
    role: UserRole;
    title: string;
    description: string;
    action: string;
    available: boolean;
  }[] = [
    {
      role: "nonprofit",
      title: ROLE_LABELS.nonprofit,
      description: avail.nonprofit
        ? state.nonprofitProfile?.organizationName ?? "Manage fundraising campaigns"
        : "Set up your nonprofit organization to launch campaigns",
      action: avail.nonprofit ? "Open dashboard" : "Set up organization",
      available: true,
    },
    {
      role: "business",
      title: ROLE_LABELS.business,
      description: avail.business
        ? state.businessProfile?.businessName ?? "Manage business partnerships"
        : "Claim your business to accept invitations and partner with nonprofits",
      action: avail.business ? "Open dashboard" : "Claim business",
      available: true,
    },
    {
      role: "supporter",
      title: ROLE_LABELS.supporter,
      description: "Browse live campaigns, participate locally, upload receipts, and donate",
      action: "View supporter activity",
      available: signedIn,
    },
  ];

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 pb-24 sm:px-6 sm:py-12">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">Your account</p>
      <h1 className="font-display mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">
        Choose how you&apos;re using ForkUp
      </h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        One login — switch anytime between nonprofit organizer, business partner, and supporter
        activity. Only roles you&apos;ve set up or been invited to will show full dashboards.
      </p>

      <div className="mt-8 grid gap-4">
        {cards.map(({ role, title, description, action, available }) => {
          if (!available) return null;
          const Icon = ROLE_ICONS[role];
          return (
            <button
              key={role}
              type="button"
              onClick={() => openRole(role)}
              className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5 text-left transition-colors hover:border-primary/40"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-semibold">{title}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{description}</span>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                  {action} <ArrowRight className="size-4" />
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <section className="mt-10 rounded-2xl border border-dashed border-border bg-card/50 p-5">
        <p className="text-sm font-semibold">Add another role</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Already a nonprofit organizer? You can still claim a business profile with the same email.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {!avail.nonprofit && (
            <button
              type="button"
              onClick={() => openRole("nonprofit")}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:border-primary/40"
            >
              <Plus className="size-4" /> Add nonprofit
            </button>
          )}
          {!avail.business && (
            <button
              type="button"
              onClick={() => openRole("business")}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:border-primary/40"
            >
              <Plus className="size-4" /> Add business
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
