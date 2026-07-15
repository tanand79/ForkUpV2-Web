/**
 * Campaign business invitation / participation statuses aligned with product spec.
 * Internal storage may use legacy values; display always uses spec labels.
 */

/** Product-spec business statuses for campaign participation. */
export type CampaignBusinessStatus =
  | "draft"
  | "invited"
  | "awaiting_acceptance"
  | "changes_requested"
  | "accepted"
  | "declined"
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
  | "invited"
  | "pending"
  | "accepted"
  | "declined"
  | "changes_requested"
  | "live"
  | "completed";

export const BUSINESS_STATUS_LABEL: Record<CampaignBusinessStatus, string> = {
  draft: "Draft",
  invited: "Invited",
  awaiting_acceptance: "Invited — Awaiting Acceptance",
  changes_requested: "Changes Requested",
  accepted: "Accepted",
  declined: "Declined",
  active: "Active",
  removed: "Removed",
};

/** Whether this status should appear on the public campaign page. */
export function isPublicParticipantStatus(status: CampaignBusinessStatus): boolean {
  return status === "accepted" || status === "active";
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

/** Map API acceptance_status to spec-aligned status. */
export function fromApiAcceptanceStatus(status: string): CampaignBusinessStatus {
  switch (status) {
    case "invited":
    case "pending":
      return "awaiting_acceptance";
    case "accepted":
      return "accepted";
    case "declined":
      return "declined";
    case "changes_requested":
      return "changes_requested";
    case "live":
    case "completed":
      return "active";
    default:
      return "awaiting_acceptance";
  }
}

export function businessStatusTone(
  status: CampaignBusinessStatus,
): "default" | "success" | "warn" | "muted" | "destructive" {
  switch (status) {
    case "accepted":
    case "active":
      return "success";
    case "awaiting_acceptance":
    case "invited":
    case "changes_requested":
      return "warn";
    case "declined":
    case "removed":
      return "destructive";
    case "draft":
      return "muted";
    default:
      return "default";
  }
}
