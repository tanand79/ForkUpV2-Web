import type { ApiBusiness } from "@/lib/api";
import { apiBusinessId } from "@/lib/builder-submit";
import type { Business, BusinessStatus } from "@/data/businesses";
import bizRestaurant from "@/assets/biz-restaurant.jpg";
import { assetSrc } from "@/lib/utils";

function mapStatus(businessStatus?: string): BusinessStatus {
  if (businessStatus === "active" || businessStatus === "claimed") return "On ForkUp";
  if (businessStatus === "preloaded") return "Preloaded";
  return "Invite Needed";
}

function capabilitiesFromApi(caps: string[]) {
  return {
    supportsDineDonate: caps.includes("dine_and_donate"),
    supportsShopDonate: caps.includes("shop_and_donate"),
    supportsServiceGiveback: caps.includes("service_giveback"),
    supportsGuestBartending: caps.includes("guest_bartending_event"),
    supportsAmbassadorTracking:
      caps.includes("ambassador_fundraising") || caps.includes("virtual_donations"),
  };
}

/** Flatten API businesses to one card per location (location-level participation). */
export function mapApiBusinessesToUi(apiBusinesses: ApiBusiness[]): Business[] {
  const rows: Business[] = [];

  for (const api of apiBusinesses) {
    const caps = capabilitiesFromApi(api.capabilities);
    for (const loc of api.locations) {
      const locationLabel = [loc.locationName, loc.city, loc.state].filter(Boolean).join(", ");
      rows.push({
        id: apiBusinessId(api.id, loc.id),
        name: api.locations.length > 1 ? `${api.businessName} — ${loc.locationName}` : api.businessName,
        type: api.businessType || "Business",
        category: api.businessType || "Business",
        location: locationLabel || loc.locationName,
        image: assetSrc(bizRestaurant),
        status: mapStatus(),
        supportMethods: api.capabilities.map((c) => c.replace(/_/g, " ")),
        description: `${api.businessName} participates in community fundraising through ForkUp.`,
        campaignTypes: api.capabilities,
        ...caps,
      });
    }
  }

  return rows;
}
