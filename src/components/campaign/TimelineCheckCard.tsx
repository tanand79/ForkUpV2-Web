"use client";

/**
 * Timeline Check card — band-colored guidance + CTAs for business-method dates.
 *
 * Purpose: Show Limited / Tight / Too Soon messaging and action options from the
 * Campaign Timeline Check product flow (mirror of evaluateBusinessMethodTiming).
 *
 * Inputs: timing evaluation + campaign state callbacks.
 * Outputs: warning UI; optional business confirmation form for tight timeline.
 */
import type { CampaignState } from "@/lib/campaign-context";
import {
  isBusinessConfirmationComplete,
  timingBandTitle,
  timingCtaLabel,
  type MethodTimingEvaluation,
  type TimingCta,
} from "@/lib/campaign-timing";

const fieldClass =
  "h-11 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring/30";

type TimelineCheckCardProps = {
  timingEval: MethodTimingEvaluation;
  state: CampaignState;
  onCta: (cta: TimingCta) => void;
  onConfirmField: (patch: Partial<CampaignState>) => void;
  onConfirmContinue: () => void;
};

function bandStyles(status: MethodTimingEvaluation["status"]): {
  wrap: string;
  title: string;
  body: string;
  btn: string;
} {
  if (status === "too_soon") {
    return {
      wrap: "border-rose-300/70 bg-rose-50/90 dark:border-rose-800 dark:bg-rose-950/40",
      title: "text-rose-900 dark:text-rose-200",
      body: "text-rose-900/90 dark:text-rose-100/90",
      btn: "border-rose-400/70 hover:bg-rose-100/80 dark:hover:bg-rose-900/40",
    };
  }
  if (status === "tight_timeline" || status === "needs_forkup_review") {
    return {
      wrap: "border-orange-300/70 bg-orange-50/90 dark:border-orange-800 dark:bg-orange-950/40",
      title: "text-orange-950 dark:text-orange-200",
      body: "text-orange-950/90 dark:text-orange-100/90",
      btn: "border-orange-400/70 hover:bg-orange-100/80 dark:hover:bg-orange-900/40",
    };
  }
  // limited_promotion_window
  return {
    wrap: "border-amber-300/70 bg-amber-50/90 dark:border-amber-800 dark:bg-amber-950/40",
    title: "text-amber-900 dark:text-amber-200",
    body: "text-amber-900/90 dark:text-amber-100/90",
    btn: "border-amber-400/70 hover:bg-amber-100/80 dark:hover:bg-amber-900/40",
  };
}

/**
 * Renders Timeline Check guidance when business-method lead time is not healthy.
 * Returns null for ok / empty message.
 */
export function TimelineCheckCard({
  timingEval,
  state,
  onCta,
  onConfirmField,
  onConfirmContinue,
}: TimelineCheckCardProps) {
  if (
    timingEval.status === "ok" ||
    !timingEval.message ||
    (timingEval.status !== "limited_promotion_window" &&
      timingEval.status !== "tight_timeline" &&
      timingEval.status !== "too_soon" &&
      timingEval.status !== "needs_forkup_review")
  ) {
    return null;
  }

  const styles = bandStyles(timingEval.status);
  const confirmed = isBusinessConfirmationComplete(state);
  const showForm =
    timingEval.status === "tight_timeline" && state.showBusinessConfirmForm;

  return (
    <div className={`mt-5 space-y-3 rounded-2xl border p-4 ${styles.wrap}`}>
      <p className={`text-sm font-semibold ${styles.title}`}>
        {timingBandTitle(timingEval.status)}
        {timingEval.daysUntilAnchor != null
          ? ` · ${timingEval.daysUntilAnchor} day${timingEval.daysUntilAnchor === 1 ? "" : "s"}`
          : ""}
      </p>
      <p className={`text-sm ${styles.body}`}>{timingEval.message}</p>

      {state.submitForForkupReview &&
      (timingEval.status === "tight_timeline" ||
        timingEval.status === "needs_forkup_review") ? (
        <p className={`text-xs font-medium ${styles.title}`}>
          Submitted for ForkUp review. Online donations and ambassador sharing can still
          move forward. Business invitations stay paused until approved.
        </p>
      ) : null}

      {confirmed && timingEval.status === "tight_timeline" && !state.submitForForkupReview ? (
        <p className={`text-xs font-medium ${styles.title}`}>
          Business confirmation saved. You can continue — invites may proceed with this
          tight timeline.
        </p>
      ) : null}

      {timingEval.status === "limited_promotion_window" ? (
        <p className={`text-xs ${styles.body}`}>
          You can continue with this timeline. Expect a shorter runway for business
          acceptance and promotion.
        </p>
      ) : null}

      {!state.submitForForkupReview &&
      timingEval.ctas.length > 0 &&
      !showForm ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {timingEval.ctas.map((cta) => (
            <button
              key={cta}
              type="button"
              onClick={() => onCta(cta)}
              className={`rounded-full border bg-card px-4 py-2 text-xs font-semibold text-foreground transition-colors ${styles.btn}`}
            >
              {timingCtaLabel(cta, state.methods)}
            </button>
          ))}
        </div>
      ) : null}

      {showForm ? (
        <div className="space-y-3 rounded-xl border border-border/80 bg-card/80 p-4">
          <p className="text-sm font-semibold text-foreground">
            Business confirmation
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">
                Business Name <span className="text-primary">*</span>
              </label>
              <input
                className={fieldClass}
                value={state.confirmedBusinessName}
                onChange={(e) =>
                  onConfirmField({ confirmedBusinessName: e.target.value })
                }
                placeholder="Restaurant or venue name"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">
                Contact Name <span className="text-primary">*</span>
              </label>
              <input
                className={fieldClass}
                value={state.confirmedContactName}
                onChange={(e) =>
                  onConfirmField({ confirmedContactName: e.target.value })
                }
                placeholder="Who confirmed"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">
                Contact Email <span className="text-primary">*</span>
              </label>
              <input
                type="email"
                className={fieldClass}
                value={state.confirmedContactEmail}
                onChange={(e) =>
                  onConfirmField({ confirmedContactEmail: e.target.value })
                }
                placeholder="name@business.com"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">
                Confirmation Method <span className="text-primary">*</span>
              </label>
              <select
                className={fieldClass}
                value={state.confirmedMethod}
                onChange={(e) =>
                  onConfirmField({
                    confirmedMethod: e.target.value as CampaignState["confirmedMethod"],
                  })
                }
              >
                <option value="">Select…</option>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="in_person">In Person</option>
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-semibold">
                Confirmation Status <span className="text-primary">*</span>
              </label>
              <select
                className={fieldClass}
                value={state.confirmedStatus}
                onChange={(e) =>
                  onConfirmField({ confirmedStatus: e.target.value })
                }
              >
                <option value="">Select…</option>
                <option value="Business has agreed">Business has agreed</option>
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-semibold">Notes (optional)</label>
              <textarea
                className="min-h-[72px] w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30"
                value={state.confirmedNotes}
                onChange={(e) =>
                  onConfirmField({ confirmedNotes: e.target.value })
                }
                placeholder="Any details about the agreement"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!confirmed}
              onClick={onConfirmContinue}
              className="rounded-full bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground transition-opacity disabled:opacity-40"
            >
              Continue
            </button>
            <button
              type="button"
              onClick={() =>
                onConfirmField({
                  showBusinessConfirmForm: false,
                  confirmedBusinessName: "",
                  confirmedContactName: "",
                  confirmedContactEmail: "",
                  confirmedMethod: "",
                  confirmedStatus: "",
                  confirmedNotes: "",
                })
              }
              className="rounded-full border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
