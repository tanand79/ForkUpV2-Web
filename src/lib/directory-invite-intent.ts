/**
 * Homepage Business tab — invite intent across signed-out → sign-in.
 * After auth, return to website-landing Business tab and open campaign picker.
 */
import type { BusinessDirectoryItem } from "@/lib/api";

const KEY = "forkup-directory-invite-intent";

export type DirectoryInviteIntent = {
  businessId: number;
  slug: string;
  businessName: string;
  businessType: string | null;
  locationId: number;
  locationName: string;
  city: string | null;
  state: string | null;
  capabilities: BusinessDirectoryItem["capabilities"];
};

export function stashDirectoryInviteIntent(business: BusinessDirectoryItem) {
  if (typeof window === "undefined") return;
  const loc = business.locations[0];
  if (!loc?.id) return;
  const payload: DirectoryInviteIntent = {
    businessId: business.id,
    slug: business.slug,
    businessName: business.businessName,
    businessType: business.businessType,
    locationId: loc.id,
    locationName: loc.locationName,
    city: loc.city,
    state: loc.state,
    capabilities: business.capabilities,
  };
  sessionStorage.setItem(KEY, JSON.stringify(payload));
}

export function peekDirectoryInviteIntent(): DirectoryInviteIntent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DirectoryInviteIntent;
    if (
      !parsed ||
      typeof parsed.businessId !== "number" ||
      !parsed.slug ||
      typeof parsed.locationId !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function consumeDirectoryInviteIntent(): DirectoryInviteIntent | null {
  const intent = peekDirectoryInviteIntent();
  if (typeof window !== "undefined") sessionStorage.removeItem(KEY);
  return intent;
}

/** Rebuild a directory row so the invite picker can run without waiting on the list. */
export function businessFromDirectoryInviteIntent(
  intent: DirectoryInviteIntent,
): BusinessDirectoryItem {
  return {
    id: intent.businessId,
    businessName: intent.businessName,
    slug: intent.slug,
    businessType: intent.businessType,
    website: null,
    businessStatus: "active",
    claimStatus: "claimed",
    accessRequestStatus: null,
    awaitingVerification: false,
    inviteable: true,
    capabilities: intent.capabilities,
    locations: [
      {
        id: intent.locationId,
        locationName: intent.locationName,
        city: intent.city,
        state: intent.state,
        distanceMiles: null,
      },
    ],
  };
}
