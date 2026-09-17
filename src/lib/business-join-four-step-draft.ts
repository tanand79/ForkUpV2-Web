/**
 * Pass D2 — session draft for Restaurant / Local 4-step giveback join.
 * Purpose: Persist name → found profile → giveback prefs → email across steps.
 * Inputs/outputs: load/save/clear helpers for BusinessJoinFourStepDraft.
 */
import type { FindBusinessProfileResult } from "@/lib/api-business-onboarding";
import type { BusinessDoor } from "@/lib/business-door";

const KEY = "forkup-business-join-four-step";

export type LocalGivebackMode = "percent_of_purchase" | "dollar_per_visit" | "special_offer";
export type CauseMode = "pick_now" | "forkup_match";

export type BusinessJoinFourStepDraft = {
  door: BusinessDoor | null;
  nameQuery: string;
  found: FindBusinessProfileResult | null;
  localGivebackMode: LocalGivebackMode;
  causeMode: CauseMode;
  selectedCampaignSlug?: string;
  email: string;
};

/** Default empty draft for the 4-step join funnel. */
export function defaultBusinessJoinDraft(door: BusinessDoor | null = null): BusinessJoinFourStepDraft {
  return {
    door,
    nameQuery: "",
    found: null,
    localGivebackMode: "percent_of_purchase",
    causeMode: "pick_now",
    email: "",
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
    return { ...defaultBusinessJoinDraft(), ...parsed };
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
