import { useEffect, useRef, useState } from "react";
import { Sparkles, CalendarClock } from "lucide-react";
import { useCampaign, type SupportMethods, type SupportMethod } from "@/lib/campaign-context";
import { improveStory } from "@/lib/story.functions";
import {
  STORY_MIN_WORDS,
  storyRequirementMet,
  storyWordCount,
} from "@/lib/story-validation";
import {
  ambassadorTimingCoachMessage,
  campaignDateMin,
  campaignDateNotInPastError,
  CLEAR_TIMING_FLAGS,
  dateFieldRequirements,
  evaluateBusinessMethodTiming,
  hasBusinessMethod,
  isBusinessConfirmationComplete,
  todayDateOnly,
  type TimingCta,
} from "@/lib/campaign-timing";
import { ActionBar } from "./ChooseBusinesses";
import { CampaignAiGuidance } from "./CampaignAiGuidance";
import { useLovableFlowRedirect } from "./useLovableFlowRedirect";
import { UsDateInput } from "@/components/campaign/UsDateInput";
import { RequestAgainButton } from "@/components/campaign/RequestAgainButton";
import { TimelineCheckCard } from "@/components/campaign/TimelineCheckCard";


const GIVEBACK = [10, 15, 20];



const METHOD_LABELS: Record<keyof SupportMethods, string> = {
  giveback: "Dine & Donate / Local Giveback",
  donations: "Online Donations",
  guestBartending: "Guest Bartending Event",
  ambassador: "Ambassador Fundraising",
};

function buildTitle(name: string) {
  // Only auto-populate from a real nonprofit name. Never invent a name and
  // never auto-generate "Dine, Shop & Support …" — that is opt-in later.
  return name.trim() ? `Support ${name.trim()}` : "";
}


export function CampaignDetails() {
  useLovableFlowRedirect();
  const { state, update, setMethodTiming, clearMethodTiming, next, back, nonprofitName, designMode } = useCampaign();

  const enabledMethods = (Object.keys(METHOD_LABELS) as SupportMethod[]).filter(
    (m) => state.methods[m],
  );
  const dateReqs = dateFieldRequirements(state.methods);
  const timingEval = evaluateBusinessMethodTiming(state);
  const ambassadorCoach = state.methods.ambassador
    ? ambassadorTimingCoachMessage(state.endDate)
    : null;

  const handleTimingCta = (cta: TimingCta) => {
    if (cta === "change_date") {
      update({
        ...CLEAR_TIMING_FLAGS,
        businessTimingStatus: timingEval.status,
      });
      return;
    }
    if (cta === "continue_without_business_method") {
      update({
        methods: {
          ...state.methods,
          giveback: false,
          guestBartending: false,
          donations: true,
          ambassador: true,
        },
        continueWithoutBusinessMethods: true,
        submitForForkupReview: false,
        showBusinessConfirmForm: false,
        businessTimingStatus: "ok",
      });
      return;
    }
    if (cta === "confirm_business") {
      update({
        showBusinessConfirmForm: true,
        submitForForkupReview: false,
        continueWithoutBusinessMethods: false,
        businessTimingStatus: "tight_timeline",
      });
      return;
    }
    if (cta === "submit_for_forkup_review") {
      update({
        submitForForkupReview: true,
        continueWithoutBusinessMethods: false,
        showBusinessConfirmForm: false,
        forkupReviewStatus: "pending",
        businessTimingStatus: "needs_forkup_review",
      });
    }
  };

  const titleEdited = useRef(false);
  useEffect(() => {
    if (!titleEdited.current) {
      update({ title: buildTitle(nonprofitName) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonprofitName]);


  const MIN_WORDS = STORY_MIN_WORDS;
  const storyWords = storyWordCount(state.description);
  const storyMet = storyRequirementMet(state.description);
  const wordsLeft = Math.max(0, MIN_WORDS - storyWords);

  const [customMode, setCustomMode] = useState(false);
  const [polished, setPolished] = useState(state.storyAccepted);
  const [improving, setImproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comparison, setComparison] = useState<{ original: string; improved: string } | null>(null);
  const lastPolished = useRef(state.storyAccepted ? state.description : "");
  const callImproveStory = improveStory;

  // If the story drops below the minimum requirement, approval must happen again.
  useEffect(() => {
    if (!storyMet) {
      setPolished(false);
      if (state.storyAccepted) update({ storyAccepted: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyMet]);

  const storyValid = storyMet;

  // Date requirements follow selected methods (online/ambassador: end only; giveback: start+end).
  const pastDateError = campaignDateNotInPastError({
    startDate: state.startDate,
    endDate: state.endDate,
    eventDate: state.eventDate,
  });
  const remaining =
    (state.title.trim() ? 0 : 1) +
    (dateReqs.requireStartDate && !state.startDate ? 1 : 0) +
    (dateReqs.requireEndDate && !state.endDate ? 1 : 0) +
    (dateReqs.requireEventDate && !state.eventDate ? 1 : 0) +
    (pastDateError ? 1 : 0) +
    (storyValid ? 0 : 1);
  const valid = remaining === 0;
  const todayMin = todayDateOnly();
  const remainingMeta =
    !storyMet && remaining === 1
      ? "Add a few more details to your story"
      : remaining >= 4
        ? "Complete 4 required fields to continue"
        : remaining > 1
          ? `${remaining} required fields remaining`
          : remaining === 1
            ? "1 required field remaining"
            : "Looking good";
  const field = "h-12 w-full rounded-xl border border-border bg-card px-4 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring/30";
  const label = "text-sm font-semibold";
  const isCustom = customMode || (state.methods.giveback && state.giveback > 0 && !GIVEBACK.includes(state.giveback));
  const customValid = state.giveback >= 5 && state.giveback <= 50;

  const runImprove = async () => {
    if (!storyMet || improving) return;
    setError(null);
    setImproving(true);
    try {
      const original = state.description.trim();
      const { improved } = await callImproveStory({ story: original });
      setComparison({ original, improved });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not improve the story. Please try again.");
    } finally {
      setImproving(false);
    }
  };

  const useImproved = () => {
    if (!comparison) return;
    update({ description: comparison.improved, storyAccepted: true });
    lastPolished.current = comparison.improved;
    setPolished(true);
    setComparison(null);
  };

  const keepOriginal = () => {
    if (!comparison) return;
    update({ description: comparison.original, storyAccepted: true });
    lastPolished.current = comparison.original;
    setPolished(true);
    setComparison(null);
  };


  return (
    <>
      <main className="mx-auto max-w-3xl px-5 py-10 pb-32 sm:px-6 sm:py-12">
        <div className="animate-rise mb-9">
          <h1 className="font-display text-balance text-3xl font-bold leading-[1.12] tracking-tight sm:text-4xl">
            Tell us why your campaign matters.
          </h1>

          <p className="mt-3 max-w-[58ch] text-pretty text-base text-muted-foreground">
            Share a few thoughts about your cause, what support will make possible, and how your
            supporters can make a difference. We'll help turn it into a story supporters can rally
            around.
          </p>
        </div>


        {(state.methods.giveback || state.methods.donations || state.methods.guestBartending || state.methods.ambassador) && (
          <div className="animate-rise mb-8">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Your campaign includes
            </p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(METHOD_LABELS) as (keyof SupportMethods)[])
                .filter((m) => state.methods[m])
                .map((m) => (
                  <span
                    key={m}
                    className="inline-flex items-center rounded-full bg-accent px-3.5 py-1.5 text-sm font-medium text-accent-foreground"
                  >
                    {METHOD_LABELS[m]}
                  </span>
                ))}
            </div>
          </div>
        )}


        <div className="animate-rise space-y-7 rounded-3xl border border-border bg-card p-6 sm:p-8 [animation-delay:60ms]">
          {state.aiDrafted && !state.storyAccepted && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-primary/25 bg-primary/5 p-4">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">Drafted with AI from your answers.</span>{" "}
                Review the title and story below and edit anything before you continue — these are a
                starting point, not final.
              </p>
            </div>
          )}
          <div className="space-y-2">
            <label className={label}>Campaign Title <span className="text-primary">*</span></label>
            <input
              className={field}
              value={state.title}
              placeholder="e.g. Support West Chester Youth Lacrosse"
              onChange={(e) => {
                titleEdited.current = true;
                update({ title: e.target.value });
              }}
            />
            <p className="text-xs text-muted-foreground">
              This is the public name supporters and businesses will see.
            </p>
          </div>



          <div className="grid gap-5 sm:grid-cols-2">
            {(() => {
              const startFirst = hasBusinessMethod(state.methods);
              const endBlock = dateReqs.requireEndDate ? (
                <div key="end" className="space-y-2">
                  <label className={label}>
                    {dateReqs.startOptional
                      ? "When should this campaign end?"
                      : "Campaign End Date"}{" "}
                    <span className="text-primary">*</span>
                  </label>
                  <UsDateInput
                    className={field}
                    value={state.endDate}
                    min={campaignDateMin(state.startDate)}
                    onChange={(endDate) =>
                      update({
                        endDate,
                        ...CLEAR_TIMING_FLAGS,
                      })
                    }
                  />
                </div>
              ) : null;
              const startBlock =
                dateReqs.requireStartDate || dateReqs.startOptional ? (
                  <div key="start" className="space-y-2">
                    <label className={label}>
                      {dateReqs.startOptional
                        ? "Do you want to set a start date?"
                        : "Campaign Start Date"}{" "}
                      {dateReqs.requireStartDate ? (
                        <span className="text-primary">*</span>
                      ) : (
                        <span className="text-muted-foreground font-normal">(optional)</span>
                      )}
                    </label>
                    <UsDateInput
                      className={field}
                      value={state.startDate}
                      min={todayMin}
                      max={state.endDate || undefined}
                      onChange={(startDate) =>
                        update({
                          startDate,
                          ...CLEAR_TIMING_FLAGS,
                        })
                      }
                    />
                  </div>
                ) : null;
              return startFirst ? (
                <>
                  {startBlock}
                  {endBlock}
                </>
              ) : (
                <>
                  {endBlock}
                  {startBlock}
                </>
              );
            })()}
            {dateReqs.requireEventDate && (
              <div className="space-y-2 sm:col-span-2">
                <label className={label}>
                  Guest Bartending Event Date <span className="text-primary">*</span>
                </label>
                <UsDateInput
                  className={field}
                  value={state.eventDate}
                  min={todayMin}
                  onChange={(eventDate) =>
                    update({
                      eventDate,
                      ...CLEAR_TIMING_FLAGS,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Guest Bartending is a single-day event. Business giveback methods still use the
                  campaign start and end dates above when selected.
                </p>
              </div>
            )}
          </div>
          {pastDateError ? (
            <p className="text-xs font-medium text-destructive">{pastDateError}</p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {dateReqs.startOptional
              ? "Online donations and ambassador sharing mainly need an end date. A start date is optional."
              : "Date requirements follow your selected fundraising methods. Business-based methods need at least 30 days of lead time for a normal launch."}
          </p>

          {ambassadorCoach && (
            <p className="rounded-xl border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
              {ambassadorCoach}
            </p>
          )}

          {state.forkupReviewStatus === "denied" && state.campaignSlug ? (
            <div className="space-y-3 rounded-2xl border border-rose-300/60 bg-rose-50/80 p-4 dark:border-rose-800 dark:bg-rose-950/40">
              <p className="text-sm font-semibold text-rose-900 dark:text-rose-200">
                ForkUp review denied
              </p>
              <p className="text-sm text-rose-900/90 dark:text-rose-100/90">
                You can request review again after updating dates or campaign details.
              </p>
              <RequestAgainButton
                kind="campaign"
                campaignSlug={state.campaignSlug}
                onSuccess={() => {
                  update({
                    forkupReviewStatus: "pending",
                    submitForForkupReview: true,
                    businessTimingStatus: "needs_forkup_review",
                  });
                }}
              />
            </div>
          ) : null}

          {timingEval.message &&
          (timingEval.status === "limited_promotion_window" ||
            timingEval.status === "tight_timeline" ||
            timingEval.status === "too_soon" ||
            timingEval.status === "needs_forkup_review") ? (
            <TimelineCheckCard
              timingEval={timingEval}
              state={state}
              onCta={handleTimingCta}
              onConfirmField={(patch) => update(patch)}
              onConfirmContinue={() => {
                if (!isBusinessConfirmationComplete(state)) return;
                update({
                  showBusinessConfirmForm: false,
                  submitForForkupReview: false,
                  businessTimingStatus: "tight_timeline",
                });
              }}
            />
          ) : null}

          {enabledMethods.length > 0 && (state.startDate || state.endDate) && (
            <div className="space-y-3 rounded-2xl border border-border bg-card/50 p-4">
              <div className="flex items-center gap-2">
                <CalendarClock className="size-4 text-primary" />
                <p className={label}>Method Timing</p>
                <span className="text-xs text-muted-foreground">(optional)</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Leave a method blank to inherit the campaign window. Set custom dates for any method
                that runs on its own timeline (e.g. a one-night event).
              </p>
              <div className="space-y-3">
                {enabledMethods.map((m) => {
                  const timing = state.methodTiming[m];
                  const custom = !!(timing && (timing.startDate || timing.endDate));
                  return (
                    <div key={m} className="rounded-xl border border-border bg-card p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold">{METHOD_LABELS[m]}</p>
                        {custom ? (
                          <button
                            type="button"
                            onClick={() => clearMethodTiming(m)}
                            className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                          >
                            Reset to campaign window
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Inherits campaign window</span>
                        )}
                      </div>
                      <div className="mt-2 grid gap-3 sm:grid-cols-2">
                        <UsDateInput
                          aria-label={`${METHOD_LABELS[m]} start date`}
                          className={field}
                          value={timing?.startDate ?? ""}
                          min={state.startDate || undefined}
                          max={state.endDate || undefined}
                          placeholder={state.startDate ? undefined : "MM/DD/YYYY"}
                          onChange={(iso) => setMethodTiming(m, { startDate: iso })}
                        />
                        <UsDateInput
                          aria-label={`${METHOD_LABELS[m]} end date`}
                          className={field}
                          value={timing?.endDate ?? ""}
                          min={timing?.startDate || state.startDate || undefined}
                          max={state.endDate || undefined}
                          placeholder={state.endDate ? undefined : "MM/DD/YYYY"}
                          onChange={(iso) => setMethodTiming(m, { endDate: iso })}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className={label}>Tell us why your campaign matters. <span className="text-primary">*</span></label>
            <p className="text-xs text-muted-foreground">
              Share a few thoughts about your cause, what support will make possible, and how your
              supporters can make a difference. We'll help turn it into a story supporters can rally
              around.
            </p>

            <textarea
              className="min-h-32 w-full rounded-xl border border-border bg-card p-4 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring/30"
              value={state.description}
              onChange={(e) => {
                const value = e.target.value;
                update({
                  description: value,
                  storyAccepted: storyRequirementMet(value) ? state.storyAccepted : false,
                });
                if (polished && value.trim() !== lastPolished.current.trim()) {
                  setPolished(false);
                }
              }}
              placeholder={`Example:\n\nThe Headstrong Foundation was created to improve the lives of families affected by cancer. Funds raised through this campaign will help provide direct support, resources, and hope to patients and their loved ones during some of life's most difficult moments.\n\nEvery donation, meal, and shared post helps us continue that mission and make a meaningful difference for those who need it most.`}
            />

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={runImprove}
                disabled={!storyMet || improving}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {improving ? "Improving…" : polished ? "Improve Again" : "Improve My Story"}
              </button>

              {!storyMet ? (
                <span className="text-xs text-muted-foreground">
                  Story length: {storyWords} / {MIN_WORDS} words — add {wordsLeft} more{" "}
                  {wordsLeft === 1 ? "word" : "words"} to unlock Improve My Story.
                </span>
              ) : !polished ? (
                <span className="text-xs font-medium text-primary">
                  ✓ Story ready — improve is optional
                </span>
              ) : (
                <span className="text-xs font-medium text-primary">✓ Story improved</span>
              )}
            </div>

            {error && <p className="text-xs font-medium text-destructive">{error}</p>}

            {comparison && (
              <div className="mt-2 space-y-3 rounded-2xl border border-border bg-secondary/40 p-4">
                <p className="text-sm font-semibold">Review the improved story</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Before
                    </p>
                    <div className="whitespace-pre-wrap rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
                      {comparison.original}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                      After
                    </p>
                    <div className="whitespace-pre-wrap rounded-xl border border-primary/40 bg-card p-3 text-sm">
                      {comparison.improved}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={useImproved}
                    className="inline-flex h-9 items-center rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Use Improved Version
                  </button>
                  <button
                    type="button"
                    onClick={keepOriginal}
                    className="inline-flex h-9 items-center rounded-xl border border-border bg-card px-4 text-xs font-semibold transition-colors hover:bg-secondary"
                  >
                    Keep Original
                  </button>
                  <button
                    type="button"
                    onClick={runImprove}
                    disabled={improving}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-card px-4 text-xs font-semibold transition-colors hover:bg-secondary disabled:opacity-50"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {improving ? "Improving…" : "Try Again"}
                  </button>
                </div>
              </div>
            )}
          </div>






          {state.methods.giveback && (
            <div className="space-y-3">
              <label className={label}>Suggested Giveback Percentage</label>
              <p className="text-xs text-muted-foreground">
                This is the giveback percentage businesses will see when invited. Participating
                businesses can confirm or adjust their contribution when accepting.
              </p>
              <div className="grid grid-cols-4 gap-3">
                {GIVEBACK.map((g) => {
                  const active = !isCustom && state.giveback === g;
                  return (
                    <button
                      key={g}
                      onClick={() => {
                        setCustomMode(false);
                        update({ giveback: g });
                      }}
                      className={`flex h-11 items-center justify-center rounded-xl text-sm font-semibold transition-all ${
                        active
                          ? "bg-accent text-accent-foreground ring-2 ring-primary"
                          : "border border-border bg-card hover:bg-secondary"
                      }`}
                    >
                      {g}%
                    </button>
                  );
                })}
                <button
                  onClick={() => {
                    setCustomMode(true);
                    if (GIVEBACK.includes(state.giveback)) update({ giveback: 0 });
                  }}
                  className={`flex h-11 items-center justify-center rounded-xl text-sm font-semibold transition-all ${
                    isCustom
                      ? "bg-accent text-accent-foreground ring-2 ring-primary"
                      : "border border-border bg-card hover:bg-secondary"
                  }`}
                >
                  Custom
                </button>
              </div>
              {isCustom && (
                <div className="space-y-2 rounded-xl border border-border bg-card/50 p-4">
                  <label className="text-sm font-semibold">Custom Giveback Percentage</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={5}
                      max={50}
                      value={state.giveback || ""}
                      onChange={(e) => update({ giveback: Number(e.target.value) })}
                      placeholder="__"
                      className={`${field} max-w-28`}
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Typical campaigns use 10%–20%.</p>
                  {state.giveback > 0 && !customValid && (
                    <p className="text-xs text-destructive">
                      Enter a percentage between 5% and 50%.
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    This is your suggested giveback percentage. Participating businesses can
                    confirm or adjust their contribution when accepting your invitation.
                  </p>
                </div>
              )}
            </div>
          )}

          <CampaignAiGuidance compact />

        </div>
      </main>

      <ActionBar
        backLabel="Back"
        onBack={back}
        meta={remainingMeta}
        nextLabel="Next: Campaign Assets"
        nextDisabled={!valid && !designMode}
        onNext={() => {
          if (storyMet && !state.storyAccepted) {
            update({ storyAccepted: true });
          }
          next();
        }}
      />
    </>


  );
}
