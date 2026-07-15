"use client";

import { Compass, Gauge, ArrowRight } from "lucide-react";
import { useCampaign } from "@/lib/campaign-context";

export function ChooseOrganizerMode() {
  const { update, goTo, hasDraft, resumeDraft } = useCampaign();

  const selectMode = (mode: "guided" | "advanced") => {
    update({ organizerMode: mode });
    if (hasDraft) resumeDraft();
    else goTo("methods");
  };

  return (
    <main className="mx-auto max-w-2xl px-5 py-10 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">
        Organizer experience
      </p>
      <h1 className="font-display mt-2 text-3xl font-bold tracking-tight">
        How would you like to build your campaign?
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Choose an experience that fits your workflow. You can switch modes later from your dashboard.
      </p>

      <div className="mt-8 grid gap-4">
        <button
          type="button"
          onClick={() => selectMode("guided")}
          className="flex items-start gap-4 rounded-2xl border-2 border-primary/30 bg-primary/5 p-5 text-left transition-all hover:border-primary hover:shadow-md"
        >
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Compass className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Guided Organizer Mode</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Step-by-step campaign creation with contextual tips, progress tracking, and save &amp; resume.
              Recommended for first-time organizers.
            </p>
            <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
              <li>• Simplified onboarding flow</li>
              <li>• Recommendations at each step</li>
              <li>• Launch checklist with readiness checks</li>
            </ul>
          </div>
          <ArrowRight className="mt-1 size-5 shrink-0 text-primary" />
        </button>

        <button
          type="button"
          onClick={() => selectMode("advanced")}
          className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5 text-left transition-all hover:border-primary/40 hover:shadow-md"
        >
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-secondary text-foreground">
            <Gauge className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Advanced Organizer Mode</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Full access to campaign settings, bulk tools, and reporting. Faster navigation for experienced organizers.
            </p>
            <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
              <li>• Direct access to all campaign controls</li>
              <li>• Bulk business management</li>
              <li>• Advanced reporting and configuration</li>
            </ul>
          </div>
          <ArrowRight className="mt-1 size-5 shrink-0 text-muted-foreground" />
        </button>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        {/* TODO: Persist mode preference to user profile when account settings ship. */}
        Your choice is saved with your campaign draft.
      </p>
    </main>
  );
}
