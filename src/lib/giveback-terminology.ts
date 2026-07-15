import type { Business } from "@/data/businesses";

/**
 * "Dine & Donate / Local Giveback" terminology helpers.
 *
 * ForkUp supports a single giveback campaign type that works for restaurants,
 * coffee shops, retail, salons, fitness, and other local businesses. The copy
 * adapts to the businesses involved:
 *   • Restaurants involved      → lead with the familiar "Dine & Donate"
 *   • Mixed / non-restaurant     → use the broader "Local Giveback"
 *   • Platform category label    → "Dine & Donate / Local Giveback"
 */

// The official platform-facing label for the fundraising category.
export const GIVEBACK_CATEGORY_LABEL = "Dine & Donate / Local Giveback";

/** True when a business is a dining establishment (restaurant, cafe, etc.). */
export function isDiningBusiness(b: Pick<Business, "category" | "type">): boolean {
  const haystack = `${b.category} ${b.type}`.toLowerCase();
  return ["restaurant", "cafe", "café", "coffee", "bakery", "bar", "diner", "eatery", "bistro", "grill", "pub"].some(
    (k) => haystack.includes(k),
  );
}

/** Per-business profile line based on whether it's a restaurant. */
export function businessParticipationLine(b: Pick<Business, "category" | "type">): string {
  return isDiningBusiness(b)
    ? "Participates in Dine & Donate Campaigns"
    : "Participates in Local Giveback Campaigns";
}

/**
 * Campaign-level term. If every participating business is a dining business,
 * use "Dine & Donate"; with mixed business types, use "Local Giveback".
 * With no businesses yet, default to the familiar "Dine & Donate".
 */
export function campaignGivebackTerm(businesses: Pick<Business, "category" | "type">[]): "Dine & Donate" | "Local Giveback" {
  if (businesses.length === 0) return "Dine & Donate";
  return businesses.every(isDiningBusiness) ? "Dine & Donate" : "Local Giveback";
}

/** "Dine & Donate Campaign" / "Local Giveback Campaign". */
export function campaignGivebackLabel(businesses: Pick<Business, "category" | "type">[]): string {
  return `${campaignGivebackTerm(businesses)} Campaign`;
}

/** Invite copy for a single invited business. */
export function inviteHeadline(b: Pick<Business, "category" | "type">): string {
  return isDiningBusiness(b)
    ? "You've been invited to participate in a Dine & Donate campaign."
    : "You've been invited to participate in a Local Giveback campaign.";
}
