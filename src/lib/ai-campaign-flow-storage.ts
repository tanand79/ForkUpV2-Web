/**
 * Browser persistence for the AI-first create flow session token.
 *
 * Purpose: Resume Step 5 ideas after refresh without requiring login.
 * Guest campaign field draft still uses the existing campaign draft localStorage.
 *
 * Inputs: session token + org name. Outputs: stored blob or null.
 */
const AI_FLOW_KEY = "forkup-ai-campaign-flow";
/** Additive: org + optional social URLs saved between find-org → connect → analyze. */
const AI_FLOW_PENDING_KEY = "forkup-ai-campaign-flow-pending";

export type AiFlowBrowserStore = {
  sessionToken: string;
  organizationName: string;
  selectedIdeaId?: number | null;
  guestContinued?: boolean;
};

/**
 * Pending org selection before analyze runs (Steps 3–4 UI).
 * Purpose: Survive refresh between find-org and analyzing without a sessionToken yet.
 * Inputs: identity + optional website/social/mission fields from search + connect screen.
 * Outputs: blob used by AiConnectSocial / AiAnalyzing.
 */
export type AiFlowPendingOrg = {
  organizationName: string;
  ein?: string | null;
  nonprofitId?: number | null;
  website?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  linkedinUrl?: string | null;
  youtubeUrl?: string | null;
  mission?: string | null;
  causeCategory?: string | null;
  city?: string | null;
  state?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  verificationStatus?: string | null;
  claimStatus?: string | null;
  logoUrl?: string | null;
};

export function loadAiFlowStore(): AiFlowBrowserStore | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AI_FLOW_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AiFlowBrowserStore>;
    if (!parsed.sessionToken || !parsed.organizationName) {
      window.localStorage.removeItem(AI_FLOW_KEY);
      return null;
    }
    return {
      sessionToken: String(parsed.sessionToken),
      organizationName: String(parsed.organizationName),
      selectedIdeaId: parsed.selectedIdeaId ?? null,
      guestContinued: Boolean(parsed.guestContinued),
    };
  } catch {
    return null;
  }
}

export function saveAiFlowStore(store: AiFlowBrowserStore): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AI_FLOW_KEY, JSON.stringify(store));
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearAiFlowStore(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(AI_FLOW_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Purpose: Persist selected nonprofit (+ optional social URLs) before analyze.
 * Inputs: AiFlowPendingOrg. Outputs: written to localStorage or ignored on failure.
 */
export function saveAiFlowPendingOrg(pending: AiFlowPendingOrg): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AI_FLOW_PENDING_KEY, JSON.stringify(pending));
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Purpose: Load pending org for connect-social / analyzing screens.
 * Inputs: none. Outputs: pending blob or null if missing/invalid.
 */
export function loadAiFlowPendingOrg(): AiFlowPendingOrg | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AI_FLOW_PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AiFlowPendingOrg>;
    if (!parsed.organizationName) {
      window.localStorage.removeItem(AI_FLOW_PENDING_KEY);
      return null;
    }
    return {
      organizationName: String(parsed.organizationName),
      ein: parsed.ein ?? null,
      nonprofitId: parsed.nonprofitId ?? null,
      website: parsed.website ?? null,
      facebookUrl: parsed.facebookUrl ?? null,
      instagramUrl: parsed.instagramUrl ?? null,
      linkedinUrl: parsed.linkedinUrl ?? null,
      youtubeUrl: parsed.youtubeUrl ?? null,
      mission: parsed.mission ?? null,
      causeCategory: parsed.causeCategory ?? null,
      city: parsed.city ?? null,
      state: parsed.state ?? null,
      contactName: parsed.contactName ?? null,
      contactEmail: parsed.contactEmail ?? null,
      verificationStatus: parsed.verificationStatus ?? null,
      claimStatus: parsed.claimStatus ?? null,
      logoUrl: parsed.logoUrl ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Purpose: Clear pending org after analyze completes or user abandons the funnel.
 * Inputs: none. Outputs: key removed when possible.
 */
export function clearAiFlowPendingOrg(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(AI_FLOW_PENDING_KEY);
  } catch {
    /* ignore */
  }
}
