/**
 * Campaign method timing rules (Nick V2 Layer 2) — frontend mirror of
 * Forkup-Server/src/legacy/lib/campaign-timing.ts.
 *
 * Purpose: Drive date-field requirements and short-timeline CTAs in the builder.
 * Backend remains the enforcement source of truth on save/launch.
 *
 * Inputs: selected methods + dates from CampaignState.
 * Outputs: timing status, messages, and CTA options (never "rejected").
 */
import type { CampaignState, SupportMethod } from "./campaign-context";
import { subtractCalendarDays, toDateOnlyString } from "./date-only";

export const BUSINESS_METHOD_MIN_LEAD_DAYS = 30;
export const FULL_SUCCESS_ENGINE_ACCEPT_LEAD_DAYS = 21;
export const AMBASSADOR_RECOMMENDED_DAYS = 14;

/**
 * Extra days beyond the 30-day ForkUp-review floor so organizers have room to
 * invite businesses before the 21-day limited-promotion accept window.
 */
export const SUGGESTED_START_LEAD_DAYS = BUSINESS_METHOD_MIN_LEAD_DAYS + 5;

/** Suggested campaign run length (start → end) for Build auto-fill. */
export const SUGGESTED_CAMPAIGN_LENGTH_DAYS = 30;

export type TimingStatus =
  | "ok"
  | "needs_forkup_review"
  | "limited_promotion_window";

export type TimingCta =
  | "change_date"
  | "continue_without_business_method"
  | "submit_for_forkup_review";

export type MethodTimingEvaluation = {
  status: TimingStatus;
  message: string | null;
  ctas: TimingCta[];
  daysUntilAnchor: number | null;
  anchorDate: string | null;
  anchorKind: "start" | "event" | "end" | null;
};

function todayDateOnly(): string {
  return toDateOnlyString(new Date());
}

/** Whole calendar days from today until target YYYY-MM-DD. */
export function daysUntil(dateStr: string | null | undefined): number | null {
  const target = toDateOnlyString(dateStr);
  if (!target) return null;
  const today = todayDateOnly();
  if (!today) return null;
  const [ty, tm, td] = today.split("-").map(Number);
  const [ay, am, ad] = target.split("-").map(Number);
  const t0 = new Date(ty, tm - 1, td).getTime();
  const a0 = new Date(ay, am - 1, ad).getTime();
  return Math.round((a0 - t0) / (24 * 60 * 60 * 1000));
}

export function hasGivebackMethod(methods: CampaignState["methods"]): boolean {
  return !!methods.giveback;
}

export function hasGuestBartendingMethod(methods: CampaignState["methods"]): boolean {
  return !!methods.guestBartending;
}

export function hasBusinessMethod(methods: CampaignState["methods"]): boolean {
  return hasGivebackMethod(methods) || hasGuestBartendingMethod(methods);
}

export function hasDefaultFundraisingLayer(methods: CampaignState["methods"]): boolean {
  return !!methods.donations || !!methods.ambassador;
}

/**
 * Which date fields the UI should require for the current method mix.
 */
export function dateFieldRequirements(methods: CampaignState["methods"]): {
  requireEndDate: boolean;
  requireStartDate: boolean;
  requireEventDate: boolean;
  startOptional: boolean;
} {
  const giveback = hasGivebackMethod(methods);
  const guest = hasGuestBartendingMethod(methods);
  return {
    requireEndDate: giveback || hasDefaultFundraisingLayer(methods) || (!giveback && !guest),
    requireStartDate: giveback,
    requireEventDate: guest,
    startOptional: !giveback && !guest,
  };
}

/**
 * Evaluates business-method lead time for UI coaching / CTAs.
 */
export function evaluateBusinessMethodTiming(state: CampaignState): MethodTimingEvaluation {
  const { methods } = state;
  if (!hasBusinessMethod(methods)) {
    return {
      status: "ok",
      message: null,
      ctas: [],
      daysUntilAnchor: null,
      anchorDate: null,
      anchorKind: null,
    };
  }

  let anchorDate: string | null = null;
  let anchorKind: "start" | "event" | null = null;
  let message: string | null = null;

  if (hasGuestBartendingMethod(methods)) {
    anchorDate = toDateOnlyString(state.eventDate) || null;
    anchorKind = "event";
    message =
      "Guest Bartending events need enough time to confirm the venue, prepare the guest bartenders, promote the event, and alert the business team. ForkUp review is required for events less than 30 days away.";
  } else {
    anchorDate = toDateOnlyString(state.startDate) || null;
    anchorKind = "start";
    message =
      "This campaign starts in less than 30 days. Business giveback campaigns need time for businesses to accept, prepare their team, and promote the campaign. ForkUp review is required before inviting businesses for this timeline.";
  }

  const days = daysUntil(anchorDate);
  if (days == null) {
    return {
      status: "ok",
      message: null,
      ctas: [],
      daysUntilAnchor: null,
      anchorDate,
      anchorKind,
    };
  }

  if (
    days >= BUSINESS_METHOD_MIN_LEAD_DAYS ||
    state.forkupReviewStatus === "approved"
  ) {
    return {
      status: "ok",
      message: null,
      ctas: [],
      daysUntilAnchor: days,
      anchorDate,
      anchorKind,
    };
  }

  return {
    status: "needs_forkup_review",
    message,
    ctas: [
      "change_date",
      "continue_without_business_method",
      "submit_for_forkup_review",
    ],
    daysUntilAnchor: days,
    anchorDate,
    anchorKind,
  };
}

/** Soft coaching for ambassador window (no hard block). */
export function ambassadorTimingCoachMessage(endDate?: string | null): string | null {
  const days = daysUntil(endDate);
  if (days == null) return null;
  if (days < AMBASSADOR_RECOMMENDED_DAYS) {
    return "This campaign can launch, but a longer window usually gives ambassadors more time to share and raise support.";
  }
  return null;
}

/**
 * Suggest start/end dates for the Build goal screen (L2 timing-safe defaults).
 *
 * Purpose: Pre-fill editable dates that avoid Needs ForkUp Review if giveback
 * is later selected (≥30 day lead) and leave invite buffer before the 21-day
 * limited-promotion accept floor. Online/ambassador still only require end.
 *
 * Inputs: optional "today" override (tests). Outputs: YYYY-MM-DD start/end.
 */
export function suggestCampaignDates(fromDate?: Date): {
  startDate: string;
  endDate: string;
} {
  const today = toDateOnlyString(fromDate ?? new Date());
  const startDate = subtractCalendarDays(today, -SUGGESTED_START_LEAD_DAYS);
  const endDate = subtractCalendarDays(startDate, -SUGGESTED_CAMPAIGN_LENGTH_DAYS);
  return { startDate, endDate };
}

export const TIMING_CTA_LABELS: Record<TimingCta, string> = {
  change_date: "Change Campaign Date",
  continue_without_business_method: "Continue Without Business Giveback",
  submit_for_forkup_review: "Submit for ForkUp Review",
};

/** Guest Bartending CTA label variant. */
export function timingCtaLabel(cta: TimingCta, methods: CampaignState["methods"]): string {
  if (cta === "change_date" && hasGuestBartendingMethod(methods)) {
    return "Change Event Date";
  }
  if (cta === "continue_without_business_method" && hasGuestBartendingMethod(methods)) {
    return "Continue With Online Donations / Ambassador Sharing Only";
  }
  return TIMING_CTA_LABELS[cta];
}

/** Enabled support methods for date UI helpers. */
export function enabledSupportMethods(methods: CampaignState["methods"]): SupportMethod[] {
  return (Object.keys(methods) as SupportMethod[]).filter((m) => methods[m]);
}
