"use client";

/**
 * Claimed nonprofit chooser (Pass 1 — guest-launch plan).
 *
 * Purpose: When a user selects an NPO that is already claimed in ForkUp, do not
 * auto-own it. Offer:
 *   A) Raise money for them (fundraiser AI campaign path)
 *   B) Request access to join their team (existing nonprofit-claim access flow)
 *
 * Inputs: pending org from ai-campaign-flow-storage + campaign context.
 * Outputs: navigation to ai-connect-social (fundraiser) or nonprofit-claim (access).
 */
import { ArrowLeft, HeartHandshake, Megaphone, Users } from "lucide-react";
import { useCampaign } from "@/lib/campaign-context";
import { stashAccountIntent } from "@/lib/campaign-auth";
import { loadAiFlowPendingOrg } from "@/lib/ai-campaign-flow-storage";

/** Same key as EntryFlows NonprofitClaim draft — consumed on nonprofit-claim mount. */
const NONPROFIT_CLAIM_DRAFT_KEY = "forkup-nonprofit-claim-draft";

export function ClaimedNpoChooser() {
  const { goTo, update, state } = useCampaign();
  const pending = loadAiFlowPendingOrg();
  const orgName =
    pending?.organizationName?.trim() ||
    state.nonprofitProfile?.organizationName?.trim() ||
    "This nonprofit";

  const continueAsFundraiser = () => {
    stashAccountIntent("fundraiser");
    update({
      accountIntent: "fundraiser",
      organizerMode: "guided",
      methods: {
        giveback: false,
        donations: true,
        guestBartending: false,
        ambassador: true,
      },
    });
    goTo("ai-connect-social");
  };

  const requestTeamAccess = () => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(
        NONPROFIT_CLAIM_DRAFT_KEY,
        JSON.stringify({
          organizationName: orgName,
          contactName: pending?.contactName?.trim() || "",
          contactEmail: pending?.contactEmail?.trim() || "",
          mission: pending?.mission?.trim() || "",
          website: pending?.website?.trim() || "",
          ein: pending?.ein?.trim() || "",
          city: pending?.city?.trim() || "",
          stateVal: pending?.state?.trim() || "",
          zip: "",
          relationship: "",
          existingSlug: undefined,
          alreadyClaimed: true,
        }),
      );
    }
    stashAccountIntent("nonprofit");
    update({ accountIntent: "nonprofit" });
    goTo("nonprofit-claim");
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg flex-col justify-center px-5 py-10 sm:px-6">
      <button
        type="button"
        onClick={() => goTo("ai-find-org")}
        className="mb-6 inline-flex items-center gap-1.5 self-start text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to search
      </button>

      <p className="text-xs font-semibold uppercase tracking-wide text-primary">
        Already on ForkUp
      </p>
      <h1 className="font-display mt-1 text-3xl font-bold tracking-tight">
        {orgName} already has an account
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        You can&apos;t claim this organization. Choose how you want to continue.
      </p>

      <div className="mt-8 grid gap-4">
        <button
          type="button"
          onClick={continueAsFundraiser}
          className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5 text-left transition-colors hover:border-primary/40"
        >
          <Megaphone className="mt-0.5 size-6 shrink-0 text-primary" />
          <div>
            <p className="font-semibold">Raise money for them</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Build a campaign draft. ForkUp will email the nonprofit&apos;s contact on
              file an invite — they accept and complete paperwork.
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={requestTeamAccess}
          className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5 text-left transition-colors hover:border-primary/40"
        >
          <Users className="mt-0.5 size-6 shrink-0 text-primary" />
          <div>
            <p className="font-semibold">Request access to join their team</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ask their admins to add you as a member. You&apos;ll use your email so
              they can approve the request. After approval you can create campaigns
              as this nonprofit.
            </p>
          </div>
        </button>
      </div>

      <p className="mt-6 flex items-start gap-2 text-xs text-muted-foreground">
        <HeartHandshake className="mt-0.5 size-3.5 shrink-0" />
        Already on their team? Sign in with the account that belongs to this organization.
      </p>
    </main>
  );
}
