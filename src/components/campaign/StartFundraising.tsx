"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { assetSrc } from "@/lib/utils";
import forkupLogo from "@/assets/forkup-logo.png";
import heroCommunity from "@/assets/hero-community.jpg";
import { useCampaign } from "@/lib/campaign-context";
import { checkNonprofitReadiness } from "@/lib/api";
import { resolveDashboardStep } from "@/lib/campaign-auth";

export function StartFundraising() {
  const { hasDraft, resumeDraft, startNewCampaign, goTo, state, step } = useCampaign();
  const [checking, setChecking] = useState(false);

  const dashboardStep = resolveDashboardStep(
    state.accountIntent,
    state.nonprofitMemberships.length > 0,
    state.businessMemberships.length > 0,
    step,
  );
  const hasDashboard =
    state.nonprofitMemberships.length > 0 || state.businessMemberships.length > 0;

  const beginCampaign = async () => {
    if (!state.nonprofitProfile) {
      goTo("nonprofit-claim");
      return;
    }

    setChecking(true);
    try {
      const readiness = await checkNonprofitReadiness(state.nonprofitProfile.contactEmail);
      if (readiness.state === "preloaded_unclaimed" || readiness.state === "needs_review") {
        goTo("nonprofit-claim");
        return;
      }
      if (hasDraft) resumeDraft();
      else goTo("choose-organizer-mode");
    } catch {
      if (hasDraft) resumeDraft();
      else goTo("choose-organizer-mode");
    } finally {
      setChecking(false);
    }
  };

  return (
    <main className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col justify-center px-5 py-4 sm:px-6">
      <div className="pointer-events-none fixed -left-24 -top-24 size-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-24 -right-24 size-96 rounded-full bg-accent/40 blur-3xl" />

      <div className="animate-rise flex flex-col items-center text-center">
        <img
          src={assetSrc(forkupLogo)}
          alt="ForkUp"
          width={96}
          height={100}
          className="mb-3 h-14 w-auto object-contain"
        />
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">
          Campaign setup
        </p>

        <h1 className="font-display mx-auto mt-2 max-w-2xl text-balance text-3xl font-bold leading-[1.12] tracking-tight sm:text-4xl">
          Let&apos;s build a campaign your community will rally behind!
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground">
          Choose guided step-by-step setup or advanced mode for full control. Save anytime and pick up where you left off.
        </p>

        <button
          type="button"
          onClick={() => void beginCampaign()}
          disabled={checking}
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-9 py-3.5 text-sm font-semibold text-primary-foreground shadow-xl shadow-primary/20 transition-all hover:bg-primary-dark hover:-translate-y-0.5 active:scale-95 disabled:opacity-60"
        >
          {checking ? (
            <Loader2 className="size-4 animate-spin" />
          ) : hasDraft ? (
            "Resume My Campaign"
          ) : state.nonprofitProfile ? (
            "Build My Campaign"
          ) : (
            "Set Up Organization"
          )}
          {!checking && <ArrowRight className="size-4" />}
        </button>
        {hasDashboard && (
          <button
            type="button"
            onClick={() =>
              goTo(
                dashboardStep === "nonprofit-claim" || dashboardStep === "business-claim"
                  ? "account-hub"
                  : dashboardStep,
              )
            }
            className="mt-4 text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            ← Back to your dashboard
          </button>
        )}
        {hasDraft && state.nonprofitProfile && (
          <button
            type="button"
            onClick={startNewCampaign}
            className="mt-3 text-xs font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            Start a new campaign
          </button>
        )}
      </div>

      <div className="animate-rise mt-4 overflow-hidden rounded-[2rem] shadow-2xl shadow-primary/10 ring-1 ring-border [animation-delay:140ms]">
        <img
          src={assetSrc(heroCommunity)}
          alt="Urban street view of a local restaurant and retail shop at dusk"
          width={1280}
          height={720}
          className="h-40 w-full object-cover sm:h-52"
        />
      </div>

      <div className="animate-rise mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 [animation-delay:200ms]">
        {[
          { n: "1", t: "Choose Your Fundraising Methods", d: "Select the fundraising methods that will help your campaign raise money." },
          { n: "2", t: "Share Your Story", d: "Help supporters understand why your cause matters." },
          { n: "3", t: "Engage Your Community", d: "Invite supporters, local businesses, and ambassadors to participate." },
        ].map((s) => (
          <div
            key={s.n}
            className="rounded-2xl border border-border bg-card/40 p-4 backdrop-blur-sm transition-all hover:bg-card hover:shadow-md"
          >
            <p className="text-xs font-bold text-primary">{s.n}</p>
            <p className="mt-1 text-sm font-semibold">{s.t}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.d}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
