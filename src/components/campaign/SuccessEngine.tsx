"use client";

import { CalendarClock, Mail, Sparkles } from "lucide-react";
import { useCampaign } from "@/lib/campaign-context";
import { SuccessEngineActionList } from "./SuccessEngineActionList";

export function SuccessEngine() {
  const { state, goTo } = useCampaign();
  const slug = state.campaignSlug;

  if (!slug) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-12 text-center">
        <p className="text-muted-foreground">
          Launch a campaign first to view your Success Engine schedule.
        </p>
        <button
          type="button"
          onClick={() => goTo("dashboard")}
          className="btn-primary mt-4 rounded-full px-6 py-3 text-sm font-semibold"
        >
          Go to dashboard
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-5 py-10 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-primary">
          Campaign Management
        </span>
      </div>
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Success Engine</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        ForkUp prepares supporter emails, reminders, and promotion copy after your business roster is
        set. Preview, copy, and mark each action complete when you send it.
      </p>

      <section className="mt-8 rounded-3xl border border-border bg-card p-6">
        <h2 className="flex items-center gap-2 font-bold">
          <CalendarClock className="size-4 text-primary" />
          Scheduled campaign actions
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Loaded from your campaign&apos;s Success Engine plan.
        </p>
        <div className="mt-4">
          <SuccessEngineActionList slug={slug} />
        </div>
        <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Mail className="size-3.5" />
          Organizer reminders are sent by email when scheduled actions are ready.
        </p>
      </section>

      <section className="mt-8 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
        <p className="flex items-center gap-2 font-semibold text-foreground">
          <Sparkles className="size-4 text-primary" />
          Activation dependency
        </p>
        <p className="mt-2">
          Actions are generated at campaign launch. Content references your confirmed participating
          businesses once the invitation window closes.
        </p>
      </section>
    </main>
  );
}
