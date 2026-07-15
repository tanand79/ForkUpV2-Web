const BUSINESS_CLAIM_DRAFT_KEY = "forkup-business-claim-draft";

export type BusinessClaimDraft = {
  businessName: string;
  contactName: string;
  contactEmail: string;
  locationName: string;
  city: string;
  stateCode: string;
  supportsDine: boolean;
  supportsShop: boolean;
  supportsService: boolean;
  supportsBartending: boolean;
};

export const defaultBusinessClaimDraft = (): BusinessClaimDraft => ({
  businessName: "",
  contactName: "",
  contactEmail: "",
  locationName: "Main Location",
  city: "",
  stateCode: "",
  supportsDine: true,
  supportsShop: false,
  supportsService: false,
  supportsBartending: false,
});

export function loadBusinessClaimDraft(): BusinessClaimDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(BUSINESS_CLAIM_DRAFT_KEY);
    if (!raw) return null;
    return { ...defaultBusinessClaimDraft(), ...JSON.parse(raw) };
  } catch {
    return null;
  }
}

export function saveBusinessClaimDraft(draft: BusinessClaimDraft) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(BUSINESS_CLAIM_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* ignore */
  }
}

export function clearBusinessClaimDraft() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(BUSINESS_CLAIM_DRAFT_KEY);
}
