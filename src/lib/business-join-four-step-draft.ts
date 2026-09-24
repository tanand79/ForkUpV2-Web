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
};

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
