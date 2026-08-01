import type { CampaignState } from "@/lib/campaign-context";
import { assetSrc } from "@/lib/utils";
import { formatDateUs } from "@/lib/date-only";
import {
  type Business,
  type BusinessCapabilities,
} from "@/data/businesses";
import bizFallback from "@/assets/biz-restaurant.jpg";

/**
 * Public Campaign Page display helpers.
 *
 * These translate builder `CampaignState` (and nonprofit profile when set)
 * into values the public page renders. Empty builder fields yield neutral
 * placeholders — never fictitious campaign content.
 */

/** Campaign headline title. */
export function getCampaignTitle(state: CampaignState): string {
  const title = state.title?.trim();
  if (title) return title;
  const org = state.nonprofitProfile?.organizationName?.trim();
  if (org) return `Support ${org}`;
  return "Campaign";
}

/** Nonprofit display name derived from profile or campaign title. */
export function getNonprofitName(state: CampaignState): string {
  const org = state.nonprofitProfile?.organizationName?.trim();
  if (org) return org;
  const title = state.title?.trim();
  if (title) {
    const match = title.match(/^support\s+(.+)$/i);
    return (match ? match[1] : title).trim();
  }
  return "this cause";
}

/** Two-letter initials for the nonprofit avatar. */
export function getNonprofitInitials(state: CampaignState): string {
  const name = getNonprofitName(state);
  if (name === "this cause") return "NP";
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "NP"
  );
}

/** Campaign story / description for the "About the Cause" section. */
export function getCampaignStory(state: CampaignState): string {
  return state.description?.trim() || "";
}

/** Cover image URL, or null to use the section's built-in fallback image. */
export function getCoverImage(state: CampaignState): string | null {
  return state.cover?.url ?? null;
}

function formatDate(iso: string): string | null {
  if (!iso) return null;
  const label = formatDateUs(iso);
  return label === "—" ? null : label;
}

/** Human-readable campaign date label, or empty when dates are not set. */
export function getCampaignDateLabel(state: CampaignState): string {
  const start = formatDate(state.startDate);
  const end = formatDate(state.endDate);
  if (start && end) return start === end ? start : `${start} – ${end}`;
  if (start) return start;
  if (end) return end;
  return "";
}

export type PublicBusinessType = "dine" | "shop" | "service" | "event" | "other";

export interface PublicLocation {
  id: number;
  sourceId: string;
  name: string;
  image: string;
  city: string;
  address: string;
  type: PublicBusinessType;
  description: string;
  actionLine: string;
  donationPercent: number;
  supporterCount: number;
  booking: {
    platform: "resy" | "opentable" | "walkin" | "store" | "appointment";
    label: string;
    url: string | null;
  };
}

function typeFromCapabilities(c?: BusinessCapabilities): PublicBusinessType {
  if (!c) return "other";
  if (c.supportsDineDonate) return "dine";
  if (c.supportsShopDonate) return "shop";
  if (c.supportsServiceGiveback) return "service";
  if (c.supportsGuestBartending) return "event";
  return "other";
}

const ACTION_LINE: Record<PublicBusinessType, string> = {
  dine: "Dine In or Takeout",
  shop: "Shop In Store",
  service: "Book an Appointment",
  event: "Attend Event",
  other: "Participate",
};

const DEFAULT_BOOKING: Record<PublicBusinessType, PublicLocation["booking"]> = {
  dine: { platform: "walkin", label: "Walk-ins Welcome", url: null },
  shop: { platform: "store", label: "Visit Store", url: null },
  service: { platform: "appointment", label: "Book Appointment", url: null },
  event: { platform: "walkin", label: "Attend Event", url: null },
  other: { platform: "walkin", label: "Participate", url: null },
};

export function hasCampaignBusinesses(state: CampaignState): boolean {
  return state.selectedBusinessIds.length > 0 || state.invited.length > 0;
}

function fromSuggested(b: Business, index: number, fallbackPercent: number): PublicLocation {
  const type = typeFromCapabilities(b);
  return {
    id: index,
    sourceId: b.id,
    name: b.name,
    image: b.image,
    city: b.location,
    address: b.location,
    type,
    description: b.description,
    actionLine: ACTION_LINE[type],
    donationPercent: fallbackPercent,
    supporterCount: 0,
    booking: DEFAULT_BOOKING[type],
  };
}

function fromInvited(
  b: CampaignState["invited"][number],
  index: number,
  fallbackPercent: number,
): PublicLocation {
  const type = typeFromCapabilities(b.capabilities);
  const base = DEFAULT_BOOKING[type];
  return {
    id: index,
    sourceId: `invited-${index}`,
    name: b.name,
    image: assetSrc(bizFallback),
    city: b.location || "",
    address: b.location || "",
    type,
    description: b.note || `${b.name} is participating in this campaign.`,
    actionLine: b.participationMethod || ACTION_LINE[type],
    donationPercent: b.givebackPercent ?? fallbackPercent,
    supporterCount: b.supporterCount ?? 0,
    booking: b.bookingUrl
      ? { platform: base.platform, label: b.ctaLabel || base.label, url: b.bookingUrl }
      : b.ctaLabel
        ? { ...base, label: b.ctaLabel }
        : base,
  };
}

/** Public list of participating businesses — accepted only. */
export function getPublicLocations(state: CampaignState): PublicLocation[] {
  const percent = state.giveback || 15;
  const catalog = state.businessCatalog ?? [];
  const acceptedSuggested = catalog.filter(
    (b) =>
      state.selectedBusinessIds.includes(b.id) &&
      state.businessStatuses[b.id] === "accepted",
  );
  const acceptedInvited = state.invited.filter((b) => b.status === "accepted");

  const result: PublicLocation[] = [];
  let i = 0;
  for (const b of acceptedSuggested) result.push(fromSuggested(b, i++, percent));
  for (const b of acceptedInvited) result.push(fromInvited(b, i++, percent));
  return result;
}
