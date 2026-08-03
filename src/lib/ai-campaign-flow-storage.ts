/**
 * Browser persistence for the AI-first create flow session token.
 *
 * Purpose: Resume Step 5 ideas after refresh without requiring login.
 * Guest campaign field draft still uses the existing campaign draft localStorage.
 *
 * Inputs: session token + org name. Outputs: stored blob or null.
 */
const AI_FLOW_KEY = "forkup-ai-campaign-flow";

export type AiFlowBrowserStore = {
  sessionToken: string;
  organizationName: string;
  selectedIdeaId?: number | null;
  guestContinued?: boolean;
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
