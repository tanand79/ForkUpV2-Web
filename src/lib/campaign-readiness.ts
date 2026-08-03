/**
 * Multi-track campaign readiness (Nick V2 Layer 1).
 *
 * Purpose: Derive readiness per fundraising track so online donations and
 * ambassador sharing can show Ready while business giveback / guest bartending
 * remain waiting on acceptance or event details — without a single ready/not-ready
 * flag for the whole campaign.
 *
 * Inputs: CampaignState (+ optional accepted business count).
 * Outputs: Per-track status labels and an overall launch summary.
 */
import type { CampaignState } from "./campaign-context";
import { evaluateBusinessMethodTiming } from "./campaign-timing";

export type TrackStatus =
  | "not_selected"
  | "ready"
  | "waiting_on_business_acceptance"
  | "event_details_needed"
  | "payment_setup_needed"
  | "pending_setup"
  | "needs_forkup_review"
  | "limited_promotion_window";

export type OverallLaunchReadiness =
  | "draft"
  | "partially_ready"
  | "ready_to_launch"
  | "live";

export type CampaignReadinessTracks = {
  onlineDonationStatus: TrackStatus;
  ambassadorStatus: TrackStatus;
  dineDonateStatus: TrackStatus;
  guestBartendingStatus: TrackStatus;
  settlementStatus: TrackStatus;
  overallLaunchStatus: OverallLaunchReadiness;
};

export type ReadinessTrackRow = {
  id: keyof Omit<CampaignReadinessTracks, "overallLaunchStatus">;
  label: string;
  status: TrackStatus;
  display: string;
};

const TRACK_DISPLAY: Record<TrackStatus, string> = {
  not_selected: "Not selected",
  ready: "Ready",
  waiting_on_business_acceptance: "Waiting on business acceptance",
  event_details_needed: "Event details needed",
  payment_setup_needed: "Payment setup needed",
  pending_setup: "Setup needed",
  needs_forkup_review: "Needs ForkUp Review",
  limited_promotion_window: "Limited Promotion Window",
};

/**
 * Derives multi-track readiness from current campaign builder state.
 * Does not persist; Layer 2+ may mirror this on the server.
 */
export function deriveCampaignReadiness(
  state: CampaignState,
  opts: { acceptedBusinessCount?: number } = {},
): CampaignReadinessTracks {
  const acceptedCount =
    opts.acceptedBusinessCount ??
    Object.values(state.businessStatuses).filter((s) => s === "accepted").length +
      state.invited.filter((b) => b.status === "accepted").length +
      (state.lockedBusinessPartners?.length ?? 0);

  const invitedOrSelected =
    state.selectedBusinessIds.length > 0 ||
    state.invited.length > 0 ||
    (state.lockedBusinessPartners?.length ?? 0) > 0;

  const hasStory = !!state.description.trim();
  const hasEndDate = !!state.endDate;
  const hasCover = !!state.cover;
  const defaultLayerBasics = hasStory && hasEndDate && hasCover;

  let onlineDonationStatus: TrackStatus = "not_selected";
  if (state.methods.donations) {
    onlineDonationStatus = defaultLayerBasics ? "ready" : "pending_setup";
  }

  let ambassadorStatus: TrackStatus = "not_selected";
  if (state.methods.ambassador || state.methods.guestBartending) {
    ambassadorStatus = defaultLayerBasics ? "ready" : "pending_setup";
  }

  const timingEval = evaluateBusinessMethodTiming(state);
  const timingGate: TrackStatus | null =
    state.businessTimingStatus === "limited_promotion_window"
      ? "limited_promotion_window"
      : timingEval.status === "needs_forkup_review" ||
          state.submitForForkupReview ||
          state.businessTimingStatus === "needs_forkup_review"
        ? "needs_forkup_review"
        : null;

  let dineDonateStatus: TrackStatus = "not_selected";
  if (state.methods.giveback) {
    if (timingGate) {
      dineDonateStatus = timingGate;
    } else if (!invitedOrSelected) {
      dineDonateStatus = "waiting_on_business_acceptance";
    } else if (acceptedCount > 0) {
      dineDonateStatus = "ready";
    } else {
      dineDonateStatus = "waiting_on_business_acceptance";
    }
  }

  let guestBartendingStatus: TrackStatus = "not_selected";
  if (state.methods.guestBartending) {
    const hasEventDetails =
      !!state.eventDate ||
      state.guestBartenders.some((g) => !!g.eventDate && !!g.business);
    if (timingGate) {
      guestBartendingStatus = timingGate;
    } else if (!hasEventDetails) {
      guestBartendingStatus = "event_details_needed";
    } else if (acceptedCount > 0 || state.campaignOrigin === "business_invite") {
      guestBartendingStatus = "ready";
    } else if (invitedOrSelected) {
      guestBartendingStatus = "waiting_on_business_acceptance";
    } else {
      guestBartendingStatus = "waiting_on_business_acceptance";
    }
  }

  let settlementStatus: TrackStatus = "not_selected";
  if (state.methods.giveback || state.methods.guestBartending) {
    settlementStatus =
      acceptedCount > 0 ? "payment_setup_needed" : "waiting_on_business_acceptance";
  } else if (state.methods.donations || state.methods.ambassador) {
    // Online/ambassador-only: settlement track not blocking launch.
    settlementStatus = "ready";
  }

  const selectedTracks = [
    onlineDonationStatus,
    ambassadorStatus,
    dineDonateStatus,
    guestBartendingStatus,
  ].filter((s) => s !== "not_selected");

  let overallLaunchStatus: OverallLaunchReadiness = "draft";
  if (state.termsAccepted && selectedTracks.some((s) => s === "ready")) {
    const businessTracksPending = [dineDonateStatus, guestBartendingStatus].some(
      (s) =>
        s === "waiting_on_business_acceptance" ||
        s === "event_details_needed",
    );
    const defaultReady =
      (onlineDonationStatus === "ready" || onlineDonationStatus === "not_selected") &&
      (ambassadorStatus === "ready" || ambassadorStatus === "not_selected") &&
      (onlineDonationStatus === "ready" || ambassadorStatus === "ready");

    if (defaultReady && businessTracksPending) {
      overallLaunchStatus = "partially_ready";
    } else if (defaultReady || selectedTracks.every((s) => s === "ready")) {
      overallLaunchStatus = "ready_to_launch";
    } else {
      overallLaunchStatus = "partially_ready";
    }
  } else if (selectedTracks.some((s) => s === "ready" || s === "pending_setup")) {
    overallLaunchStatus = "partially_ready";
  }

  return {
    onlineDonationStatus,
    ambassadorStatus,
    dineDonateStatus,
    guestBartendingStatus,
    settlementStatus,
    overallLaunchStatus,
  };
}

/** Rows for UI display (skips not_selected tracks except settlement when relevant). */
export function readinessTrackRows(
  tracks: CampaignReadinessTracks,
): ReadinessTrackRow[] {
  const defs: Array<{
    id: ReadinessTrackRow["id"];
    label: string;
    status: TrackStatus;
  }> = [
    {
      id: "onlineDonationStatus",
      label: "Online Donations",
      status: tracks.onlineDonationStatus,
    },
    {
      id: "ambassadorStatus",
      label: "Ambassador Sharing",
      status: tracks.ambassadorStatus,
    },
    {
      id: "dineDonateStatus",
      label: "Business Giveback",
      status: tracks.dineDonateStatus,
    },
    {
      id: "guestBartendingStatus",
      label: "Guest Bartending",
      status: tracks.guestBartendingStatus,
    },
    {
      id: "settlementStatus",
      label: "Settlement",
      status: tracks.settlementStatus,
    },
  ];

  return defs
    .filter((d) => d.status !== "not_selected")
    .map((d) => ({
      ...d,
      display: TRACK_DISPLAY[d.status],
    }));
}
