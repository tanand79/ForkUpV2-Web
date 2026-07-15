import bizCafe from "@/assets/biz-cafe.jpg";
import { assetSrc } from "@/lib/utils";
import bizBakery from "@/assets/biz-bakery.jpg";
import bizBookstore from "@/assets/biz-bookstore.jpg";
import bizGrocery from "@/assets/biz-grocery.jpg";
import bizRestaurant from "@/assets/biz-restaurant.jpg";
import bizRetail from "@/assets/biz-retail.jpg";

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
 * Infer capability flags from a business's category/type. Used both for the
 * curated list below and for newly invited businesses (so a freshly added
 * business gets sensible defaults that the organizer can refine).
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

// V1: Manually curated and ranked by ForkUp Admin (highest quality first).
// Capability flags are merged from `inferCapabilities` so the curated data and
// invitation gating stay in sync.
function makeBusiness(b: Omit<Business, keyof BusinessCapabilities>): Business {
  return { ...b, ...inferCapabilities(b) };
}

export const suggestedBusinesses: Business[] = [
  makeBusiness({
    id: "wildflower",
    name: "Wildflower Cafe",
    type: "Organic Restaurant",
    category: "Coffee Shop",
    location: "West Chester",
    image: assetSrc(bizCafe),
    status: "On ForkUp",
    supportMethods: ["Dine In", "Takeout"],
    description:
      "A neighborhood organic cafe serving breakfast, lunch, and locally roasted coffee in the heart of West Chester.",
    campaignTypes: ["Giveback Campaign", "Event Night", "Virtual Donations"],
  }),
  makeBusiness({
    id: "loaf-bloom",
    name: "Loaf & Bloom",
    type: "Artisanal Bakery",
    category: "Bakery",
    location: "West Chester",
    image: assetSrc(bizBakery),
    status: "Previously Participated",
    supportMethods: ["Dine In", "Takeout"],
    description:
      "An artisanal bakery offering fresh breads, pastries, and coffee. A previous ForkUp campaign participant.",
    campaignTypes: ["Giveback Campaign", "Virtual Donations"],
  }),
  makeBusiness({
    id: "paper-pine",
    name: "Paper & Pine",
    type: "Independent Bookstore",
    category: "Retail",
    location: "Downingtown",
    image: assetSrc(bizBookstore),
    status: "Preloaded",
    supportMethods: ["Shop In Store"],
    description:
      "An independent bookstore stocking new and used titles, gifts, and stationery.",
    campaignTypes: ["Giveback Campaign", "Virtual Donations"],
  }),
  makeBusiness({
    id: "green-leaf",
    name: "Green Leaf Market",
    type: "Organic Grocer",
    category: "Grocery",
    location: "Exton",
    image: assetSrc(bizGrocery),
    status: "On ForkUp",
    supportMethods: ["Shop In Store"],
    description:
      "A community organic grocer offering fresh produce, pantry staples, and prepared foods.",
    campaignTypes: ["Giveback Campaign", "Virtual Donations"],
  }),
  makeBusiness({
    id: "harvest-table",
    name: "The Harvest Table",
    type: "Farm-to-Table Restaurant",
    category: "Restaurant",
    location: "West Chester",
    image: assetSrc(bizRestaurant),
    status: "Invite Needed",
    supportMethods: ["Dine In", "Takeout", "Attend Event"],
    description:
      "A farm-to-table restaurant sourcing seasonal ingredients from local growers.",
    campaignTypes: ["Giveback Campaign", "Guest Bartender", "Event Night"],
  }),
  makeBusiness({
    id: "hearth-home",
    name: "Hearth & Home",
    type: "Home Goods Retail",
    category: "Retail",
    location: "Malvern",
    image: assetSrc(bizRetail),
    status: "Preloaded",
    supportMethods: ["Shop In Store", "Book Appointment"],
    description:
      "A home goods boutique carrying furniture, decor, and gifts for the home.",
    campaignTypes: ["Giveback Campaign", "Virtual Donations"],
  }),
];
