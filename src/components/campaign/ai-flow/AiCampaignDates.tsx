"use client";

/**
 * AI flow Step 7 — Campaign dates only (primary remaining user input).
 *
 * Online Donations / Ambassador: end date required; start optional.
 * All methods: Start first, then End (same visual order).
 * Ambassador soft coaching when end window is under 14 days (no hard block).
 * Business methods: Timeline Check bands (30+ / 21–29 / 8–20 / 0–7) with CTAs.
 *
 * Continue: Dine & Donate / Guest Bartending → Choose/Invite Businesses, then Preview.
 * Online/ambassador-only → Preview directly.
 *
 * Layout: side-by-side on sm+ (aligned short labels), stacked on mobile.
 */
import { useCampaign } from "@/lib/campaign-context";
import { UsDateInput } from "@/components/campaign/UsDateInput";
import { TimelineCheckCard } from "@/components/campaign/TimelineCheckCard";
import {
  ambassadorTimingCoachMessage,
  campaignDateMin,
  campaignDateNotInPastError,
  CLEAR_TIMING_FLAGS,
  dateFieldRequirements,
  evaluateBusinessMethodTiming,
  isBusinessConfirmationComplete,
  timingAllowsContinue,
  todayDateOnly,
  type TimingCta,
} from "@/lib/campaign-timing";
import { AiFlowShell } from "./AiFlowShell";

const fieldClass =
  "h-12 w-full rounded-xl border border-border bg-card px-4 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring/30";

export function AiCampaignDates() {
  const { state, update, goTo } = useCampaign();
  const dateReqs = dateFieldRequirements(state.methods);
  const timingEval = evaluateBusinessMethodTiming(state);
  const pastDateError = campaignDateNotInPastError({
    startDate: state.startDate,
    endDate: state.endDate,
    eventDate: state.eventDate,
  });
  const todayMin = todayDateOnly();
  const datesOk =
    (!dateReqs.requireEndDate || Boolean(state.endDate.trim())) &&
    (!dateReqs.requireStartDate || Boolean(state.startDate.trim())) &&
    (!dateReqs.requireEventDate || Boolean(state.eventDate.trim())) &&
    !pastDateError;
  const canContinue = datesOk && timingAllowsContinue(state, timingEval);
  const ambassadorCoach = state.methods.ambassador
    ? ambassadorTimingCoachMessage(state.endDate)
    : null;
  const showStart = dateReqs.requireStartDate || dateReqs.startOptional;
  /** Always Start → End (same order for online, ambassador, and business methods). */
  const startFirst = true;

  const subtitle = dateReqs.startOptional
    ? "When should this campaign end? A start date is optional."
    : "Tell us your campaign dates. Business methods need a start and end date.";

  /**
   * Handles Timeline Check CTAs (change date / drop business / confirm / review).
   * State only; launch enforcement remains on the server.
   */
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

  const clearTimingFlags = CLEAR_TIMING_FLAGS;

  const endField = (
    <div key="end" className="flex min-w-0 flex-col gap-2">
      <label className="flex h-6 items-center gap-1.5 text-sm font-semibold leading-none">
        End date
        {dateReqs.requireEndDate ? (
          <span className="text-primary" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      <UsDateInput
        aria-label={
          dateReqs.startOptional
            ? "When should this campaign end?"
            : "Campaign end date"
        }
        value={state.endDate}
        min={campaignDateMin(state.startDate)}
        onChange={(endDate) => update({ endDate, ...clearTimingFlags })}
        className={fieldClass}
      />
    </div>
  );

  const startField = showStart ? (
    <div key="start" className="flex min-w-0 flex-col gap-2">
      <label className="flex h-6 items-center gap-1.5 text-sm font-semibold leading-none">
        Start date
        {dateReqs.requireStartDate ? (
          <span className="text-primary" aria-hidden>
            *
          </span>
        ) : (
          <span className="font-normal text-muted-foreground">(optional)</span>
        )}
      </label>
      <UsDateInput
        aria-label={
          dateReqs.startOptional
            ? "Do you want to set a start date?"
            : "Campaign start date"
        }
        value={state.startDate}
        min={todayMin}
        max={state.endDate || undefined}
        onChange={(startDate) => update({ startDate, ...clearTimingFlags })}
        className={fieldClass}
      />
    </div>
  ) : null;

  return (
    <AiFlowShell
      title="Just the campaign dates"
      subtitle={subtitle}
      backStep="ai-campaign-build"
    >
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div
          className={
            showStart
              ? "grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6"
              : "space-y-4"
          }
        >
          {startFirst ? (
            <>
              {startField}
              {endField}
            </>
          ) : (
            <>
              {endField}
              {startField}
            </>
          )}
        </div>

        {dateReqs.requireEventDate ? (
          <div className="mt-5 flex min-w-0 flex-col gap-2 border-t border-border pt-5">
            <label className="flex h-6 items-center gap-1.5 text-sm font-semibold leading-none">
              Guest Bartending event date
              <span className="text-primary" aria-hidden>
                *
              </span>
            </label>
            <UsDateInput
              aria-label="Guest Bartending event date"
              value={state.eventDate}
              min={todayMin}
              onChange={(eventDate) => update({ eventDate, ...clearTimingFlags })}
              className={fieldClass}
            />
          </div>
        ) : null}

        {pastDateError ? (
          <p className="mt-4 text-xs font-medium text-destructive">{pastDateError}</p>
        ) : null}

        {ambassadorCoach ? (
          <p className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
            {ambassadorCoach}
          </p>
        ) : null}

        {datesOk ? (
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
      </div>

      <button
        type="button"
        disabled={!canContinue}
        onClick={() => {
          // Sync band onto state before leaving dates (server enforces again).
          if (
            timingEval.status === "limited_promotion_window" ||
            timingEval.status === "tight_timeline" ||
            timingEval.status === "too_soon"
          ) {
            if (!state.submitForForkupReview) {
              update({ businessTimingStatus: timingEval.status });
            }
          }
          const needsBusinessInvite =
            state.methods.giveback || state.methods.guestBartending;
          if (needsBusinessInvite) {
            goTo("businesses", { query: { returnTo: "ai-campaign-preview" } });
            return;
          }
          goTo("ai-campaign-preview");
        }}
        className="mt-8 inline-flex w-full items-center justify-center rounded-full bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-dark disabled:opacity-40"
      >
        {state.methods.giveback || state.methods.guestBartending
          ? "Continue to invite businesses"
          : "That's it! Continue to preview"}
      </button>
    </AiFlowShell>
  );
}
