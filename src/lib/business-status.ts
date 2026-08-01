/**
 * Campaign business invitation / participation statuses aligned with product spec.
 * Internal storage may use legacy values; display always uses spec labels.
 *
 * Nick V2 Layer 3: opened, needs_info, ready, expired + setup readiness labels.
 */

/** Product-spec business statuses for campaign participation. */
export type CampaignBusinessStatus =
  | "draft"
  | "invited"
  | "opened"
  | "awaiting_acceptance"
  | "changes_requested"
  | "needs_info"
  | "ready"
  | "accepted"
  | "declined"
  | "expired"
  | "active"
  | "removed";

/** Legacy builder/API statuses still in use during migration. */
export type LegacyBusinessInviteStatus =
  | "pending"
  | "accepted"
  | "changes-requested"
  | "declined";

/** API acceptance_status values from campaign_business_locations. */
export type ApiAcceptanceStatus =
  | "draft"
  | "invited"
  | "opened"
  | "pending"
  | "accepted"
  | "declined"
  | "changes_requested"
  | "needs_info"
  | "ready"
  | "expired"
  | "live"
  | "completed";

export const BUSINESS_STATUS_LABEL: Record<CampaignBusinessStatus, string> = {
  draft: "Draft",
  invited: "Invited",
  opened: "Opened",
  awaiting_acceptance: "Invited — Awaiting Acceptance",
  changes_requested: "Needs Info",
  needs_info: "Needs Info",
  ready: "Ready",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
  active: "Live",
  removed: "Removed",
};

export type SetupStatus = "pending" | "needs_info" | "ready" | "complete";

export const SETUP_STATUS_LABEL: Record<SetupStatus, string> = {
  pending: "Setup pending",
  needs_info: "Needs info",
  ready: "Setup ready",
  complete: "Setup complete",
};

/** Whether this status should appear on the public campaign page. */
export function isPublicParticipantStatus(status: CampaignBusinessStatus): boolean {
  return status === "accepted" || status === "active" || status === "ready";
}

/** Map legacy builder status to spec-aligned status. */
export function fromLegacyInviteStatus(
  status: LegacyBusinessInviteStatus,
): CampaignBusinessStatus {
  switch (status) {
    case "pending":
      return "awaiting_acceptance";
    case "accepted":
      return "accepted";
    case "changes-requested":
      return "changes_requested";
    case "declined":
      return "declined";
    default:
      return "awaiting_acceptance";
  }
}

/** Map API acceptance_status / invite_status to spec-aligned status. */
export function fromApiAcceptanceStatus(status: string): CampaignBusinessStatus {
  switch (status) {
    case "draft":
      return "draft";
    case "opened":
      return "opened";
    case "invited":
    case "pending":
      return "awaiting_acceptance";
    case "accepted":
      return "accepted";
    case "declined":
      return "declined";
    case "changes_requested":
      return "changes_requested";
    case "needs_info":
      return "needs_info";
    case "ready":
      return "ready";
    case "expired":
      return "expired";
    case "live":
    case "completed":
      return "active";
    default:
      return "awaiting_acceptance";
  }
}

/** Prefer invite_status when richer than acceptance_status (e.g. ready / needs_info after accept). */
export function fromInviteStatuses(
  acceptanceStatus: string,
  inviteStatus?: string | null,
): CampaignBusinessStatus {
  if (inviteStatus === "needs_info" || inviteStatus === "ready") {
    return fromApiAcceptanceStatus(inviteStatus);
  }
  return fromApiAcceptanceStatus(acceptanceStatus);
}

export function businessStatusTone(
  status: CampaignBusinessStatus,
): "default" | "success" | "warn" | "muted" | "destructive" {
  switch (status) {
    case "accepted":
    case "active":
    case "ready":
      return "success";
    case "awaiting_acceptance":
    case "invited":
    case "opened":
    case "changes_requested":
    case "needs_info":
      return "warn";
    case "declined":
    case "removed":
    case "expired":
      return "destructive";
    case "draft":
      return "muted";
    default:
      return "default";
  }
}

/** Format respond-by date for partner lists. */
export function formatRespondByLabel(respondByDate?: string | null): string | null {
  if (!respondByDate) return null;
  const d = new Date(`${respondByDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return respondByDate;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
