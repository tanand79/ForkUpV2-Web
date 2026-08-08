/**
 * Client for pre-campaign AI flow (backend analyze + Step 5 ideas).
 *
 * Purpose: Call analyze + resume session APIs without editing api.ts.
 * Inputs/outputs match Forkup-Server `/api/ai-campaign-flow/*`.
 * Visible UI: Steps 3–4 on frontend (ai-connect-social / ai-analyzing).
 */
import { authHeaders } from "@/lib/auth-storage";
import { getApiBaseUrl } from "@/lib/api-config";

/**
 * Normalize API path for fetch.
 * Same-origin Next (`trailingSlash: true`) needs a trailing slash so POST
 * does not 308; Express strips trailing slashes server-side.
 */
function normalizeApiPath(path: string, baseUrl: string = ""): string {
  const q = path.indexOf("?");
  const pathname = q === -1 ? path : path.slice(0, q);
  const search = q === -1 ? "" : path.slice(q);
  let normalized = pathname.replace(/\/+$/, "") || "/";
  if (!baseUrl && normalized.startsWith("/api") && normalized !== "/api") {
    normalized = `${normalized}/`;
  }
  return `${normalized}${search}`;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = normalizeApiPath(`${baseUrl}${path}`, baseUrl);
  const res = await fetch(url, {
    cache: "no-store",
    redirect: "follow",
    ...init,
    headers: {
      ...authHeaders(),
      ...(init?.headers ?? {}),
    },
  });
  const contentType = res.headers.get("content-type") ?? "";
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = typeof body.error === "string" ? body.error : `API error: ${res.status}`;
    throw new Error(message);
  }
  if (!contentType.includes("application/json")) {
    throw new Error("API returned a non-JSON response for AI campaign flow.");
  }
  return res.json() as Promise<T>;
}

export type AiCampaignMethod = "donations" | "ambassador" | "giveback" | "guestBartending";

export type AiSuggestedImage = {
  url: string;
  source: string;
  sourceUrl: string | null;
  /** Optional public post caption when server extracted one. */
  caption?: string | null;
};

export type AiCampaignIdea = {
  id: number;
  title: string;
  description: string;
  confidence: number;
  thumbnailUrl: string | null;
  suggestedGoal: number | null;
  suggestedMethods: AiCampaignMethod[];
  payload: Record<string, unknown> | null;
  sortOrder: number;
};

export type AiAnalysisSession = {
  id: number;
  sessionToken: string;
  nonprofitId: number | null;
  organizationName: string;
  ein: string | null;
  website: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  linkedinUrl: string | null;
  status: "pending" | "running" | "completed" | "failed";
  analysis: {
    organizationName: string;
    mission: string | null;
    images: AiSuggestedImage[];
    themes: string[];
    summary: string;
    provider: string;
    /** Additive: YouTube channel used for post thumbnails. */
    youtubeUrl?: string | null;
    facebookUrl?: string | null;
    instagramUrl?: string | null;
    linkedinUrl?: string | null;
    website?: string | null;
  } | null;
  errorMessage: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  ideas: AiCampaignIdea[];
};

export type AnalyzeAiCampaignInput = {
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
};

/**
 * method: POST /api/ai-campaign-flow/analyze
 * Runs website/social analysis + idea generation (called from ai-analyzing UI).
 */
export function analyzeAiCampaignFlow(input: AnalyzeAiCampaignInput) {
  return fetchJson<AiAnalysisSession>("/api/ai-campaign-flow/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export type AiResolvedSources = {
  organizationName: string;
  ein: string | null;
  nonprofitId: number | null;
  website: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  linkedinUrl: string | null;
  youtubeUrl: string | null;
  mission: string | null;
  causeCategory: string | null;
  city: string | null;
  state: string | null;
};

/**
 * method: POST /api/ai-campaign-flow/resolve-sources
 * Purpose: Prefill Connect Social URL fields (no full analyze / ideas).
 * Inputs: same identity fields as analyze. Outputs: resolved website + social URLs.
 */
export function resolveAiCampaignSources(input: AnalyzeAiCampaignInput) {
  return fetchJson<AiResolvedSources>("/api/ai-campaign-flow/resolve-sources", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

/**
 * method: GET /api/ai-campaign-flow/sessions/:sessionToken
 * Resume Step 5 idea picker from a prior analyze call.
 */
export function fetchAiCampaignSession(sessionToken: string) {
  return fetchJson<AiAnalysisSession>(
    `/api/ai-campaign-flow/sessions/${encodeURIComponent(sessionToken)}`,
  );
}

export type AiDraftFromPurposeResult = {
  title: string;
  story: string;
  purpose: string;
  suggestedGoal?: number;
  provider: string;
};

/**
 * method: POST /api/ai-campaign-flow/draft-from-purpose
 * Purpose: Scratch-path title + story from a short purpose (new AI stack).
 * Inputs: purpose + optional org/mission/methods/goal. Outputs: draft fields.
 */
export function draftAiCampaignFromPurpose(input: {
  purpose: string;
  organizationName?: string;
  mission?: string | null;
  causeCategory?: string | null;
  website?: string | null;
  methods?: string[];
  goal?: string | number | null;
}) {
  return fetchJson<AiDraftFromPurposeResult>("/api/ai-campaign-flow/draft-from-purpose", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}
