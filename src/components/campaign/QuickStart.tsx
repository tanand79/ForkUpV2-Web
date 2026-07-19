"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Store,
  Heart,
  Trophy,
  Wine,
  Sparkles,
  Check,
} from "lucide-react";
import { useCampaign, type SupportMethod, type SupportMethods } from "@/lib/campaign-context";
import { generateCampaignDraft } from "@/lib/api";

/**
 * GoFundMe-style quick start. Asks only the essentials, then asks the backend
 * AI route to prepare a title + story the organizer reviews and edits on the
 * existing Campaign Basics screen. This screen is additive — the full
 * step-by-step builder is still available via Advanced Organizer Mode.
 *
 * Method defaults here (Online Donations + Ambassador ON) apply ONLY to the
 * quick-start flow; the full builder's defaults are unchanged.
 */

const METHOD_OPTIONS: {
  id: SupportMethod;
  icon: typeof Store;
  title: string;
  hint: string;
  label: string;
}[] = [
  {
    id: "donations",
    icon: Heart,
    title: "Online Donations",
    hint: "Anyone can give online.",
    label: "Online Donations",
  },
  {
    id: "ambassador",
    icon: Trophy,
    title: "Ambassador Fundraising",
    hint: "Supporters share your campaign.",
    label: "Ambassador Fundraising",
  },
  {
    id: "giveback",
    icon: Store,
    title: "Dine & Donate / Local Giveback",
    hint: "Local businesses give back a %.",
    label: "Dine & Donate / Local Giveback",
  },
  {
    id: "guestBartending",
    icon: Wine,
    title: "Guest Bartending Event",
    hint: "Host an in-person fundraiser.",
    label: "Guest Bartending Event",
  },
];

export function QuickStart() {
  const { state, update, goTo } = useCampaign();

  const [purpose, setPurpose] = useState(state.description ?? "");
  const [goal, setGoal] = useState(state.goal ?? "");
  const [startDate, setStartDate] = useState(state.startDate ?? "");
  const [endDate, setEndDate] = useState(state.endDate ?? "");
  // Quick-start defaults: Online Donations + Ambassador ON.
  const [methods, setMethods] = useState<SupportMethods>({
    giveback: false,
    donations: true,
    guestBartending: false,
    ambassador: true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const org = state.nonprofitProfile;
  const canContinue = purpose.trim().length > 0 && !busy;

  const toggle = (id: SupportMethod) =>
    setMethods((m) => ({ ...m, [id]: !m[id] }));

  const selectedLabels = METHOD_OPTIONS.filter((o) => methods[o.id]).map((o) => o.label);

  const applyAndContinue = (
    title: string,
    story: string,
    suggestedImageUrl?: string | null,
    fromAi = false,
  ) => {
    const fallbackTitle =
      title.trim() ||
      state.title.trim() ||
      (org?.organizationName ? `Support ${org.organizationName}` : "");
    const suggestedCover =
      !state.cover && suggestedImageUrl?.trim()
        ? {
            id: `library-${Date.now()}`,
            url: suggestedImageUrl.trim(),
            name: "Suggested from library",
          }
        : null;
    update({
      title: fallbackTitle,
      description: story.trim() || purpose.trim(),
      goal: goal ? String(goal) : state.goal,
      startDate: startDate || state.startDate,
      endDate: endDate || state.endDate,
      methods,
      // Only suggest a cover when the organizer hasn't chosen one; never override.
      ...(suggestedCover ? { cover: suggestedCover } : {}),
      // Organizer still reviews/edits + can re-run "Improve My Story".
      storyAccepted: false,
      // Flag so the details step can surface an "AI draft — review" hint.
      aiDrafted: fromAi,
    });
    goTo("details");
  };

  const submit = async () => {
    if (!canContinue) return;
    setBusy(true);
    setError(null);
    try {
      const draft = await generateCampaignDraft({
        purpose: purpose.trim(),
        organizationName: org?.organizationName,
        mission: org?.mission,
        causeCategory: org?.causeCategory,
        goal: goal || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        methods: selectedLabels,
        organizationType: "nonprofit",
        organizationId: org?.id,
      });
      applyAndContinue(draft.title, draft.story, draft.suggestedImageUrl, true);
    } catch {
      // AI prep is an enhancement, not a gate. Fall back to the organizer's own
      // words so the flow is never blocked (e.g. AI key not configured locally).
      applyAndContinue("", purpose.trim());
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <main className="mx-auto max-w-2xl px-5 py-8 pb-28 sm:px-6">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
          <Sparkles className="size-3.5" />
          Quick start
        </p>
        <h1 className="font-display mt-2 text-balance text-3xl font-bold leading-tight tracking-tight">
          Let&apos;s start your campaign.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Answer a few questions and ForkUp will prepare a draft — a title and story you can
          review and edit. You won&apos;t build it from scratch.
        </p>

        <div className="mt-8 space-y-7">
          <div>
            <label htmlFor="qs-purpose" className="text-sm font-semibold">
              What are you raising money for?
            </label>
            <textarea
              id="qs-purpose"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={4}
              placeholder="e.g. New instruments for our elementary school music program so every child can learn to play."
              className="mt-2 w-full rounded-xl border border-border bg-card p-3 text-sm outline-none transition-colors focus:border-primary"
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="qs-goal" className="text-sm font-semibold">
                Fundraising goal <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <div className="mt-2 flex items-center rounded-xl border border-border bg-card px-3">
                <span className="text-sm text-muted-foreground">$</span>
                <input
                  id="qs-goal"
                  type="number"
                  min={0}
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="5000"
                  className="w-full bg-transparent p-3 text-sm outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="qs-start" className="text-sm font-semibold">
                  Start <span className="font-normal text-muted-foreground">(optional)</span>
                </label>
                <input
                  id="qs-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-border bg-card p-3 text-sm outline-none transition-colors focus:border-primary"
                />
              </div>
              <div>
                <label htmlFor="qs-end" className="text-sm font-semibold">
                  End <span className="font-normal text-muted-foreground">(optional)</span>
                </label>
                <input
                  id="qs-end"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-border bg-card p-3 text-sm outline-none transition-colors focus:border-primary"
                />
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold">How would you like people to support?</p>
            <p className="mt-1 text-xs text-muted-foreground">
              We&apos;ve suggested a couple to start — adjust anytime.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {METHOD_OPTIONS.map((o) => {
                const selected = methods[o.id];
                const Icon = o.icon;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => toggle(o.id)}
                    className={`flex items-center gap-3 rounded-2xl p-3.5 text-left transition-all ${
                      selected
                        ? "border-2 border-primary bg-accent/40"
                        : "border border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <div
                      className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
                        selected ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"
                      }`}
                    >
                      <Icon className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-tight">{o.title}</p>
                      <p className="text-xs text-muted-foreground">{o.hint}</p>
                    </div>
                    <div
                      className={`flex size-6 shrink-0 items-center justify-center rounded-full transition-all ${
                        selected ? "bg-primary" : "border border-border bg-card"
                      }`}
                    >
                      {selected && <Check className="size-3.5 text-primary-foreground" strokeWidth={3} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={() => goTo("choose-organizer-mode")}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canContinue}
            className="inline-flex items-center gap-2 rounded-full bg-primary py-2.5 pl-5 pr-4 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-dark active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-primary"
          >
            {busy ? "Preparing your draft…" : "Prepare my draft"}
            {!busy && <ArrowRight className="size-4" />}
          </button>
        </div>
      </footer>
    </>
  );
}
