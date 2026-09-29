/**
 * Pass D2 — session draft for Restaurant / Local 4-step giveback join.
 * Purpose: Persist name → found profile → giveback prefs → email across steps.
 * Inputs/outputs: load/save/clear helpers for BusinessJoinFourStepDraft.
 */
import type { FindBusinessProfileResult } from "@/lib/api-business-onboarding";
import type { BusinessDoor } from "@/lib/business-door";
import {
  defaultVenueHours,
  normalizeVenueHours,
  type VenueDiscountHours,
} from "@/lib/business-venue-profile";

const KEY = "forkup-business-join-four-step";

export type LocalGivebackMode = "percent_of_purchase" | "dollar_per_visit" | "special_offer";
export type CauseMode = "pick_now" | "forkup_match";

export type BusinessJoinFourStepDraft = {
  door: BusinessDoor | null;
  nameQuery: string;
  /** Additive: US ZIP for nearby store resolution (NPO-style). */
  nearZip: string;
  /**
   * Additive: free-text nearby hint — ZIP and/or "City, ST" (NPO-style).
   * Prefer this over nearZip alone; nearZip stays for older drafts.
   */
  nearLocation: string;
  found: FindBusinessProfileResult | null;
  localGivebackMode: LocalGivebackMode;
  /** Restaurant (and % of purchase) giveback — default 15, range 5–50. */
  givebackPercent: number;
  causeMode: CauseMode;
  selectedCampaignSlug?: string;
  email: string;
  /** Discount Eligible day labels shown on the venue profile. */
  discountHours: VenueDiscountHours;
  /** Optional line such as "Eligible 6–9:00pm". */
  eligibleWindow: string;
  /** Last UI phase — restored on refresh so Business Creation stays put. */
  phase?: "find" | "confirm" | "profile" | "giveback" | "email" | "done";
};

/** Parsed nearby hint for find-business / generate-business-draft. */
export type ParsedNearbyLocation = {
  nearZip?: string;
  city?: string;
  state?: string;
};

/**
 * Parse a nearby location field into ZIP and/or city/state.
 * Examples: "19348", "Kennett Square, PA", "Kennett Square PA", "Philadelphia".
 */
export function parseNearbyLocation(raw: string): ParsedNearbyLocation {
  const trimmed = raw.trim();
  if (!trimmed) return {};

  const zipOnly = trimmed.replace(/\D/g, "").slice(0, 5);
  if (/^\d{5}(-\d{4})?$/.test(trimmed) && zipOnly.length === 5) {
    return { nearZip: zipOnly };
  }

  // Trailing ZIP after city text: "Kennett Square 19348" / "Kennett Square, 19348"
  const trailingZip = trimmed.match(/^(.*?)(?:\s*[-–,]\s*|\s+)(\d{5})(?:-\d{4})?\s*$/);
  if (trailingZip?.[1]?.trim() && trailingZip[2]) {
    const place = trailingZip[1].trim();
    const cityState = parseCityState(place);
    return {
      nearZip: trailingZip[2],
      ...(cityState.city ? { city: cityState.city } : {}),
      ...(cityState.state ? { state: cityState.state } : !cityState.city ? { city: place } : {}),
    };
  }

  return parseCityState(trimmed);
}

/** Split "City, ST" or "City ST" into city + optional 2-letter state. */
function parseCityState(raw: string): { city?: string; state?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return {};

  const comma = trimmed.match(/^(.+?),\s*([A-Za-z]{2})\s*$/);
  if (comma?.[1]?.trim() && comma[2]) {
    return { city: comma[1].trim(), state: comma[2].toUpperCase() };
  }

  const spaced = trimmed.match(/^(.+?)\s+([A-Za-z]{2})\s*$/);
  if (spaced?.[1]?.trim() && spaced[2]) {
    return { city: spaced[1].trim(), state: spaced[2].toUpperCase() };
  }

  if (/^[A-Za-z]{2}$/.test(trimmed)) {
    return { state: trimmed.toUpperCase() };
  }

  return { city: trimmed };
}

/** Clamp join giveback % to the product range used elsewhere (5–50). */
export function clampJoinGivebackPercent(value: number): number {
  if (!Number.isFinite(value)) return 15;
  return Math.min(50, Math.max(5, Math.round(value)));
}

/** Default empty draft for the 4-step join funnel. */
export function defaultBusinessJoinDraft(door: BusinessDoor | null = null): BusinessJoinFourStepDraft {
  return {
    door,
    nameQuery: "",
    nearZip: "",
    nearLocation: "",
    found: null,
    localGivebackMode: "percent_of_purchase",
    givebackPercent: 15,
    causeMode: "pick_now",
    email: "",
    discountHours: defaultVenueHours(),
    eligibleWindow: "",
  };
}

/** Load draft from sessionStorage. */
export function loadBusinessJoinDraft(): BusinessJoinFourStepDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BusinessJoinFourStepDraft;
    if (!parsed || typeof parsed !== "object") return null;
    const merged = { ...defaultBusinessJoinDraft(), ...parsed };
    merged.givebackPercent = clampJoinGivebackPercent(
      Number(merged.givebackPercent ?? 15),
    );
    merged.discountHours = normalizeVenueHours(parsed.discountHours);
    merged.eligibleWindow =
      typeof parsed.eligibleWindow === "string" ? parsed.eligibleWindow : "";
    merged.nearLocation =
      typeof parsed.nearLocation === "string" ? parsed.nearLocation : "";
    // Older drafts only had nearZip — surface it in the free-text field.
    if (!merged.nearLocation.trim() && typeof parsed.nearZip === "string" && parsed.nearZip.trim()) {
      merged.nearLocation = parsed.nearZip.replace(/\D/g, "").slice(0, 5);
    }
    const parsedNear = parseNearbyLocation(merged.nearLocation);
    merged.nearZip = parsedNear.nearZip || "";
    return merged;
  } catch {
    return null;
  }
}

/** Persist draft to sessionStorage. */
export function saveBusinessJoinDraft(draft: BusinessJoinFourStepDraft) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    /* ignore */
  }
}

/** Clear the 4-step join draft. */
export function clearBusinessJoinDraft() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
