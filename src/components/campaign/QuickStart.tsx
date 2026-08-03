"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Store,
  Heart,
  Trophy,
  Wine,
  Sparkles,
  Check,
  CheckCircle2,
  Circle,
  Wand2,
} from "lucide-react";
import { useCampaign, type SupportMethod, type SupportMethods } from "@/lib/campaign-context";
import { fetchManageCampaigns, generateCampaignDraft, suggestCampaignGoal } from "@/lib/api";
import { getAuthToken } from "@/lib/auth-storage";
import { suggestCampaignDates, suggestOnlineCampaignDates, hasBusinessMethod } from "@/lib/campaign-timing";
import { UsDateInput } from "@/components/campaign/UsDateInput";

/**
 * Lovable “Build Your Campaign” — guided substeps:
 *   purpose → goal/dates → methods → Prepare My Draft → details (review/edit).
 *
 * Method defaults: Online Donations + Ambassador ON (giveback/guest off).
 * Matches initial campaign-context methods for the default fundraising layer.
 *
 * Goal screen also offers memory fundraising: if this nonprofit has a prior
 * campaign with funds raised, prompt to reuse that amount as the new goal.
 * When the amount is empty on the goal screen, AI pre-fills a suggestedGoal
 * (editable). Empty dates: online/ambassador defaults suggest end ≈ today+14
 * (start optional/empty); business methods keep L2 timing-safe start/end
 * (start ≈ today+35, end ≈ start+30). Prepare My Draft may still fill
 * suggestedGoal if left blank.
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

const BUILD_PROGRESS_MESSAGES = [
  "Reviewing your organization profile",
  "Using your campaign purpose",
  "Applying your fundraising methods",
  "Preparing your campaign story",
  "Organizing your campaign details",
];

type BuildSub = "purpose" | "goal" | "methods";

const FUNDRAISING_MEMORY_KEY = "forkup-fundraising-memory";

/** Format a prior amount for the memory prompt (e.g. $15,000). */
function formatRaisedAmount(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function orgMemoryKey(org: { id?: number; organizationName: string } | null | undefined): string {
  if (!org) return "";
  if (org.id) return `id:${org.id}`;
  return `name:${org.organizationName.trim().toLowerCase()}`;
}

type PriorFunds = {
  amount: number;
  campaignName: string;
  kind: "raised" | "goal" | "memory";
};

type MemoryStore = Record<string, { amount: number; campaignName?: string }>;

function readFundraisingMemory(key: string): PriorFunds | null {
  if (!key || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(FUNDRAISING_MEMORY_KEY);
    if (!raw) return null;
    const store = JSON.parse(raw) as MemoryStore;
    const row = store[key];
    if (!row || !(Number(row.amount) > 0)) return null;
    return {
      amount: Number(row.amount),
      campaignName: row.campaignName?.trim() || "",
      kind: "memory",
    };
  } catch {
    return null;
  }
}

function writeFundraisingMemory(
  key: string,
  amount: number,
  campaignName?: string,
): void {
  if (!key || !(amount > 0) || typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(FUNDRAISING_MEMORY_KEY);
    const store: MemoryStore = raw ? (JSON.parse(raw) as MemoryStore) : {};
    store[key] = {
      amount,
      ...(campaignName?.trim() ? { campaignName: campaignName.trim() } : {}),
    };
    window.localStorage.setItem(FUNDRAISING_MEMORY_KEY, JSON.stringify(store));
  } catch {
    /* ignore quota / private mode */
  }
}

function parseGoalNumber(raw: string): number {
  const n = Number(String(raw).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Memory fundraising auto-detection.
 * Prefer prior raised > 0; else prior campaign goal > 0 (API order is newest first).
 */
function pickPriorFunds(
  rows: { raised: number; goal: number; status: string; name: string }[],
): PriorFunds | null {
  const withRaised = rows.filter((r) => Number(r.raised) > 0);
  if (withRaised.length > 0) {
    const preferred =
      withRaised.find((r) => /completed|settled|closed|live|ready/i.test(r.status)) ??
      withRaised[0];
    return {
      amount: Number(preferred.raised),
      campaignName: preferred.name,
      kind: "raised",
    };
  }
  const withGoal = rows.filter((r) => Number(r.goal) > 0);
  if (withGoal.length === 0) return null;
  const preferred =
    withGoal.find((r) => /completed|settled|closed|live|ready/i.test(r.status)) ??
    withGoal[0];
  return {
    amount: Number(preferred.goal),
    campaignName: preferred.name,
    kind: "goal",
  };
}

export function QuickStart() {
  const { state, update, goTo } = useCampaign();

  const [sub, setSub] = useState<BuildSub>("purpose");
  const [purpose, setPurpose] = useState(state.description ?? "");
  const [goal, setGoal] = useState(state.goal ?? "");
  const [startDate, setStartDate] = useState(state.startDate ?? "");
  const [endDate, setEndDate] = useState(state.endDate ?? "");
  const [methods, setMethods] = useState<SupportMethods>({
    giveback: false,
    donations: true,
    guestBartending: false,
    ambassador: true,
  });
  const [touched, setTouched] = useState(false);
  const [building, setBuilding] = useState(false);
  const [progressIdx, setProgressIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  /** Prior fundraising amount for the “repeat?” prompt on the goal screen. */
  const [priorFunds, setPriorFunds] = useState<PriorFunds | null>(null);
  const [priorPromptDismissed, setPriorPromptDismissed] = useState(false);
  /** True while AI is suggesting a goal on the Build goal screen. */
  const [goalSuggesting, setGoalSuggesting] = useState(false);
  /** True when the current goal value came from AI (cleared on manual/memory edit). */
  const [goalFromAi, setGoalFromAi] = useState(!!state.goalAiSuggested && !!state.goal);
  const goalSuggestAttempted = useRef(false);
  /** Once the organizer types or picks memory, AI must not overwrite. */
  const goalLockedByUser = useRef(!!(state.goal ?? "").trim());
  /** Once the organizer edits dates, timing suggestion must not overwrite. */
  const datesLockedByUser = useRef(
    !!(state.startDate ?? "").trim() || !!(state.endDate ?? "").trim(),
  );
  const datesSuggestAttempted = useRef(false);
  /** True when start/end came from L2 timing suggestion (cleared on edit). */
  const [datesFromSuggestion, setDatesFromSuggestion] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<{
    title: string;
    story: string;
    suggestedImageUrl?: string | null;
    facebookUrl?: string;
    instagramHandle?: string;
    websiteUrl?: string;
    /** AI-suggested whole-dollar goal when organizer left amount blank. */
    suggestedGoal?: number;
    fromAi: boolean;
  } | null>(null);

  const org = state.nonprofitProfile;
  const purposeValid = purpose.trim().split(/\s+/).filter(Boolean).length >= 3;
  const hasMethod = METHOD_OPTIONS.some((o) => methods[o.id]);
  const selectedLabels = METHOD_OPTIONS.filter((o) => methods[o.id]).map((o) => o.label);

  const toggle = (id: SupportMethod) => setMethods((m) => ({ ...m, [id]: !m[id] }));

  const finishToDetails = (draft: {
    title: string;
    story: string;
    suggestedImageUrl?: string | null;
    facebookUrl?: string;
    instagramHandle?: string;
    websiteUrl?: string;
    suggestedGoal?: number;
    fromAi: boolean;
  }) => {
    const fallbackTitle =
      draft.title.trim() ||
      state.title.trim() ||
      (org?.organizationName ? `Support ${org.organizationName}` : "");
    const suggestedCover =
      !state.cover && draft.suggestedImageUrl?.trim()
        ? {
            id: `library-${Date.now()}`,
            url: draft.suggestedImageUrl.trim(),
            name: "Suggested from library",
            storedUrl: draft.suggestedImageUrl.trim(),
            source: "library" as const,
          }
        : null;
    const userGoal = goal.trim();
    const aiGoalFormatted =
      !userGoal &&
      draft.suggestedGoal != null &&
      Number(draft.suggestedGoal) > 0
        ? formatRaisedAmount(Number(draft.suggestedGoal))
        : "";
    const resolvedGoal = userGoal || aiGoalFormatted || state.goal;
    update({
      title: fallbackTitle,
      description: draft.story.trim() || purpose.trim(),
      goal: resolvedGoal,
      goalAiSuggested: goalFromAi || (!userGoal && !!aiGoalFormatted),
      startDate: startDate || state.startDate,
      endDate: endDate || state.endDate,
      methods,
      fundsSupport: [purpose.trim()],
      ...(suggestedCover ? { cover: suggestedCover } : {}),
      promotion: {
        facebookUrl: (draft.facebookUrl ?? "").trim() || state.promotion.facebookUrl,
        instagramHandle:
          (draft.instagramHandle ?? "").trim() || state.promotion.instagramHandle,
        websiteUrl: (draft.websiteUrl ?? "").trim() || state.promotion.websiteUrl,
        newsletter: state.promotion.newsletter,
      },
      storyAccepted: false,
      aiDrafted: draft.fromAi,
    });
    goTo("campaign-review");
  };

  useEffect(() => {
    if (!building) return;
    if (progressIdx >= BUILD_PROGRESS_MESSAGES.length) {
      const done = setTimeout(() => {
        if (pendingDraft) finishToDetails(pendingDraft);
        else finishToDetails({ title: "", story: purpose.trim(), fromAi: false });
      }, 400);
      return () => clearTimeout(done);
    }
    const tick = setTimeout(() => setProgressIdx((i) => i + 1), 650);
    return () => clearTimeout(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- drive prepare animation only
  }, [building, progressIdx, pendingDraft]);

  const prepareDraft = async () => {
    if (!purposeValid || !hasMethod) {
      setTouched(true);
      return;
    }
    rememberGoalIfAny();
    setError(null);
    setProgressIdx(0);
    setBuilding(true);
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
        website: state.promotion.websiteUrl || undefined,
      });
      setPendingDraft({
        title: draft.title,
        story: draft.story,
        suggestedImageUrl: draft.suggestedImageUrl,
        facebookUrl: draft.facebookUrl,
        instagramHandle: draft.instagramHandle,
        websiteUrl: draft.websiteUrl,
        suggestedGoal: draft.suggestedGoal,
        fromAi: true,
      });
    } catch {
      setPendingDraft({ title: "", story: purpose.trim(), fromAi: false });
    }
  };

  // Redirect to Find org if somehow opened without a profile (Lovable parity).
  useEffect(() => {
    if (!org) goTo("nonprofit-claim");
  }, [org, goTo]);

  // Memory fundraising: detect prior raised / goal for this nonprofit (amount screen).
  useEffect(() => {
    const memKey = orgMemoryKey(org);
    const fromMemory = readFundraisingMemory(memKey);

    const nonprofitId = org?.id;
    if (!nonprofitId || !getAuthToken()) {
      setPriorFunds(fromMemory);
      return;
    }
    let cancelled = false;
    void fetchManageCampaigns(nonprofitId)
      .then((rows) => {
        if (cancelled) return;
        setPriorFunds(pickPriorFunds(rows) ?? fromMemory);
      })
      .catch(() => {
        if (!cancelled) setPriorFunds(fromMemory);
      });
    return () => {
      cancelled = true;
    };
  }, [org?.id, org?.organizationName]);

  // AI goal suggestion: pre-fill the Build goal screen when amount is empty.
  useEffect(() => {
    if (sub !== "goal") return;
    if (goalSuggestAttempted.current) return;
    if (goal.trim()) return;
    if (!purposeValid) return;

    goalSuggestAttempted.current = true;
    let cancelled = false;
    setGoalSuggesting(true);
    void suggestCampaignGoal({
      purpose: purpose.trim(),
      organizationName: org?.organizationName,
      mission: org?.mission,
      causeCategory: org?.causeCategory,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    })
      .then((res) => {
        if (cancelled || goalLockedByUser.current) return;
        if (res.suggestedGoal > 0) {
          setGoal(formatRaisedAmount(res.suggestedGoal));
          setGoalFromAi(true);
        }
      })
      .catch(() => {
        /* leave blank — Prepare My Draft can still suggest later */
      })
      .finally(() => {
        if (!cancelled) setGoalSuggesting(false);
      });

    return () => {
      cancelled = true;
    };
    // Intentionally run once when entering goal with empty amount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub, purposeValid]);

  // Default fundraising layer: end date only (≈ today+14). Business methods: L2 start/end.
  useEffect(() => {
    if (sub !== "goal") return;
    if (datesSuggestAttempted.current) return;
    if (datesLockedByUser.current) return;
    if (startDate.trim() || endDate.trim()) return;

    datesSuggestAttempted.current = true;
    const suggested = hasBusinessMethod(methods)
      ? suggestCampaignDates()
      : suggestOnlineCampaignDates();
    if (!suggested.endDate && !suggested.startDate) return;
    setStartDate(suggested.startDate);
    setEndDate(suggested.endDate);
    setDatesFromSuggestion(true);
    // Intentionally run once when entering goal with empty dates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub]);

  /** Persist typed goal into local memory so the prompt can return next time. */
  const rememberGoalIfAny = () => {
    const amount = parseGoalNumber(goal);
    if (amount > 0) writeFundraisingMemory(orgMemoryKey(org), amount);
  };

  const panelClass = "mx-auto max-w-xl px-5 py-6 pb-32 sm:px-6";
  const headlineClass =
    "font-display text-[1.75rem] font-bold leading-[1.12] tracking-tight sm:text-[2.125rem]";

  const OrgChip = (
    <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border bg-card px-4 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-sm font-bold">
          {org?.organizationName ?? "Your organization"}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
          <CheckCircle2 className="size-3" /> Profile Ready
        </span>
      </div>
      <button
        type="button"
        onClick={() => goTo("start")}
        className="shrink-0 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        Review Profile
      </button>
    </div>
  );

  const Eyebrow = (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-primary">
      <Wand2 className="size-3" />
      Build your campaign
    </span>
  );

  const StickyFooter = ({
    onBack,
    backLabel = "Back",
    onPrimary,
    primaryLabel,
    primaryDisabled,
    primaryIcon,
    onSkip,
  }: {
    onBack: () => void;
    backLabel?: string;
    onPrimary: () => void;
    primaryLabel: string;
    primaryDisabled?: boolean;
    primaryIcon?: React.ReactNode;
    onSkip?: () => void;
  }) => (
    <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-5 py-4 sm:px-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {backLabel}
        </button>
        <div className="flex items-center gap-3">
          {onSkip && (
            <button
              type="button"
              onClick={onSkip}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Skip for now
            </button>
          )}
          <button
            type="button"
            onClick={onPrimary}
            disabled={primaryDisabled}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {primaryIcon}
            {primaryLabel}
            {!primaryIcon && <ArrowRight className="size-4" />}
          </button>
        </div>
      </div>
    </footer>
  );

  if (building) {
    return (
      <main className="mx-auto max-w-xl px-5 py-5 pb-16 sm:px-6">
        <div className="mx-auto mt-8 max-w-md text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-primary">
            <Wand2 className="size-3" />
            Build your campaign
          </span>
          <h1 className="font-display mt-4 text-2xl font-bold tracking-tight">
            ForkUp is preparing your campaign draft
          </h1>
          <div className="mt-6 space-y-2.5 text-left">
            {BUILD_PROGRESS_MESSAGES.map((msg, i) => {
              const done = i < progressIdx;
              const active = i === progressIdx;
              return (
                <div
                  key={msg}
                  className={`flex items-center gap-2.5 rounded-xl border p-3 text-sm transition-colors ${
                    done
                      ? "border-emerald-300/60 bg-emerald-50/60"
                      : active
                        ? "border-primary/40 bg-primary/5"
                        : "border-border bg-secondary/30 opacity-60"
                  }`}
                >
                  {done ? (
                    <CheckCircle2 className="size-4 text-emerald-600" />
                  ) : active ? (
                    <Sparkles className="size-4 animate-pulse text-primary" />
                  ) : (
                    <Circle className="size-4 text-muted-foreground/50" />
                  )}
                  <span className={done || active ? "font-medium" : "text-muted-foreground"}>
                    {msg}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    );
  }

  if (sub === "purpose") {
    return (
      <>
        <main className={panelClass}>
          {OrgChip}
          {Eyebrow}
          <h1 className={`mt-4 ${headlineClass}`}>What are you raising money for?</h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            A short phrase is enough. ForkUp will turn it into a campaign draft you can review and
            edit.
          </p>
          <div className="mt-6">
            <label className="text-xs font-semibold text-muted-foreground">Campaign purpose</label>
            <textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              onBlur={() => setTouched(true)}
              rows={3}
              placeholder="Team travel expenses, new uniforms, scholarships, equipment, or community support"
              className={`mt-1.5 w-full rounded-xl border bg-background px-3.5 py-3 text-base outline-none ${
                touched && !purposeValid ? "border-destructive" : "border-border"
              }`}
            />
            {touched && !purposeValid && (
              <p className="mt-1.5 text-xs font-medium text-destructive">
                Please describe what the funds will support in a few words.
              </p>
            )}
          </div>
        </main>
        <StickyFooter
          onBack={() => goTo("start")}
          backLabel="Back to Organization Home"
          onPrimary={() => {
            setTouched(true);
            if (purposeValid) setSub("goal");
          }}
          primaryLabel="Continue"
          primaryDisabled={!purposeValid}
        />
      </>
    );
  }

  if (sub === "goal") {
    return (
      <>
        <main className={panelClass}>
          {OrgChip}
          {Eyebrow}
          <h1 className={`mt-4 ${headlineClass}`}>Do you have a goal or campaign dates?</h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            We&apos;ll suggest a fundraising goal for you. Edit anytime before launch.
          </p>
          <div className="mt-6">
            <label className="text-xs font-semibold text-muted-foreground">
              Fundraising goal amount
            </label>
            <input
              value={goal}
              onChange={(e) => {
                goalLockedByUser.current = true;
                setGoal(e.target.value);
                setGoalFromAi(false);
              }}
              placeholder={goalSuggesting ? "Suggesting…" : "$10,000"}
              disabled={goalSuggesting}
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-3 text-base outline-none sm:max-w-xs disabled:opacity-70"
            />
            {goalSuggesting ? (
              <p className="mt-1.5 text-xs text-muted-foreground">Suggesting a goal…</p>
            ) : goalFromAi && goal.trim() ? (
              <p className="mt-1.5 text-xs text-muted-foreground">
                Suggested for you — edit anytime.
              </p>
            ) : null}
            {/* Memory fundraising auto-detection — prior raised / goal prompt. */}
            {priorFunds && !priorPromptDismissed && (
              <div className="mt-3 rounded-2xl border border-primary/25 bg-accent/40 p-3.5 sm:max-w-md">
                <p className="text-sm leading-relaxed text-foreground">
                  {priorFunds.kind === "raised" ? (
                    <>
                      Your last campaign
                      {priorFunds.campaignName ? (
                        <>
                          {" "}
                          (<span className="font-semibold">{priorFunds.campaignName}</span>)
                        </>
                      ) : null}{" "}
                      raised{" "}
                      <span className="font-semibold">
                        {formatRaisedAmount(priorFunds.amount)}
                      </span>
                      . Would you like to repeat the funds raised previously?
                    </>
                  ) : (
                    <>
                      Your last campaign
                      {priorFunds.campaignName ? (
                        <>
                          {" "}
                          (<span className="font-semibold">{priorFunds.campaignName}</span>)
                        </>
                      ) : null}{" "}
                      used a fundraising goal of{" "}
                      <span className="font-semibold">
                        {formatRaisedAmount(priorFunds.amount)}
                      </span>
                      . Would you like to repeat the funds raised previously?
                    </>
                  )}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const formatted = formatRaisedAmount(priorFunds.amount);
                      goalLockedByUser.current = true;
                      setGoal(formatted);
                      setGoalFromAi(false);
                      writeFundraisingMemory(
                        orgMemoryKey(org),
                        priorFunds.amount,
                        priorFunds.campaignName,
                      );
                      setPriorPromptDismissed(true);
                    }}
                    className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Yes, use {formatRaisedAmount(priorFunds.amount)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriorPromptDismissed(true)}
                    className="inline-flex items-center rounded-full border border-border bg-card px-4 py-2 text-xs font-medium transition-colors hover:bg-secondary"
                  >
                    No thanks
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">
                When should this campaign end?
              </label>
              <UsDateInput
                value={endDate}
                min={startDate || undefined}
                onChange={(iso) => {
                  datesLockedByUser.current = true;
                  setDatesFromSuggestion(false);
                  setEndDate(iso);
                }}
                className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-3 text-base outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">
                Do you want to set a start date?{" "}
                <span className="font-normal">(optional)</span>
              </label>
              <UsDateInput
                value={startDate}
                max={endDate || undefined}
                onChange={(e) => {
                  datesLockedByUser.current = true;
                  setDatesFromSuggestion(false);
                  setStartDate(e.target.value);
                }}
                className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-3 text-base outline-none"
              />
            </div>
          </div>
          {datesFromSuggestion && endDate ? (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {hasBusinessMethod(methods)
                ? "Suggested to avoid ForkUp review and leave room for partners — edit anytime."
                : "Suggested end date gives ambassadors time to share — edit anytime. A start date is optional."}
            </p>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              Goal is optional. Online donations and ambassador sharing mainly need an end date before launch.
            </p>
          )}
        </main>
        <StickyFooter
          onBack={() => setSub("purpose")}
          onPrimary={() => {
            rememberGoalIfAny();
            setSub("methods");
          }}
          onSkip={() => {
            rememberGoalIfAny();
            setSub("methods");
          }}
          primaryLabel="Continue"
        />
      </>
    );
  }

  return (
    <>
      <main className={panelClass}>
        {OrgChip}
        {Eyebrow}
        <h1 className={`mt-4 ${headlineClass}`}>How can people support?</h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          Choose one or more ways people can participate.
        </p>
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        {touched && !hasMethod && (
          <p className="mt-3 text-xs font-medium text-destructive">
            Select at least one fundraising method to continue.
          </p>
        )}
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </main>
      <StickyFooter
        onBack={() => setSub("goal")}
        onPrimary={() => void prepareDraft()}
        primaryLabel="Prepare My Draft"
        primaryIcon={<Sparkles className="size-4" />}
        primaryDisabled={!purposeValid || !hasMethod}
      />
    </>
  );
}
