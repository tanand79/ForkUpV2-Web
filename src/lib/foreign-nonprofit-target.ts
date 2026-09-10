/**
 * foreign-nonprofit-target
 *
 * Purpose: Detect when a campaign draft targets an NPO the user does not own.
 * Used to force the fundraiser (invite) path so create/launch cannot attach the
 * campaign to a different membership org (e.g. Hear To Heal hijacking Headstrong).
 *
 * Inputs:
 * - pending — draft nonprofitProfile (invite/search target)
 * - memberships — organization_users nonprofit profiles for the signed-in user
 *
 * Outputs:
 * - true when the user already has ≥1 NPO membership and pending is a different org
 * - false when there is no pending org, no memberships, or pending matches a membership
 */

export type NonprofitTargetRef = {
  id?: number;
  organizationName?: string;
};

export function isForeignNonprofitTarget(
  pending: NonprofitTargetRef | null | undefined,
  memberships: NonprofitTargetRef[],
): boolean {
  const name = pending?.organizationName?.trim();
  if (!name) return false;
  if (!memberships.length) return false;

  const pendingId =
    typeof pending?.id === "number" && Number.isFinite(pending.id) && pending.id > 0
      ? pending.id
      : null;

  if (pendingId != null) {
    return !memberships.some((m) => m.id === pendingId);
  }

  const normalized = name.toLowerCase();
  return !memberships.some(
    (m) => (m.organizationName ?? "").trim().toLowerCase() === normalized,
  );
}

/**
 * True when guest/AI find-org already marked fundraiser and a target org is set.
 * Used before login (memberships empty) to lock the auth account-type picker.
 */
export function isFundraiserOrgDraftLocked(
  accountIntent: string | null | undefined,
  pending: NonprofitTargetRef | null | undefined,
): boolean {
  return (
    accountIntent === "fundraiser" &&
    Boolean(pending?.organizationName?.trim())
  );
}
