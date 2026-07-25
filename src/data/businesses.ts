export type BusinessStatus =
  | "On ForkUp"
  | "Preloaded"
  | "Previously Participated"
  | "Invite Needed";

// ─────────────────────────────────────────────────────────────────────────
// Business capability flags
//
// A business can only be invited to fundraising methods it actually supports.
// These flags are the single source of truth for invitation gating. Future
// methods plug in by adding a flag here and a corresponding method type in
// `method-timing.ts`.
//   • supportsDineDonate        — restaurants, cafes, bars (dine in / takeout)
//   • supportsShopDonate        — retail, grocery, bookstores (shop in store)
//   • supportsServiceGiveback   — salons, fitness, service businesses
//   • supportsGuestBartending   — businesses that can host a bartending event
//   • supportsAmbassadorTracking — businesses that support ambassador codes
// ─────────────────────────────────────────────────────────────────────────
export interface BusinessCapabilities {
  supportsDineDonate: boolean;
  supportsShopDonate: boolean;
  supportsServiceGiveback: boolean;
  supportsGuestBartending: boolean;
  supportsAmbassadorTracking: boolean;
}

export interface Business extends BusinessCapabilities {
  id: string;
  name: string;
  type: string;
  category: string;
  location: string;
  image: string;
  status: BusinessStatus;
  invited?: boolean;
  // Factual Campaign Snapshot — no opinions, recommendations, or AI-generated
  // fit suggestions. Only data we can actually back up.
  // supportMethods: how supporters would participate (e.g. "Dine In").
  // description + campaignTypes are used by the Business Profile preview.
  supportMethods: string[];
  description: string;
  campaignTypes: string[];
}

/**
 * Infer capability flags from a business's category/type. Used for API-mapped
 * businesses and newly invited businesses (sensible defaults organizers can refine).
 */
export function inferCapabilities(
  input: Pick<Business, "category" | "type">,
): BusinessCapabilities {
  const haystack = `${input.category} ${input.type}`.toLowerCase();
  const has = (...keys: string[]) => keys.some((k) => haystack.includes(k));

  const dining = has(
    "restaurant",
    "cafe",
    "café",
    "coffee",
    "bakery",
    "bar",
    "diner",
    "eatery",
    "bistro",
    "grill",
    "pub",
  );
  const retail = has("retail", "grocery", "market", "shop", "store", "boutique", "bookstore");
  const service = has("salon", "spa", "fitness", "studio", "service", "barber", "wellness");
  // Only places that serve drinks / have a bar can host guest bartending.
  const canBartend = has("restaurant", "bar", "pub", "grill", "bistro", "brewery", "tavern", "eatery");

  return {
    supportsDineDonate: dining,
    supportsShopDonate: retail,
    supportsServiceGiveback: service,
    supportsGuestBartending: canBartend,
    // Any business can carry an ambassador tracking code.
    supportsAmbassadorTracking: true,
  };
}

/**
 * Legacy curated catalog — emptied. Business picker loads from the API only
 * (`/api/builder/businesses`). Invite-by-hand still works with no catalog rows.
 */
export const suggestedBusinesses: Business[] = [];
