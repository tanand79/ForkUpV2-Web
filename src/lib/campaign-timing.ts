/**
 * Campaign method timing rules (Nick V2 Layer 2 + Timeline Check bands) —
 * frontend mirror of Forkup-Server/src/legacy/lib/campaign-timing.ts.
 *
 * Purpose: Drive date-field requirements and Timeline Check CTAs in the builder.
 * Backend remains the enforcement source of truth on save/launch.
 *
 * Bands (business methods):
 * - 30+ → ok (healthy)
 * - 21–29 → limited_promotion_window (continue with warning)
 * - 8–20 → tight_timeline (confirm business / ForkUp review / switch)
 * - 0–7 → too_soon (block new business-based campaigns)
 */
import type { CampaignState, SupportMethod } from "./campaign-context";
import { subtractCalendarDays, toDateOnlyString } from "./date-only";

export const BUSINESS_METHOD_MIN_LEAD_DAYS = 30;
export const LIMITED_PROMOTION_LEAD_DAYS = 21;
export const TIGHT_TIMELINE_MIN_DAYS = 8;
export const FULL_SUCCESS_ENGINE_ACCEPT_LEAD_DAYS = 21;
export const AMBASSADOR_RECOMMENDED_DAYS = 14;

/**
 * Extra days beyond the 30-day healthy floor so organizers have room to
 * invite businesses before the 21-day limited-promotion accept window.
 */
export const SUGGESTED_START_LEAD_DAYS = BUSINESS_METHOD_MIN_LEAD_DAYS + 5;

/** Suggested campaign run length (start → end) for Build auto-fill. */
export const SUGGESTED_CAMPAIGN_LENGTH_DAYS = 30;

export type TimingStatus =
  | "ok"
  | "needs_forkup_review"
  | "limited_promotion_window"
  | "tight_timeline"
  | "too_soon";

export type TimingCta =
  | "change_date"
  | "continue_without_business_method"
  | "confirm_business"
  | "submit_for_forkup_review";

export type MethodTimingEvaluation = {
  status: TimingStatus;
  message: string | null;
  ctas: TimingCta[];
  daysUntilAnchor: number | null;
  anchorDate: string | null;
  anchorKind: "start" | "event" | "end" | null;
};

export type ConfirmedMethod = "email" | "phone" | "in_person";

/**
 * Today's calendar date as YYYY-MM-DD (local).
 * Purpose: Floor for campaign date pickers and past-date validation.
 */
export function todayDateOnly(): string {
  return toDateOnlyString(new Date());
}

/**
 * Returns an error when a provided campaign date is before today; null when OK or empty.
 * Purpose: UI attention messages mirroring server past-date hard checks.
 * Inputs: optional start/end/event YYYY-MM-DD. Outputs: first matching error string or null.
 */
export function campaignDateNotInPastError(input: {
  startDate?: string | null;
  endDate?: string | null;
  eventDate?: string | null;
}): string | null {
  const today = todayDateOnly();
  if (!today) return null;
  const startDate = toDateOnlyString(input.startDate);
  const endDate = toDateOnlyString(input.endDate);
  const eventDate = toDateOnlyString(input.eventDate);
  if (startDate && startDate < today) {
    return "Campaign start date cannot be in the past";
  }
  if (endDate && endDate < today) {
    return "Campaign end date cannot be in the past";
  }
  if (eventDate && eventDate < today) {
    return "Event date cannot be in the past";
  }
  return null;
}

/**
 * Earliest selectable day for a campaign date field (not before today;
 * and not before any extra bound such as start date).
 * Inputs: optional YYYY-MM-DD bounds. Outputs: YYYY-MM-DD min for UsDateInput.
 */
export function campaignDateMin(
  ...bounds: Array<string | null | undefined>
): string {
  const today = todayDateOnly();
  const candidates = [today, ...bounds.map((b) => toDateOnlyString(b))]
    .filter((v): v is string => Boolean(v))
    .sort();
  return candidates[candidates.length - 1] ?? today;
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
 * Map whole days until start/event into a Timeline Check band status.
 */
export function timingBandFromDays(days: number): TimingStatus {
  if (days >= BUSINESS_METHOD_MIN_LEAD_DAYS) return "ok";
  if (days >= LIMITED_PROMOTION_LEAD_DAYS) return "limited_promotion_window";
  if (days >= TIGHT_TIMELINE_MIN_DAYS) return "tight_timeline";
  return "too_soon";
}

/** True when the confirmation form has all required fields. */
export function isBusinessConfirmationComplete(state: {
  confirmedBusinessName?: string | null;
  confirmedContactName?: string | null;
  confirmedContactEmail?: string | null;
  confirmedMethod?: string | null;
  confirmedStatus?: string | null;
}): boolean {
  const name = String(state.confirmedBusinessName ?? "").trim();
  const contact = String(state.confirmedContactName ?? "").trim();
  const email = String(state.confirmedContactEmail ?? "").trim();
  const method = String(state.confirmedMethod ?? "").trim().toLowerCase();
  const status = String(state.confirmedStatus ?? "").trim();
  if (!name || !contact || !email || !method || !status) return false;
  if (!["email", "phone", "in_person"].includes(method)) return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  return true;
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

function bandMessage(
  status: TimingStatus,
  days: number,
  kind: "start" | "event",
): string {
  const when =
    kind === "event"
      ? `event is ${days} day${days === 1 ? "" : "s"} away`
      : `campaign starts in ${days} day${days === 1 ? "" : "s"}`;
  if (status === "limited_promotion_window") {
    return `Limited promotion window: your ${when}. You can continue, but there is less time for businesses to accept and for full promotion.`;
  }
  if (status === "tight_timeline") {
    return `Tight timeline: your ${when}. Businesses usually need more time to prepare and promote. Confirm an existing business agreement, submit for ForkUp review, change the date, or continue with Online Donation / Ambassador Sharing only.`;
  }
  if (status === "too_soon") {
    return `Too soon: your ${when}. New business-based campaigns cannot start within 7 days. Change the date or switch to Online Donation / Ambassador Sharing.`;
  }
  return "";
}

const TIGHT_CTAS: TimingCta[] = [
  "change_date",
  "continue_without_business_method",
  "confirm_business",
  "submit_for_forkup_review",
];

const TOO_SOON_CTAS: TimingCta[] = [
  "change_date",
  "continue_without_business_method",
];

/**
 * Evaluates business-method lead time into Timeline Check bands.
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

  const reviewApproved = state.forkupReviewStatus === "approved";

  let worstDays: number | null = null;
  let anchorDate: string | null = null;
  let anchorKind: "start" | "event" | null = null;

  const considerAnchor = (
    dateStr: string | null | undefined,
    kind: "start" | "event",
  ) => {
    const normalized = toDateOnlyString(dateStr) || null;
    const days = daysUntil(normalized);
    if (days == null) return;
    if (worstDays == null || days < worstDays) {
      worstDays = days;
      anchorDate = normalized;
      anchorKind = kind;
    }
  };

  if (hasGivebackMethod(methods)) {
    considerAnchor(state.startDate, "start");
  }
  if (hasGuestBartendingMethod(methods)) {
    considerAnchor(state.eventDate, "event");
  }

  if (worstDays == null || !anchorKind) {
    return {
      status: "ok",
      message: null,
      ctas: [],
      daysUntilAnchor: null,
      anchorDate,
      anchorKind,
    };
  }

  if (reviewApproved) {
    return {
      status: "ok",
      message: null,
      ctas: [],
      daysUntilAnchor: worstDays,
      anchorDate,
      anchorKind,
    };
  }

  const band = timingBandFromDays(worstDays);
  if (band === "ok") {
    return {
      status: "ok",
      message: null,
      ctas: [],
      daysUntilAnchor: worstDays,
      anchorDate,
      anchorKind,
    };
  }

  const message = bandMessage(band, worstDays, anchorKind);
  if (band === "limited_promotion_window") {
    return {
      status: "limited_promotion_window",
      message,
      ctas: [],
      daysUntilAnchor: worstDays,
      anchorDate,
      anchorKind,
    };
  }
  if (band === "tight_timeline") {
    return {
      status: "tight_timeline",
      message,
      ctas: [...TIGHT_CTAS],
      daysUntilAnchor: worstDays,
      anchorDate,
      anchorKind,
    };
  }
  return {
    status: "too_soon",
    message,
    ctas: [...TOO_SOON_CTAS],
    daysUntilAnchor: worstDays,
    anchorDate,
    anchorKind,
  };
}

/**
 * Whether the organizer may continue past the dates step with current timing choices.
 * too_soon blocks until date/methods change; tight needs confirm or ForkUp review.
 */
export function timingAllowsContinue(
  state: CampaignState,
  evaluation?: MethodTimingEvaluation,
): boolean {
  const timing = evaluation ?? evaluateBusinessMethodTiming(state);
  if (timing.status === "ok" || timing.status === "limited_promotion_window") {
    return true;
  }
  if (timing.status === "too_soon") return false;
  if (timing.status === "tight_timeline") {
    return (
      state.submitForForkupReview || isBusinessConfirmationComplete(state)
    );
  }
  if (timing.status === "needs_forkup_review") {
    return state.submitForForkupReview;
  }
  return true;
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

/**
 * Suggest dates for Online Donations / Ambassador Sharing (default fundraising layer).
 */
export function suggestOnlineCampaignDates(fromDate?: Date): {
  startDate: string;
  endDate: string;
} {
  const today = toDateOnlyString(fromDate ?? new Date());
  return {
    startDate: "",
    endDate: subtractCalendarDays(today, -AMBASSADOR_RECOMMENDED_DAYS),
  };
}

export const TIMING_CTA_LABELS: Record<TimingCta, string> = {
  change_date: "Change Campaign / Event Dates",
  continue_without_business_method:
    "Continue with Online Donation / Ambassador Sharing Only",
  confirm_business: "I Already Have a Business Confirmed",
  submit_for_forkup_review: "Submit for ForkUp Review",
};

/** Guest Bartending / combined business-method CTA label variants. */
export function timingCtaLabel(cta: TimingCta, methods: CampaignState["methods"]): string {
  if (
    cta === "change_date" &&
    hasGivebackMethod(methods) &&
    hasGuestBartendingMethod(methods)
  ) {
    return "Change Campaign / Event Dates";
  }
  if (cta === "change_date" && hasGuestBartendingMethod(methods)) {
    return "Change Event Date";
  }
  if (cta === "change_date" && hasGivebackMethod(methods)) {
    return "Change Campaign Date";
  }
  if (cta === "continue_without_business_method" && hasGuestBartendingMethod(methods)) {
    return "Continue With Online Donations / Ambassador Sharing Only";
  }
  return TIMING_CTA_LABELS[cta];
}

/** Band title for Timeline Check card header. */
export function timingBandTitle(status: TimingStatus): string {
  switch (status) {
    case "limited_promotion_window":
      return "Limited Promotion Window";
    case "tight_timeline":
      return "Tight Timeline";
    case "too_soon":
      return "Too Soon";
    case "needs_forkup_review":
      return "Needs ForkUp Review";
    default:
      return "Timeline Check";
  }
}

/** Enabled support methods for date UI helpers. */
export function enabledSupportMethods(methods: CampaignState["methods"]): SupportMethod[] {
  return (Object.keys(methods) as SupportMethod[]).filter((m) => methods[m]);
}

/** Cleared confirmation + CTA flags when dates change. */
export const CLEAR_TIMING_FLAGS = {
  submitForForkupReview: false as const,
  continueWithoutBusinessMethods: false as const,
  showBusinessConfirmForm: false as const,
  confirmedBusinessName: "",
  confirmedContactName: "",
  confirmedContactEmail: "",
  confirmedMethod: "" as const,
  confirmedStatus: "",
  confirmedNotes: "",
};
