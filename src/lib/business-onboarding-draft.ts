/**
 * Session draft for business AI onboarding (Tasks 6–9).
 * Persists website → AI draft → review edits → selected campaign between steps.
 */
const KEY = "forkup-business-ai-draft";

export type BusinessAiLocationDraft = {
  locationName: string;
  city: string;
  state: string;
  address?: string;
  reservationUrl?: string;
};

export type BusinessAiDraft = {
  website: string;
  businessName: string;
  businessType: string;
  about: string;
  contactName: string;
  contactEmail: string;
  phone: string;
  city: string;
  state: string;
  locations: BusinessAiLocationDraft[];
  imageUrls: string[];
  selectedImageUrl?: string;
  supportsDine: boolean;
  supportsShop: boolean;
  supportsService: boolean;
  supportsBartending: boolean;
  selectedCampaignSlug?: string;
  inviteToken?: string;
};

export function defaultBusinessAiDraft(): BusinessAiDraft {
  return {
    website: "",
    businessName: "",
    businessType: "Restaurant",
    about: "",
    contactName: "",
    contactEmail: "",
    phone: "",
    city: "",
    state: "",
    locations: [{ locationName: "Main Location", city: "", state: "" }],
    imageUrls: [],
    supportsDine: true,
    supportsShop: false,
    supportsService: false,
    supportsBartending: false,
  };
}

export function loadBusinessAiDraft(): BusinessAiDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return { ...defaultBusinessAiDraft(), ...JSON.parse(raw) } as BusinessAiDraft;
  } catch {
    return null;
  }
}

export function saveBusinessAiDraft(draft: BusinessAiDraft) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY, JSON.stringify(draft));
}

export function clearBusinessAiDraft() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(KEY);
}
