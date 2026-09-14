/**
 * Pass A/B — restaurant vs local business door hint (session only; no API).
 * Purpose: Remember which Join Us door the user chose for profile CTA copy.
 * Inputs: door id from homepage. Outputs: sessionStorage read/write helpers + CTA label.
 */

export const BUSINESS_DOOR_KEY = "forkup-business-door";

export type BusinessDoor = "restaurant" | "local";

/** Stash the Join Us business door for later profile copy. */
export function stashBusinessDoor(door: BusinessDoor) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(BUSINESS_DOOR_KEY, door);
}

/** Read the stashed business door, if any. */
export function readBusinessDoor(): BusinessDoor | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(BUSINESS_DOOR_KEY);
  if (raw === "restaurant" || raw === "local") return raw;
  return null;
}

/** Nick CTA language for business doors. */
export function businessProfileCtaLabel(door: BusinessDoor | null): string {
  return door === "restaurant"
    ? "Create My Restaurant Profile"
    : "Create My Business Profile";
}

/** Soft role label for business onboarding chrome. */
export function businessDoorRoleLabel(door: BusinessDoor | null): string {
  return door === "restaurant" ? "restaurant" : "business";
}
