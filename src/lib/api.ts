import type { CreateCampaignPayload, CreateCampaignResult } from "@/lib/builder-submit";
import type { CampaignDetail, CampaignListItem } from "@/lib/campaign-types";
import { authHeaders } from "@/lib/auth-storage";
import { getApiBaseUrl } from "@/lib/api-config";

/** API paths must not end with `/` when calling Express directly.
 * Same-origin Next (`trailingSlash: true`) needs a trailing slash so POST
 * does not hit a 308 redirect (which drops the Ideas image fetch). */
function normalizeApiPath(path: string, baseUrl: string = ""): string {
  const q = path.indexOf("?");
  const pathname = q === -1 ? path : path.slice(0, q);
  const search = q === -1 ? "" : path.slice(q);
  let normalized = pathname.replace(/\/+$/, "") || "/";

  // Local Next proxy: add trailing slash to avoid 308 Permanent Redirect on POST.
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
    const message =
      typeof body.error === "string"
        ? typeof body.reason === "string" && body.reason.trim()
          ? `${body.error} (${body.reason})`
          : body.error
        : typeof body.message === "string"
          ? body.message
          : `API error: ${res.status}`;
    /** Additive: status helps clients clear stale tokens after db:reset. */
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  if (!contentType.includes("application/json")) {
    const hint = baseUrl
      ? "The API URL may be wrong or the server returned an error page."
      : "Set NEXT_PUBLIC_API_URL at build time or apiUrl in public/runtime-config.js on the server.";
    throw new Error(`API returned HTML instead of JSON. ${hint}`);
  }
  return res.json() as Promise<T>;
}

export function fetchPastCampaigns() {
  return fetchCampaigns({ status: "past" });
}

/** Top-event campaigns for Success Stories (past first, then live). */
export async function fetchSuccessStoryCampaigns() {
  const past = await fetchPastCampaigns();
  const featuredPast = past.filter((c) => c.topEvent);
  if (featuredPast.length > 0) return featuredPast;
  const live = await fetchCampaigns();
  return live.filter((c) => c.topEvent);
}

export function fetchCampaigns(statusOrOptions?: string | { status?: string; nearby?: { lat: number; lng: number; radiusMiles?: number } }) {
  const options =
    typeof statusOrOptions === "string"
      ? { status: statusOrOptions }
      : (statusOrOptions ?? {});
  const params = new URLSearchParams();
  if (options.status) params.set("status", options.status);
  if (options.nearby) {
    params.set("lat", String(options.nearby.lat));
    params.set("lng", String(options.nearby.lng));
    if (options.nearby.radiusMiles != null) {
      params.set("radiusMiles", String(options.nearby.radiusMiles));
    }
  }
  const q = params.toString() ? `?${params.toString()}` : "";
  return fetchJson<CampaignListItem[]>(`/api/campaigns${q}`);
}

export function fetchCampaign(slug: string) {
  return fetchJson<CampaignDetail>(`/api/campaigns/${slug}`);
}

export function submitParticipation(
  slug: string,
  body: {
    firstName: string;
    email: string;
    partySize: number;
    isFirstVisit: boolean;
    businessId: number;
    locationId: number;
    methodId: number;
  },
) {
  return fetchJson<{
    success: boolean;
    participationPath: string;
    reservationUrl: string | null;
    businessName: string;
    locationName: string;
    supportersGoing: number;
    expectedGuests: number;
  }>(`/api/campaigns/${slug}/participate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export interface ApiBusinessLocation {
  id: number;
  locationName: string;
  city: string;
  state: string;
  /** Miles from browser GPS when nearby filter is active; null when unknown. */
  distanceMiles?: number | null;
}

export interface ApiBusiness {
  id: number;
  businessName: string;
  businessType: string;
  defaultGivebackPercentage: number;
  capabilities: string[];
  locations: ApiBusinessLocation[];
}

/**
 * GET /api/builder/businesses
 * Optional nearby: lat, lng, radiusMiles (default 8 on server).
 */
export function fetchBuilderBusinesses(
  query?: string,
  nearby?: { lat: number; lng: number; radiusMiles?: number } | null,
) {
  const search = new URLSearchParams();
  if (query?.trim()) search.set("q", query.trim());
  if (nearby) {
    search.set("lat", String(nearby.lat));
    search.set("lng", String(nearby.lng));
    if (nearby.radiusMiles != null) {
      search.set("radiusMiles", String(nearby.radiusMiles));
    }
  }
  const qs = search.toString();
  return fetchJson<ApiBusiness[]>(`/api/builder/businesses${qs ? `?${qs}` : ""}`);
}

export function createCampaign(payload: CreateCampaignPayload) {
  return fetchJson<CreateCampaignResult>("/api/builder/campaigns", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/**
 * Pass 2: load guest claim link metadata.
 * GET /api/guest-campaign-claim/:token
 */
export function fetchGuestCampaignClaim(token: string) {
  return fetchJson<{
    slug: string;
    campaignName: string;
    guestEmail: string;
    nonprofitId: number;
    expired: boolean;
    alreadyClaimed: boolean;
  }>(`/api/guest-campaign-claim/${encodeURIComponent(token)}`);
}

/**
 * Pass 2: claim guest campaign (auth required).
 * POST /api/guest-campaign-claim/:token
 */
export function postGuestCampaignClaim(token: string) {
  return fetchJson<{
    ok: boolean;
    slug: string;
    nonprofitId: number;
    campaignName: string;
  }>(`/api/guest-campaign-claim/${encodeURIComponent(token)}`, {
    method: "POST",
  });
}

export interface BuilderCampaignPartner {
  businessId: number;
  locationId: number;
  businessName: string;
  businessEmail: string | null;
  locationName: string;
  city: string;
  state: string;
  methodType: string;
  givebackPercentage: number;
  acceptanceStatus: string;
}

export interface BuilderCampaignState {
  slug: string;
  /** Additive: nonprofit owning this campaign (for guest→signup linking). */
  nonprofitId?: number;
  campaignName: string;
  campaignStory: string;
  campaignGoal: number;
  startDate: string | null;
  endDate: string | null;
  coverImageUrl: string | null;
  /** Additive: featured YouTube watch/Shorts URL when set. */
  featuredYoutubeUrl?: string | null;
  status: string;
  origin: "business_invite" | "nonprofit";
  methods: string[];
  partners: BuilderCampaignPartner[];
}

export function fetchBuilderCampaign(slug: string) {
  return fetchJson<BuilderCampaignState>(`/api/builder/campaigns/${encodeURIComponent(slug)}`);
}

export function updateCampaign(slug: string, payload: CreateCampaignPayload) {
  return fetchJson<CreateCampaignResult>(
    `/api/builder/campaigns/${encodeURIComponent(slug)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
}

/**
 * POST /api/builder/campaigns/:slug/business-invitations
 * Purpose: Append business invites on invitation_phase / ready_to_launch / live
 * without editing campaign fields.
 * Inputs: slug + invitations / newBusinessInvites arrays.
 * Outputs: { slug, campaignStatus, addedCount, message, invitationLinks }.
 */
export function appendCampaignBusinessInvitations(
  slug: string,
  body: {
    invitations?: CreateCampaignPayload["invitations"];
    newBusinessInvites?: CreateCampaignPayload["newBusinessInvites"];
  },
) {
  return fetchJson<{
    slug: string;
    campaignStatus: string;
    addedCount: number;
    message: string;
    invitationLinks: Array<{
      businessName: string;
      locationName: string;
      token: string;
      acceptanceStatus: string;
      acceptPath: string;
    }>;
  }>(`/api/builder/campaigns/${encodeURIComponent(slug)}/business-invitations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * POST /api/builder/campaigns/:slug/resubmit-forkup-review
 * Inputs: campaign slug (must currently be forkup_review_status = denied).
 * Outputs: { success, slug, forkupReviewStatus: "pending" }
 */
export function resubmitCampaignForkupReview(slug: string) {
  return fetchJson<{
    success: boolean;
    slug: string;
    forkupReviewStatus: string;
  }>(`/api/builder/campaigns/${encodeURIComponent(slug)}/resubmit-forkup-review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
}

export interface NonprofitProfile {
  id: number;
  organizationName: string;
  slug: string;
  mission: string | null;
  website: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  causeCategory: string | null;
  ein: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  /** Present when geo columns are populated (nearby filter). */
  latitude?: number | null;
  longitude?: number | null;
  verificationStatus: string;
  claimStatus: string;
  profileStatus: string;
  verified: boolean;
  /** Additive: org logo when stored on the ForkUp nonprofit row. */
  logoUrl?: string | null;
  /** Latest access-request status for this org (pending / approved / denied). */
  accessRequestStatus?: "pending" | "approved" | "denied" | null;
}

export type ReadinessState = "complete" | "needs_review" | "preloaded_unclaimed" | "not_found";

export interface OrganizationReadiness {
  state: ReadinessState;
  message: string;
  nonprofit: NonprofitProfile | null;
  canSkipToCampaignBuilder: boolean;
  missingFields: string[];
}

export function checkNonprofitReadiness(email?: string, slug?: string) {
  const params = new URLSearchParams();
  if (email) params.set("email", email);
  if (slug) params.set("slug", slug);
  return fetchJson<OrganizationReadiness>(`/api/profiles/nonprofits/readiness?${params}`);
}

export function searchNonprofits(query: string) {
  return fetchJson<NonprofitProfile[]>(
    `/api/profiles/nonprofits?q=${encodeURIComponent(query.trim())}`,
  );
}

export interface OrganizationLookupCandidate extends NonprofitProfile {
  dataSource: "forkup_database" | string;
  location: string | null;
  logoUrl: string | null;
}

export interface OrganizationLookupResult {
  query: string;
  normalizedDomain: string;
  matchCount: number;
  candidates: OrganizationLookupCandidate[];
  requiresConfirmation: boolean;
}

export function lookupOrganizationByWebsite(website: string) {
  return fetchJson<OrganizationLookupResult>(
    `/api/profiles/nonprofits/lookup?website=${encodeURIComponent(website.trim())}`,
  );
}

export function claimNonprofitProfile(body: {
  organizationName: string;
  contactName: string;
  contactEmail: string;
  mission?: string;
  causeCategory?: string;
  website?: string;
  existingSlug?: string;
}) {
  return fetchJson<{ action: string; nonprofit: NonprofitProfile }>("/api/profiles/nonprofits/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export type OrganizationMatchStrength = "strong" | "partial" | "weak";

/** Additive: local ForkUp directory vs national IRS (ProPublica) match. */
export type OrganizationDirectorySource = "forkup" | "irs_us";

export interface OrganizationSearchCandidate extends NonprofitProfile {
  matchStrength: OrganizationMatchStrength;
  /** Present on US IRS suggestions; omitted for legacy local-only search rows. */
  source?: OrganizationDirectorySource;
  /** Miles from browser GPS when nearby filter applied; null when unknown. */
  distanceMiles?: number | null;
}

export interface OrganizationBusinessWarning {
  id: number;
  businessName: string;
  slug: string;
}

export interface OrganizationSearchResult {
  query: string;
  website: string;
  ein: string;
  location: string;
  normalizedDomain: string | null;
  matchCount: number;
  candidates: OrganizationSearchCandidate[];
  businessWarning: OrganizationBusinessWarning | null;
  requiresConfirmation: boolean;
  /** Present when the client sent lat/lng for nearby filtering. */
  nearby?: {
    latitude: number;
    longitude: number;
    radiusMiles: number;
  } | null;
}

/** Unified "Find your organization" search by name, website, EIN, and/or location. */
export function searchOrganizations(params: {
  q?: string;
  website?: string;
  ein?: string;
  location?: string;
  lat?: number;
  lng?: number;
  radiusMiles?: number;
}) {
  const search = new URLSearchParams();
  if (params.q?.trim()) search.set("q", params.q.trim());
  if (params.website?.trim()) search.set("website", params.website.trim());
  if (params.ein?.trim()) search.set("ein", params.ein.trim());
  if (params.location?.trim()) search.set("location", params.location.trim());
  if (params.lat != null && params.lng != null) {
    search.set("lat", String(params.lat));
    search.set("lng", String(params.lng));
    if (params.radiusMiles != null) {
      search.set("radiusMiles", String(params.radiusMiles));
    }
  }
  // Bust any intermediary GET cache so a new search never shows a prior org.
  search.set("_", String(Date.now()));
  return fetchJson<OrganizationSearchResult>(
    `/api/profiles/nonprofits/search?${search.toString()}`,
  );
}

export interface UsNonprofitSuggestResult {
  query: string;
  state: string | null;
  matchCount: number;
  totalResults: number;
  provider: string;
  candidates: OrganizationSearchCandidate[];
  nearby?: {
    latitude: number;
    longitude: number;
    derivedState: string | null;
  } | null;
}

/**
 * GoFundMe-style US nonprofit typeahead (IRS via ProPublica).
 * method: GET /api/profiles/nonprofits/us-suggest
 */
export function suggestUsNonprofits(params: {
  q: string;
  state?: string;
  city?: string;
  limit?: number;
  lat?: number;
  lng?: number;
  radiusMiles?: number;
  /** US ZIP — server geocodes and scopes IRS suggest near that ZIP. */
  zip?: string;
}) {
  const search = new URLSearchParams();
  search.set("q", params.q.trim());
  if (params.state?.trim()) search.set("state", params.state.trim());
  if (params.city?.trim()) search.set("city", params.city.trim());
  if (params.zip?.trim()) search.set("zip", params.zip.trim());
  if (params.limit != null) search.set("limit", String(params.limit));
  if (params.lat != null && params.lng != null) {
    search.set("lat", String(params.lat));
    search.set("lng", String(params.lng));
    if (params.radiusMiles != null) {
      search.set("radiusMiles", String(params.radiusMiles));
    }
  }
  search.set("_", String(Date.now()));
  return fetchJson<UsNonprofitSuggestResult>(
    `/api/profiles/nonprofits/us-suggest?${search.toString()}`,
  );
}

export interface UsNonprofitEnrichment {
  ein: string;
  organizationName: string | null;
  website: string | null;
  logoUrl: string | null;
  mission: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  providers: string[];
}

/**
 * Enrich a US IRS pick with website/logo/ZIP/mission (Every.org + ProPublica detail).
 * When website is still missing, AI-guesses from organization name (optional name/city/state).
 * method: GET /api/profiles/nonprofits/us-enrich
 */
export function enrichUsNonprofit(params: {
  ein: string;
  organizationName?: string;
  city?: string;
  state?: string;
}) {
  const search = new URLSearchParams();
  search.set("ein", params.ein.trim());
  if (params.organizationName?.trim()) search.set("name", params.organizationName.trim());
  if (params.city?.trim()) search.set("city", params.city.trim());
  if (params.state?.trim()) search.set("state", params.state.trim());
  search.set("_", String(Date.now()));
  return fetchJson<UsNonprofitEnrichment>(
    `/api/profiles/nonprofits/us-enrich?${search.toString()}`,
  );
}

export type NonprofitClaimAction =
  | "claimed"
  | "created"
  | "claimed_pending_verification"
  | "created_pending_verification"
  | "access_requested";

export interface NonprofitClaimRequestResult {
  action: NonprofitClaimAction;
  riskLevel: "low" | "medium" | "high";
  nonprofit: NonprofitProfile;
  businessWarning: OrganizationBusinessWarning | null;
  message?: string;
}

/**
 * Trust-gated claim / request-access. Separate from claimNonprofitProfile:
 * returns a risk level and may report a pending-verification or access-request
 * outcome instead of an immediate claim.
 */
export function submitNonprofitClaimRequest(body: {
  organizationName: string;
  contactName?: string;
  contactEmail: string;
  mission?: string;
  causeCategory?: string;
  website?: string;
  existingSlug?: string;
  relationship?: string;
  ein?: string;
  city?: string;
  state?: string;
  zip?: string;
}) {
  return fetchJson<NonprofitClaimRequestResult>("/api/profiles/nonprofits/claim-request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ─── Quick-start campaign draft (AI) ─────────────────────────────────────────

export interface CampaignDraftResult {
  title: string;
  story: string;
  purpose: string;
  suggestedImageUrl?: string | null;
  /** AI / library-suggested promotion channels (optional; organizer can edit). */
  facebookUrl?: string;
  instagramHandle?: string;
  websiteUrl?: string;
  /**
   * Whole-dollar USD goal suggested by AI when the organizer left goal blank.
   * Organizer can edit on Review — never auto-published.
   */
  suggestedGoal?: number;
}

/**
 * GoFundMe-style quick-start: send the organizer's short answers and receive an
 * AI-prepared title / story / purpose (and optional social/website links and
 * suggestedGoal when goal was blank) to review and edit. Text only — no image
 * generation.
 */
export function generateCampaignDraft(body: {
  purpose: string;
  organizationName?: string;
  mission?: string;
  causeCategory?: string;
  goal?: string | number;
  startDate?: string;
  endDate?: string;
  methods?: string[];
  organizationType?: "nonprofit" | "business";
  organizationId?: number;
  website?: string;
  modelId?: string;
}) {
  return fetchJson<CampaignDraftResult>("/api/generate-campaign-draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * Lightweight AI goal suggestion for the Build goal screen (before full draft).
 * method: POST /api/suggest-campaign-goal
 * request: { purpose, organizationName?, mission?, causeCategory?, startDate?, endDate? }
 * response: { suggestedGoal: number, provider: string }
 */
export function suggestCampaignGoal(body: {
  purpose: string;
  organizationName?: string;
  mission?: string;
  causeCategory?: string;
  startDate?: string;
  endDate?: string;
}) {
  return fetchJson<{ suggestedGoal: number; provider: string }>(
    "/api/suggest-campaign-goal",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

/** Lovable-style org draft from a website URL (review before save — never auto-claims). */
export interface OrganizationDraftResult {
  website: string;
  kind: string;
  generatedFields: {
    organizationName?: string;
    missionStatement?: string;
    about?: string;
    website?: string;
    contactEmail?: string;
    phone?: string;
    location?: string;
    causeCategory?: string;
    city?: string;
    state?: string;
    ein?: string;
  };
  orgType?: string;
  social?: string[];
  missingFields?: string[];
  confirmationStatus: "AI Draft" | "Found Profile" | string;
  provider?: string;
}

export function generateOrganizationDraft(body: {
  website?: string;
  name?: string;
  kind?: "nonprofit" | "business";
  extraContext?: string;
}) {
  return fetchJson<OrganizationDraftResult>("/api/generate-organization-draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ─── Business profiles ───────────────────────────────────────────────────────

export interface BusinessProfile {
  id: number;
  businessName: string;
  slug: string;
  businessType: string | null;
  website: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  businessStatus: string;
  claimStatus: string;
  profileStatus: string;
  defaultGivebackPercentage: number;
  capabilities: {
    dineAndDonate: boolean;
    shopAndDonate: boolean;
    serviceGiveback: boolean;
    guestBartending: boolean;
  };
  locations: {
    id: number;
    locationName: string;
    city: string;
    state: string;
    address: string | null;
  }[];
  /** Latest access-request status for this business (pending / approved / denied). */
  accessRequestStatus?: "pending" | "approved" | "denied" | null;
}

export type BusinessReadinessState =
  | "complete"
  | "needs_review"
  | "preloaded_unclaimed"
  | "not_found";

export interface BusinessReadiness {
  state: BusinessReadinessState;
  message: string;
  business: BusinessProfile | null;
  canProceed: boolean;
  missingFields: string[];
}

export function searchBusinesses(query: string) {
  return fetchJson<BusinessProfile[]>(
    `/api/profiles/businesses?q=${encodeURIComponent(query.trim())}`,
  );
}

export function checkBusinessReadiness(email?: string, slug?: string) {
  const params = new URLSearchParams();
  if (email) params.set("email", email);
  if (slug) params.set("slug", slug);
  return fetchJson<BusinessReadiness>(`/api/profiles/businesses/readiness?${params}`);
}

export function claimBusinessProfile(body: {
  businessName: string;
  contactName?: string;
  contactEmail: string;
  businessType?: string;
  website?: string;
  existingSlug?: string;
  locationName?: string;
  city?: string;
  state?: string;
  supportsDineAndDonate?: boolean;
  supportsShopAndDonate?: boolean;
  supportsServiceGiveback?: boolean;
  supportsGuestBartending?: boolean;
}) {
  return fetchJson<{ action: string; business: BusinessProfile }>("/api/profiles/businesses/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export type BusinessClaimAction =
  | "claimed"
  | "created"
  | "claimed_pending_verification"
  | "created_pending_verification"
  | "access_requested";

export interface BusinessClaimRequestResult {
  action: BusinessClaimAction;
  riskLevel: "low" | "medium" | "high";
  business: BusinessProfile;
  message?: string;
}

/**
 * Trust-gated claim / request-access for businesses. Separate from
 * claimBusinessProfile: returns a risk level and may report a
 * pending-verification or access-request outcome instead of an immediate claim.
 */
export function submitBusinessClaimRequest(body: {
  businessName: string;
  contactName?: string;
  contactEmail: string;
  businessType?: string;
  website?: string;
  existingSlug?: string;
  relationship?: string;
  locationName?: string;
  city?: string;
  state?: string;
  supportsDineAndDonate?: boolean;
  supportsShopAndDonate?: boolean;
  supportsServiceGiveback?: boolean;
  supportsGuestBartending?: boolean;
}) {
  return fetchJson<BusinessClaimRequestResult>("/api/profiles/businesses/claim-request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ─── Business → nonprofit campaign invites ───────────────────────────────────

export interface NonprofitCampaignInvite {
  token: string;
  invitationStatus: string;
  givebackPercentage: number;
  message: string | null;
  method: { type: string; name: string };
  business: { id: number; name: string; email: string | null };
  location: { id: number; name: string; city: string; state: string };
  nonprofit: { id: number; name: string; email: string | null };
  campaign: {
    slug: string;
    name: string;
    story: string;
    startDate: string | null;
    endDate: string | null;
    status: string;
  };
}

export function sendNonprofitCampaignInvite(body: {
  businessId: number;
  locationId: number;
  nonprofitId: number;
  methodType: string;
  givebackPercentage?: number;
  message?: string;
  campaignName?: string;
}) {
  return fetchJson<{
    token: string;
    acceptPath: string;
    campaignSlug: string;
    campaignName: string;
  }>("/api/business/nonprofit-invites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function fetchNonprofitCampaignInvite(token: string) {
  return fetchJson<NonprofitCampaignInvite>(`/api/business/nonprofit-invites/${token}`);
}

export function acceptNonprofitCampaignInvite(token: string) {
  return fetchJson<{ success: boolean; campaignSlug: string }>(
    `/api/business/nonprofit-invites/${token}/accept`,
    { method: "POST" },
  );
}

export function declineNonprofitCampaignInvite(token: string, reason?: string) {
  return fetchJson<{ success: boolean }>(`/api/business/nonprofit-invites/${token}/decline`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
}

// ─── Business invitations ────────────────────────────────────────────────────

export interface BusinessInvitationDetail {
  id: number;
  token: string;
  acceptanceStatus: string;
  inviteStatus?: string;
  givebackPercentage: number;
  participationHours: string | null;
  eligibleSalesRules: string | null;
  messageToBusiness?: string | null;
  proposedTerms?: string | null;
  respondByDate?: string | null;
  setupStatus?: string;
  marketingReadyStatus?: string;
  settlementReadyStatus?: string;
  canRespond: boolean;
  campaign: {
    slug: string;
    name: string;
    story: string;
    startDate: string | null;
    endDate: string | null;
    status: string;
    invitationDeadline: string | null;
    nonprofit: string;
  };
  business: { id: number; name: string; email: string | null; emailHint: string | null };
  location: { id: number | null; name: string; city: string; state: string };
  method: { type: string; name: string };
}

/**
 * Location ACH settings (masked). GET /api/business/locations/:id/ach
 */
export interface LocationAchSettings {
  locationId: number;
  locationName: string;
  achBankName: string | null;
  achAccountHolderName: string | null;
  achAccountType: string | null;
  achRoutingNumberMasked: string | null;
  achAccountNumberMasked: string | null;
  achAccountLast4: string | null;
  achAuthorizationStatus: string;
  achAuthorizedBy: string | null;
  achAuthorizedEmail: string | null;
  achAuthorizedAt: string | null;
  achLastUpdatedAt: string | null;
  achSignaturePath: string | null;
  achContactEmail: string | null;
  hasAchData: boolean;
}

export function fetchLocationAch(locationId: number) {
  return fetchJson<LocationAchSettings>(`/api/business/locations/${locationId}/ach`);
}

/**
 * Save encrypted ACH bank details for a location.
 * POST /api/business/locations/:id/ach
 */
export function saveLocationAch(
  locationId: number,
  body: {
    achBankName?: string;
    achAccountHolderName?: string;
    achAccountType?: "checking" | "savings";
    achRoutingNumber?: string;
    achAccountNumber?: string;
    achAuthorizationStatus?: "pending" | "authorized" | "revoked";
    achAuthorizedBy?: string;
    achAuthorizedEmail?: string;
    achContactEmail?: string;
    achSignatureBase64?: string;
  },
) {
  return fetchJson<{
    ok: boolean;
    locationId: number;
    hasAchData: boolean;
    achAuthorizationStatus: string;
    achSignaturePath: string | null;
  }>(`/api/business/locations/${locationId}/ach`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function fetchBusinessInvitation(token: string) {
  return fetchJson<BusinessInvitationDetail>(`/api/business/invitations/${token}`);
}

export interface BusinessCollaboration {
  id: number;
  token: string | null;
  acceptanceStatus: string;
  inviteStatus?: string;
  respondByDate?: string | null;
  setupStatus?: string;
  marketingReadyStatus?: string;
  settlementReadyStatus?: string;
  messageToBusiness?: string | null;
  proposedTerms?: string | null;
  givebackPercentage: number;
  participationHours: string | null;
  eligibleSalesRules: string | null;
  reviewPath: string | null;
  direction: "incoming" | "outgoing";
  nonprofitInviteStatus: string | null;
  campaign: {
    slug: string;
    name: string;
    story: string;
    startDate: string | null;
    endDate: string | null;
    status: string;
    invitationDeadline: string | null;
    nonprofit: string;
  };
  business: { id: number; name: string; email: string | null };
  location: { id: number | null; name: string; city: string; state: string };
  method: { type: string; name: string };
}

export function fetchBusinessCollaborations(businessId: number) {
  return fetchJson<BusinessCollaboration[]>(
    `/api/business/collaborations?businessId=${businessId}`,
  );
}

export function acceptBusinessInvitation(
  token: string,
  body: {
    authorizedRepresentative: string;
    eligibleSalesRules?: string;
    participationHours?: string;
    billingContactName?: string;
    billingContactEmail?: string;
    settlementContactName?: string;
    settlementContactEmail?: string;
    forkupFeeAcknowledged: boolean;
    net7Acknowledged: boolean;
    achAuthorized: boolean;
  },
) {
  return fetchJson<{ success: boolean }>(`/api/business/invitations/${token}/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function declineBusinessInvitation(token: string, reason?: string) {
  return fetchJson<{ success: boolean }>(`/api/business/invitations/${token}/decline`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
}

export function requestBusinessInvitationChanges(token: string, message: string) {
  return fetchJson<{ success: boolean }>(`/api/business/invitations/${token}/request-changes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
}

// ─── Campaign dashboard (manage) ─────────────────────────────────────────────

/** Nick V2 Layer 6 — dashboard visibility projection. */
export type CampaignVisibility = {
  tracks: {
    id: string;
    label: string;
    status: string;
    display: string;
  }[];
  ready: string[];
  pending: string[];
  needsForkupReview: string[];
  needsBusinessAction: string[];
  nextSuccessEngineAction: {
    id: number;
    title: string;
    scheduledDate: string | null;
    actionType: string;
  } | null;
};

export interface CampaignDashboardData {
  slug: string;
  name: string;
  nonprofit: string;
  status: string;
  goal: number;
  raised: number;
  supportersGoing: number;
  expectedGuests: number;
  verifiedVisits: number;
  startDate: string | null;
  endDate: string | null;
  eventDate?: string | null;
  invitationDeadline: string | null;
  businessTimingStatus?: string;
  forkupReviewStatus?: string;
  methods: { id: number; methodType: string; methodName: string; methodStatus: string }[];
  invitations: {
    id: number;
    businessName: string;
    businessEmail: string | null;
    locationName: string;
    methodType: string;
    methodName: string;
    acceptanceStatus: string;
    inviteStatus?: string;
    respondByDate?: string | null;
    openedAt?: string | null;
    setupStatus?: string;
    marketingReadyStatus?: string;
    settlementReadyStatus?: string;
    messageToBusiness?: string | null;
    proposedTerms?: string | null;
    givebackPercentage: number;
    invitedAt?: string | null;
    changeRequestMessage?: string | null;
    reviewPath?: string | null;
    token: string | null;
    acceptPath: string | null;
  }[];
  virtualDonations: { count: number; total: number };
  visibility?: CampaignVisibility;
}

export function fetchCampaignDashboard(slug: string) {
  return fetchJson<CampaignDashboardData>(`/api/manage/campaigns/${slug}`);
}

export type PartnerInvitationDetail = CampaignDashboardData["invitations"][number];

export function fetchPartnerInvitationDetail(slug: string, invitationId: string | number) {
  return fetchJson<PartnerInvitationDetail>(
    `/api/manage/campaigns/${encodeURIComponent(slug)}/invitations/${encodeURIComponent(String(invitationId))}`,
  );
}

export function acceptPartnerInvitationChanges(slug: string, invitationId: string | number) {
  return fetchJson<{ success: boolean; acceptanceStatus: string }>(
    `/api/manage/campaigns/${encodeURIComponent(slug)}/invitations/${encodeURIComponent(String(invitationId))}/accept-changes`,
    { method: "POST" },
  );
}

export interface ManageCampaignSummary {
  slug: string;
  name: string;
  nonprofit: string;
  status: string;
  goal: number;
  raised: number;
  supportersGoing: number;
  verifiedVisits: number;
  startDate: string | null;
  endDate: string | null;
  businessTimingStatus?: string;
  forkupReviewStatus?: string;
  forkupReviewReason?: string | null;
  partnersInvited?: number;
  partnersPending?: number;
  partnersChangesRequested?: number;
  partnersNeedsInfo?: number;
}

export function fetchManageCampaigns(nonprofitId?: number) {
  const q = nonprofitId ? `?nonprofitId=${nonprofitId}` : "";
  return fetchJson<ManageCampaignSummary[]>(`/api/manage/campaigns${q}`);
}

export function publishCampaignNow(slug: string) {
  return fetchJson<{ success: boolean; status: string; slug: string }>(
    `/api/manage/campaigns/${encodeURIComponent(slug)}/go-live`,
    { method: "POST" },
  );
}

export function deleteManageCampaign(slug: string) {
  return fetchJson<{ success: boolean; slug: string }>(
    `/api/manage/campaigns/${encodeURIComponent(slug)}`,
    { method: "DELETE" },
  );
}

export interface NonprofitPendingInvite {
  token: string;
  businessName: string;
  locationName: string;
  campaignName: string;
  campaignSlug: string;
  methodName: string;
  givebackPercentage: number;
  sentAt: string;
  acceptPath: string;
  /** Additive: business partnership vs fundraiser proposal. */
  inviteSource?: "business" | "fundraiser";
  fundraiserName?: string | null;
  fundraiserEmail?: string | null;
}

export function fetchNonprofitPendingInvites(nonprofitId: number) {
  return fetchJson<NonprofitPendingInvite[]>(
    `/api/manage/nonprofits/${nonprofitId}/pending-invites`,
  );
}

/** Fundraiser → nonprofit campaign invitation (GET /api/fundraiser/invites/:token). */
export interface FundraiserCampaignInvite {
  token: string;
  invitationStatus: string;
  message: string | null;
  fundraiser: { name: string; email: string };
  nonprofit: { id: number; name: string; email: string | null };
  campaign: {
    slug: string;
    name: string;
    story: string;
    goal: number;
    startDate: string | null;
    endDate: string | null;
    status: string;
    coverImageUrl: string | null;
  };
}

export function fetchFundraiserCampaignInvite(token: string) {
  return fetchJson<FundraiserCampaignInvite>(
    `/api/fundraiser/invites/${encodeURIComponent(token)}`,
  );
}

/**
 * method: POST /api/fundraiser/invites
 * Creates draft campaign + emails nonprofit.
 * Additive: methods / eventDate / submitForForkupReview so short-timeline
 * business methods enter ForkUp review (not live) when NPO accepts.
 */
export function createFundraiserCampaignInvite(body: {
  nonprofitId: number;
  campaignName: string;
  campaignStory: string;
  campaignGoal?: number;
  startDate?: string | null;
  endDate?: string | null;
  eventDate?: string | null;
  coverImage?: string | null;
  message?: string | null;
  methods?: CreateCampaignPayload["methods"];
  submitForForkupReview?: boolean;
  /** Pass 3: required when not signed in. */
  fundraiserEmail?: string;
  fundraiserName?: string;
}) {
  return fetchJson<{
    token: string;
    acceptPath: string;
    campaignSlug: string;
    campaignName: string;
    nonprofitEmailed?: boolean;
    nonprofitEmailHint?: string;
    fundraiserEmail?: string;
  }>("/api/fundraiser/invites", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
}

export function acceptFundraiserCampaignInvite(token: string) {
  return fetchJson<{
    success: boolean;
    invitationStatus: string;
    campaignSlug?: string;
    campaignStatus?: string;
  }>(`/api/fundraiser/invites/${encodeURIComponent(token)}/accept`, {
    method: "POST",
    headers: { ...authHeaders() },
  });
}

export function declineFundraiserCampaignInvite(token: string, reason?: string) {
  return fetchJson<{ success: boolean; invitationStatus: string }>(
    `/api/fundraiser/invites/${encodeURIComponent(token)}/decline`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ reason }),
    },
  );
}

export interface FundraiserMyInvite {
  token: string;
  invitationStatus: string;
  sentAt: string;
  respondedAt: string | null;
  message: string | null;
  nonprofitName: string;
  campaignSlug: string;
  campaignName: string;
  campaignStatus: string;
  acceptPath: string;
}

export function fetchMyFundraiserInvites() {
  return fetchJson<FundraiserMyInvite[]>("/api/fundraiser/my-invites", {
    headers: { ...authHeaders() },
  });
}

export interface NonprofitPartnerUpdate {
  id: number;
  acceptanceStatus: string;
  businessName: string;
  businessEmail: string | null;
  locationName: string;
  campaignName: string;
  campaignSlug: string;
  methodName: string;
  givebackPercentage: number;
  changeRequestMessage: string | null;
  updatedAt: string;
  reviewPath: string;
}

export function fetchNonprofitPartnerUpdates(nonprofitId: number) {
  return fetchJson<NonprofitPartnerUpdate[]>(
    `/api/manage/nonprofits/${nonprofitId}/partner-updates`,
  );
}

export function fetchSuccessEngineActions(slug: string) {
  return fetchJson<SuccessEngineAction[]>(`/api/manage/campaigns/${slug}/success-engine`);
}

export interface SuccessEngineAction {
  id: number;
  actionType: string;
  channel: string;
  scheduledDate: string | null;
  title: string;
  content: string;
  status: string;
  completedAt?: string | null;
  autoSend?: boolean;
  sentAt?: string | null;
  lastError?: string | null;
}

export function updateSuccessEngineAction(
  id: number,
  body: { content?: string; status?: "scheduled" | "ready" | "completed"; autoSend?: boolean },
) {
  return fetchJson<{ success: boolean }>(`/api/manage/success-engine/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export interface SendSuccessEngineActionResult {
  success: boolean;
  sent: number;
  audience: string;
  message?: string;
}

export function sendSuccessEngineAction(id: number) {
  return fetchJson<SendSuccessEngineActionResult>(`/api/manage/success-engine/${id}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
}

export interface RunDueSuccessEngineResult {
  success: boolean;
  processed: number;
  totalSent: number;
  results: {
    actionId: number;
    campaignId: number;
    actionType: string;
    audience: string;
    recipientCount: number;
    sent: number;
  }[];
}

export function runDueSuccessEngineActions() {
  return fetchJson<RunDueSuccessEngineResult>(`/api/manage/success-engine/run-due`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
}

/** Nick V2 Layer 5 — business lifecycle emails 2/5/6/7 (manual send). */
export type BusinessLifecycleEmailKey =
  | "invite_reminder"
  | "missing_info"
  | "launch_kit"
  | "starting_soon";

export function postCampaignBusinessEmails(
  slug: string,
  body: { templateKey: BusinessLifecycleEmailKey; invitationId?: number },
) {
  return fetchJson<{
    success: boolean;
    templateKey: BusinessLifecycleEmailKey;
    sent: number;
    skipped: number;
    targeted: number;
  }>(`/api/manage/campaigns/${encodeURIComponent(slug)}/business-emails`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export interface CampaignAutomation {
  automatedActions: {
    id: number;
    actionType: string;
    title: string;
    scheduledDate: string | null;
    status: string;
    autoSend: boolean;
    sentAt: string | null;
    lastError: string | null;
    isDue: boolean;
  }[];
  lastRun: {
    id: number;
    triggerSource: string;
    actionsProcessed: number;
    emailsSent: number;
    ranAt: string;
  } | null;
}

export function fetchCampaignAutomation(slug: string) {
  return fetchJson<CampaignAutomation>(`/api/manage/campaigns/${slug}/automation`);
}

// ─── Email log (admin) ───────────────────────────────────────────────────────

export interface EmailLogEntry {
  id: number;
  campaignId: number | null;
  campaignSlug: string | null;
  campaignName: string | null;
  recipientEmail: string;
  recipientName: string | null;
  stakeholderRole: string | null;
  emailType: string;
  subject: string;
  provider: string;
  providerMessageId: string | null;
  status: string;
  errorMessage: string | null;
  relatedToken: string | null;
  createdAt: string;
}

export function fetchEmailLog(params?: {
  campaign?: string;
  status?: string;
  type?: string;
  role?: string;
  limit?: number;
}) {
  const search = new URLSearchParams();
  if (params?.campaign) search.set("campaign", params.campaign);
  if (params?.status) search.set("status", params.status);
  if (params?.type) search.set("type", params.type);
  if (params?.role) search.set("role", params.role);
  if (params?.limit) search.set("limit", String(params.limit));
  const qs = search.toString();
  return fetchJson<EmailLogEntry[]>(`/api/manage/email-log${qs ? `?${qs}` : ""}`);
}

// ─── Trust validation: access-request review queue ───────────────────────────

export interface AccessRequest {
  id: number;
  organizationType: "nonprofit" | "business";
  organizationId: number | null;
  organizationName: string | null;
  organizationSlug: string | null;
  requestType: "claim" | "access";
  riskLevel: "low" | "medium" | "high";
  status: "pending" | "approved" | "denied";
  requestedByUserId: number | null;
  requesterName: string | null;
  requesterEmail: string | null;
  relationship: string | null;
  riskReason: string | null;
  reviewedByUserId: number | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export function fetchAccessRequests(params?: {
  status?: string;
  riskLevel?: string;
  organizationType?: string;
  limit?: number;
}) {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.riskLevel) search.set("riskLevel", params.riskLevel);
  if (params?.organizationType) search.set("organizationType", params.organizationType);
  if (params?.limit) search.set("limit", String(params.limit));
  const qs = search.toString();
  return fetchJson<AccessRequest[]>(`/api/manage/access-requests${qs ? `?${qs}` : ""}`);
}

export function approveAccessRequest(
  id: number,
  body?: { reviewedByUserId?: number; notes?: string },
) {
  return fetchJson<{ success: boolean; id: number; status: string }>(
    `/api/manage/access-requests/${id}/approve`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    },
  );
}

export function denyAccessRequest(
  id: number,
  body?: { reviewedByUserId?: number; notes?: string },
) {
  return fetchJson<{ success: boolean; id: number; status: string }>(
    `/api/manage/access-requests/${id}/deny`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    },
  );
}

/**
 * POST /api/profiles/access-requests/resubmit
 * Inputs: organizationType + organizationId (latest request must be denied).
 * Outputs: { success, id, status: "pending", organizationType, organizationId }
 */
export function resubmitAccessRequest(body: {
  organizationType: "nonprofit" | "business";
  organizationId: number;
}) {
  return fetchJson<{
    success: boolean;
    id: number;
    status: "pending";
    organizationType: "nonprofit" | "business";
    organizationId: number;
  }>("/api/profiles/access-requests/resubmit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ─── Organization Library ────────────────────────────────────────────────────

export type LibraryOrgType = "nonprofit" | "business";

export interface OrganizationLibraryItem {
  id: number;
  organizationType: LibraryOrgType;
  organizationId: number;
  category: string;
  title: string | null;
  description: string | null;
  content: string | null;
  assetUrl: string | null;
  source: string;
  sourceUrl: string | null;
  reviewStatus: "pending" | "approved" | "rejected" | "ignored";
  metadata: unknown;
  createdByUserId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface LibraryItemInput {
  category: string;
  title?: string;
  description?: string;
  content?: string;
  assetUrl?: string;
  source?: string;
  sourceUrl?: string;
  reviewStatus?: "pending" | "approved" | "rejected" | "ignored";
  metadata?: unknown;
}

export function fetchLibraryItems(
  orgType: LibraryOrgType,
  orgId: number,
  params?: { category?: string; status?: string; source?: string },
) {
  const search = new URLSearchParams();
  if (params?.category) search.set("category", params.category);
  if (params?.status) search.set("status", params.status);
  if (params?.source) search.set("source", params.source);
  const qs = search.toString();
  return fetchJson<OrganizationLibraryItem[]>(
    `/api/library/${orgType}/${orgId}${qs ? `?${qs}` : ""}`,
  );
}

export function createLibraryItem(
  orgType: LibraryOrgType,
  orgId: number,
  body: LibraryItemInput,
) {
  return fetchJson<OrganizationLibraryItem>(`/api/library/${orgType}/${orgId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function updateLibraryItem(id: number, body: Partial<LibraryItemInput>) {
  return fetchJson<OrganizationLibraryItem>(`/api/library/items/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function deleteLibraryItem(id: number) {
  return fetchJson<{ success: boolean; id: number }>(`/api/library/items/${id}`, {
    method: "DELETE",
  });
}

// ─── Virtual donations ───────────────────────────────────────────────────────

export function fetchCampaignDonations(slug: string, limit = 20) {
  return fetchJson<import("@/lib/campaign-types").CampaignDonationsResponse>(
    `/api/campaigns/${slug}/donations?limit=${limit}`,
  );
}

/**
 * Fetch public Top Fundraisers + Top Donors for a campaign page.
 * Inputs: slug, optional per-list limits (1–50, default 5)
 * Outputs: CampaignLeaderboardResponse
 */
export function fetchCampaignLeaderboard(
  slug: string,
  opts?: { fundraisersLimit?: number; donorsLimit?: number },
) {
  const fundraisersLimit = opts?.fundraisersLimit ?? 5;
  const donorsLimit = opts?.donorsLimit ?? 5;
  return fetchJson<import("@/lib/campaign-types").CampaignLeaderboardResponse>(
    `/api/campaigns/${slug}/leaderboard?fundraisersLimit=${fundraisersLimit}&donorsLimit=${donorsLimit}`,
  );
}

export function submitVirtualDonation(
  slug: string,
  body: {
    amount: number;
    donorName?: string;
    email: string;
    anonymous?: boolean;
    attributionCode?: string;
  },
) {
  return fetchJson<{ success: boolean; amount: number; raised: number }>(
    `/api/campaigns/${slug}/donations`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: number;
  email: string;
  fullName: string | null;
  /** Additive: present when API returns email verification status. */
  emailVerified?: boolean;
  organizations: {
    organizationType: "nonprofit" | "business";
    organizationId: number;
    role: string;
  }[];
}

export interface AuthContextResponse {
  user: AuthUser;
  nonprofitProfiles: NonprofitProfile[];
  businessProfiles: BusinessProfile[];
  /** Primary nonprofit — first membership */
  nonprofitProfile: NonprofitProfile | null;
  /** Primary business — first membership */
  businessProfile: BusinessProfile | null;
}

export function checkEmailAvailable(email: string) {
  return fetchJson<{ valid: boolean; available: boolean; message: string }>(
    `/api/auth/check-email?email=${encodeURIComponent(email.trim())}`,
  );
}

export function fetchAuthContext() {
  return fetchJson<AuthContextResponse>("/api/auth/context");
}

export function loginUser(email: string, password: string) {
  return fetchJson<{ token: string; user: AuthUser }>("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export function registerUser(body: {
  email: string;
  password: string;
  fullName?: string;
  organizationType?: "nonprofit" | "business";
  organizationId?: number;
  role?: string;
}) {
  return fetchJson<{
    pendingVerification: true;
    email: string;
    message: string;
  }>("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function fetchCurrentUser() {
  return fetchJson<AuthUser>("/api/auth/me");
}

export function logoutUser() {
  return fetchJson<{ success: boolean }>("/api/auth/logout", { method: "POST" });
}

/**
 * POST /api/auth/forgot-password
 * body: { email }
 * response: { success, message } — always generic (no account leak)
 */
export function forgotPassword(email: string) {
  return fetchJson<{ success: boolean; message: string }>("/api/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

/**
 * POST /api/auth/verify-reset-code
 * body: { email, code }
 * response: { token } — long reset token for reset-password
 */
export function verifyResetCode(email: string, code: string) {
  return fetchJson<{ token: string }>("/api/auth/verify-reset-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });
}

/**
 * POST /api/auth/reset-password
 * body: { token, password }
 * response: { success }
 */
export function resetPassword(token: string, password: string) {
  return fetchJson<{ success: boolean }>("/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
  });
}

/**
 * POST /api/auth/verify-email
 * body: { token } OR { email, code }
 * response: { success, emailVerified }
 */
export function verifyEmail(
  body: { token: string } | { email: string; code: string },
) {
  return fetchJson<{
    success: boolean;
    emailVerified: boolean;
    /** Present when verifying a pending_signups row (account created on verify). */
    token?: string;
    user?: AuthUser;
  }>("/api/auth/verify-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * POST /api/auth/resend-verification
 * body: { email }
 * response: { success, message }
 */
export function resendVerification(email: string) {
  return fetchJson<{ success: boolean; message: string }>("/api/auth/resend-verification", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

export function linkUserOrganization(body: {
  organizationType: "nonprofit" | "business";
  organizationId: number;
  role?: string;
}) {
  return fetchJson<AuthUser>("/api/auth/link-organization", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ─── Participants ────────────────────────────────────────────────────────────

export interface CampaignParticipant {
  id: number;
  participantType: "ambassador" | "guest_bartender";
  name: string;
  email: string | null;
  roleLabel: string | null;
  status: string;
  personalShareLink: string | null;
  trackingCode: string | null;
  shareUrl: string | null;
  leaderboardEnabled: boolean;
  businessId: number | null;
  locationId: number | null;
  eventDate: string | null;
  eventStartTime: string | null;
  eventEndTime: string | null;
  attributedDonationTotal: number;
}

export function fetchCampaignParticipants(slug: string) {
  return fetchJson<CampaignParticipant[]>(`/api/manage/campaigns/${slug}/participants`);
}

export function addCampaignParticipant(
  slug: string,
  body: {
    participantType: "ambassador" | "guest_bartender";
    name: string;
    email?: string;
    roleLabel?: string;
    businessId?: number;
    locationId?: number;
    eventDate?: string;
    eventStartTime?: string;
    eventEndTime?: string;
  },
) {
  return fetchJson<CampaignParticipant>(`/api/manage/campaigns/${slug}/participants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function removeCampaignParticipant(slug: string, participantId: number) {
  return fetchJson<{ success: boolean }>(
    `/api/manage/campaigns/${slug}/participants/${participantId}`,
    { method: "DELETE" },
  );
}

// ─── Receipts ────────────────────────────────────────────────────────────────

export interface ReceiptRecord {
  id: number;
  imageUrl: string;
  ocrStatus: string;
  reviewStatus: string;
  subtotal: number | null;
  eligibleSubtotal: number | null;
  donationPercentage: number | null;
  calculatedDonation: number | null;
  uploadedAt: string;
  businessName: string | null;
  locationName: string | null;
  supporterEmail: string | null;
  supporterName: string | null;
}

export function fetchCampaignReceipts(slug: string, status?: string) {
  const q = status ? `?status=${encodeURIComponent(status)}` : "";
  return fetchJson<ReceiptRecord[]>(`/api/campaigns/${slug}/receipts${q}`);
}

/** A single receipt in the signed-in supporter's history (across campaigns). */
export interface MyReceipt {
  id: number;
  ocrStatus: string;
  reviewStatus: string;
  eligibleSubtotal: number | null;
  donationPercentage: number | null;
  calculatedDonation: number | null;
  uploadedAt: string;
  campaignName: string | null;
  campaignSlug: string | null;
  businessName: string | null;
  locationName: string | null;
}

/** Receipt history for the signed-in supporter (auth-scoped by email). */
export function fetchMyReceipts() {
  return fetchJson<MyReceipt[]>(`/api/receipts/mine`);
}

export function reviewReceipt(id: number, action: "approve" | "reject", eligibleSubtotal?: number) {
  return fetchJson<{ success: boolean }>(`/api/receipts/${id}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, eligibleSubtotal }),
  });
}

/** Result of a supporter uploading a receipt for review. */
export interface ReceiptUploadResult {
  id: number;
  ocrStatus: string;
  reviewStatus: string;
  eligibleSubtotal: number | null;
  calculatedDonation: number | null;
  donationPercentage: number | null;
  imageUrl: string;
  message?: string;
  /** Mindee extract status when OCR engine ran. */
  ocrExtractStatus?: string | null;
  ocrProvider?: string | null;
  merchantName?: string | null;
  isManualSubtotal?: boolean;
}

/** Supporter-facing receipt upload. Mirrors `submitParticipation` in shape. */
export function uploadReceipt(
  slug: string,
  body: {
    firstName: string;
    email: string;
    businessId: number;
    locationId: number;
    methodId: number;
    imageBase64: string;
    imageMimeType?: string;
    claimedSubtotal?: number;
    receiptModelId?: string;
  },
) {
  return fetchJson<ReceiptUploadResult>(`/api/campaigns/${slug}/receipts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
}

/**
 * Uploads an image (e.g. a campaign cover) to S3 via the API and returns the
 * stored reference. The reference is persisted on the campaign; read paths turn
 * it into a presigned URL.
 */
export function uploadImage(body: {
  imageBase64: string;
  imageMimeType?: string;
  kind?: "cover" | "logo";
}) {
  return fetchJson<{ url: string }>("/api/uploads/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ─── Campaign gallery images (max 8) ─────────────────────────────────────────

export interface SuggestedCampaignImage {
  url: string;
  source: "website" | "facebook" | "instagram" | "social_suggest";
  sourceUrl: string | null;
  /** Optional public post caption when the server extracted one. */
  caption?: string | null;
}

export interface CampaignGalleryImage {
  id: number;
  imageUrl: string;
  storedUrl?: string;
  source: string;
  sourceUrl: string | null;
  sortOrder: number;
  isCover: boolean;
}

/** POST /api/campaign-images/suggest — OG/preview images from social + website. */
export function suggestCampaignImages(body: {
  facebookUrl?: string;
  instagramHandle?: string;
  websiteUrl?: string;
  linkedinUrl?: string;
  youtubeUrl?: string;
  limit?: number;
}) {
  return fetchJson<{ images: SuggestedCampaignImage[] }>("/api/campaign-images/suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** GET /api/campaign-images/:slug — public gallery. */
export function fetchCampaignImages(slug: string) {
  return fetchJson<{ images: CampaignGalleryImage[] }>(`/api/campaign-images/${slug}`);
}

/** PUT /api/campaign-images/:slug — replace gallery (auth required). */
export function putCampaignImages(
  slug: string,
  images: {
    imageUrl: string;
    source?: string;
    sourceUrl?: string | null;
    isCover?: boolean;
  }[],
) {
  return fetchJson<{ images: CampaignGalleryImage[] }>(`/api/campaign-images/${slug}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ images }),
  });
}

// ─── Settlement ──────────────────────────────────────────────────────────────

export interface SettlementReport {
  campaign: {
    name: string;
    status: string;
    startDate: string | null;
    endDate: string | null;
    isLocked: boolean;
    graceDays?: number;
    closedAt?: string | null;
    frozenAt?: string | null;
    adjustmentWindowEnd?: string | null;
    platformFeePercent?: number | null;
    cardFeePercent?: number | null;
    cardFeeFixed?: number | null;
    bartenderTips?: number;
    silentAuction?: number;
  };
  pipeline?: {
    closed: boolean;
    frozen: boolean;
    snapshot: boolean;
    statementsSent: boolean;
  };
  statements?: {
    nonprofitPdf: string | null;
    internalPdf: string | null;
  };
  auditLog?: { action: string; details: string | null; at: string }[];
  receiptStats: { total: number; approved: number; pending: number };
  businessReports: {
    id: number;
    businessName: string;
    locationName: string;
    eligibleSales: number;
    donationPercentage: number;
    donationPool: number;
    givebackAmount?: number;
    forkupFee: number;
    netNonprofitAmount: number;
    stripeDonations?: number;
    stripeFee?: number;
    stripeNet?: number;
    achDebitAmount?: number;
    achStatus?: string;
    snapshotStatus?: string;
    pdfBusinessPath?: string | null;
    pdfAchPath?: string | null;
    paymentStatus: string;
    lockedAt: string | null;
  }[];
  nonprofitReport: {
    eligibleSales: number;
    donationPool: number;
    forkupFee: number;
    netNonprofitAmount: number;
  };
  /** Online donations — separate from business giveback settlement. */
  onlineDonations?: {
    count: number;
    total: number;
  };
  achApprovals?: {
    id: number;
    settlementId: number;
    approvalType: "business_debit" | "nonprofit_payout";
    amount: number;
    status: string;
    approvedAt: string | null;
    approvedByName: string | null;
    businessName: string | null;
    locationName: string | null;
  }[];
  calculationReview?: {
    platformFeePercent: number;
    cardFeePercent: number;
    cardFeeFixed: number;
    business: {
      eligibleSales: number;
      grossGiveback: number;
      forkupFee: number;
      netFromGiveback: number;
      achDebitTotal: number;
      amountOwedByBusiness: number;
    };
    online: {
      donationsGross: number;
      cardProcessingFee: number;
      netAfterFees: number;
      amountOwedToNonprofit: number;
      donationCount: number;
    } | null;
    totals: {
      donationPool: number;
      forkupFee: number;
      netToNonprofit: number;
      outstandingBusinessAch: number;
      outstandingNonprofitPayout: number;
    };
    lines: { label: string; formula: string; amount: number }[];
  };
}

export function fetchSettlementReport(slug: string) {
  return fetchJson<SettlementReport>(`/api/manage/campaigns/${slug}/settlement`);
}

export function lockCampaignSettlement(slug: string) {
  return fetchJson<{ success: boolean; status: string }>(`/api/manage/campaigns/${slug}/lock`, {
    method: "POST",
  });
}

export function patchSettlementAchStatus(
  slug: string,
  settlementId: number,
  achStatus: "pending" | "processing" | "paid" | "failed",
) {
  return fetchJson<{ success: boolean; achStatus: string }>(
    `/api/manage/campaigns/${slug}/settlements/${settlementId}/ach-status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ achStatus }),
    },
  );
}

export function patchSettlementSettings(
  slug: string,
  body: {
    platformFeePercent: number | null;
    cardFeePercent: number | null;
    cardFeeFixed: number | null;
    bartenderTips: number;
    silentAuction: number;
  },
) {
  return fetchJson<{ success: boolean }>(`/api/manage/campaigns/${slug}/settlement-settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ─── Payouts / Disbursements ─────────────────────────────────────────────────

export type PayoutType = "business_to_forkup" | "forkup_to_nonprofit" | "adjustment";
export type PayoutStatus = "pending" | "processing" | "paid" | "failed" | "cancelled";
export type PayoutMethod = "ach" | "check" | "manual" | "other";

export interface Payout {
  id: number;
  payoutType: PayoutType;
  amount: number;
  status: PayoutStatus;
  method: PayoutMethod | null;
  reference: string | null;
  notes: string | null;
  settlementId: number | null;
  businessId: number | null;
  locationId: number | null;
  businessName: string | null;
  locationName: string | null;
  initiatedAt: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PayoutsResponse {
  payouts: Payout[];
  summary: { totalPaid: number; totalPending: number; count: number };
}

export function fetchCampaignPayouts(slug: string) {
  return fetchJson<PayoutsResponse>(`/api/manage/campaigns/${slug}/payouts`);
}

export function recordPayout(
  slug: string,
  body: {
    payoutType: PayoutType;
    amount: number;
    status?: PayoutStatus;
    method?: PayoutMethod;
    reference?: string;
    notes?: string;
    settlementId?: number;
    businessId?: number;
    locationId?: number;
  },
) {
  return fetchJson<Payout>(`/api/manage/campaigns/${slug}/payouts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function updatePayout(
  slug: string,
  id: number,
  body: { status: PayoutStatus; method?: PayoutMethod; reference?: string; notes?: string },
) {
  return fetchJson<Payout>(`/api/manage/campaigns/${slug}/payouts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ─── Analytics & Insights ────────────────────────────────────────────────────

export interface CampaignAnalytics {
  campaign: {
    name: string;
    status: string;
    goal: number;
    raised: number;
  };
  totals: {
    receiptsUploaded: number;
    receiptsApproved: number;
    receiptsPending: number;
    receiptsRejected: number;
    eligibleSales: number;
    donationPool: number;
    averageContribution: number;
    supporters: number;
    onlineDonationCount: number;
    onlineDonationTotal: number;
  };
  businessLeaderboard: {
    businessId: number | null;
    locationId: number | null;
    businessName: string;
    locationName: string;
    approvedReceipts: number;
    eligibleSales: number;
    donationPool: number;
  }[];
  timeline: {
    date: string;
    receipts: number;
    donationPool: number;
  }[];
}

export function fetchCampaignAnalytics(slug: string) {
  return fetchJson<CampaignAnalytics>(`/api/manage/campaigns/${slug}/analytics`);
}

// --- Platform Super Admin ----------------------------------------------------

export type SuperAdminUser = {
  id: number;
  email: string;
  fullName: string | null;
  username: string | null;
  isPlatformAdmin: boolean;
};

export function superAdminLogin(username: string, password: string) {
  return fetchJson<{ token: string; user: SuperAdminUser }>("/api/superadmin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
}

export function superAdminForgotPassword(emailOrUsername: string) {
  return fetchJson<{ success: boolean; message: string }>("/api/superadmin/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ emailOrUsername }),
  });
}

export function superAdminResetPassword(token: string, password: string) {
  return fetchJson<{ success: boolean }>("/api/superadmin/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
  });
}

export function fetchSuperAdminMe() {
  return fetchJson<{ user: SuperAdminUser }>("/api/superadmin/me");
}

export function updateSuperAdminProfile(body: { fullName?: string; email?: string }) {
  return fetchJson<{ user: SuperAdminUser }>("/api/superadmin/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function changeSuperAdminPassword(currentPassword: string, newPassword: string) {
  return fetchJson<{ success: boolean }>("/api/superadmin/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

/**
 * GET /api/superadmin/settings/ai
 * Response: selectedModelId, selectedReceiptModelId, pricingSource ("aws"|"fallback"|"mixed"),
 * pricingFetchedAt (ISO), models[{ id, label, vendor, tier, blurb,
 * inputPer1M, outputPer1M, pricingSource, estimatedRunCost, estimatedReceiptRunCost }]
 */
export function fetchSuperAdminAiSettings() {
  return fetchJson<{
    selectedModelId: string;
    selectedReceiptModelId: string;
    pricingSource?: "aws" | "fallback" | "mixed";
    pricingFetchedAt?: string;
    models: {
      id: string;
      label: string;
      vendor: string;
      tier: string;
      blurb: string;
      inputPer1M: number;
      outputPer1M: number;
      pricingSource?: "aws" | "fallback";
      estimatedRunCost: number;
      estimatedReceiptRunCost: number;
    }[];
  }>("/api/superadmin/settings/ai");
}

export function saveSuperAdminAiSettings(input: {
  modelId?: string;
  receiptModelId?: string;
}) {
  return fetchJson<{
    success: boolean;
    selectedModelId: string;
    selectedReceiptModelId: string;
  }>("/api/superadmin/settings/ai", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

/** User-facing AI engine (not Super Admin). */
export function fetchUserAiSettings() {
  return fetchJson<{ modelId: string }>("/api/ai/settings", {
    headers: { ...authHeaders() },
  });
}

export function saveUserAiSettings(modelId: string) {
  return fetchJson<{ modelId: string }>("/api/ai/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ modelId }),
  });
}

export function fetchAiModelCatalog() {
  return fetchJson<{
    models: {
      id: string;
      label: string;
      vendor: string;
      tier: string;
      blurb: string;
      inputPer1M: number;
      outputPer1M: number;
    }[];
  }>("/api/ai/models");
}

export function fetchSuperAdminCharges() {
  return fetchJson<{
    platformFeePercent: number;
    example: {
      eligibleSales: number;
      givebackPercentage: number;
      donationPool: number;
      platformFee: number;
      netNonprofitAmount: number;
    };
  }>("/api/superadmin/settings/charges");
}

export function saveSuperAdminCharges(platformFeePercent: number) {
  return fetchJson<{ success: boolean; platformFeePercent: number }>(
    "/api/superadmin/settings/charges",
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platformFeePercent }),
    },
  );
}

export function fetchSuperAdminSmtp() {
  return fetchJson<{
    emailProvider: string;
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPassSet: boolean;
    smtpPassMasked: string;
    smtpFrom: string;
    smtpSecure: boolean;
    sesConfigured: boolean;
  }>("/api/superadmin/settings/smtp");
}

export function saveSuperAdminSmtp(body: Record<string, unknown>) {
  return fetchJson<{ success: boolean }>("/api/superadmin/settings/smtp", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function testSuperAdminSmtp(to?: string) {
  return fetchJson<{
    success: boolean;
    result: {
      status: string;
      provider: string;
      messageId: string | null;
      errorMessage?: string | null;
    };
  }>("/api/superadmin/settings/smtp/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to }),
  });
}

export function fetchSuperAdminAccessRequests(status = "pending") {
  const qs = new URLSearchParams({ status });
  return fetchJson<AccessRequest[]>(`/api/superadmin/access-requests?${qs}`);
}

export function approveSuperAdminAccessRequest(id: number) {
  return fetchJson<{ success: boolean }>(`/api/superadmin/access-requests/${id}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
}

export function denySuperAdminAccessRequest(id: number) {
  return fetchJson<{ success: boolean }>(`/api/superadmin/access-requests/${id}/deny`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
}

/** Super-admin per-campaign KPI row (creator-parity). */
export type SuperAdminCampaignActivity = {
  id: number;
  slug: string;
  name: string;
  nonprofit: string;
  status: string;
  goal: number;
  raised: number;
  supportersGoing: number;
  expectedGuests: number;
  verifiedVisits: number;
  startDate: string | null;
  endDate: string | null;
  eventDate: string | null;
  businessTimingStatus: string;
  forkupReviewStatus: string;
  methods: { methodType: string; methodStatus: string }[];
  partnersInvited: number;
  partnersPending: number;
  partnersAccepted: number;
  partnersNeedsInfo: number;
  participantCount: number;
  ambassadorCount: number;
  receiptSupporters: number;
  receiptsUploaded: number;
  receiptsApproved: number;
  receiptsPending: number;
  receiptsRejected: number;
  eligibleSales: number;
  givebackPool: number;
  onlineDonationCount: number;
  onlineDonationTotal: number;
  settlementForkupFee: number;
  settlementNetNonprofit: number;
  settlementDonationPool: number;
};

export type SuperAdminActivitySummary = {
  campaignCount: number;
  liveCount: number;
  draftCount: number;
  totalRaised: number;
  totalGoal: number;
  onlineDonationTotal: number;
  onlineDonationCount: number;
  givebackPool: number;
  eligibleSales: number;
  supporters: number;
  supportersGoing: number;
  receiptsUploaded: number;
  receiptsApproved: number;
  partnersInvited: number;
  partnersAccepted: number;
  ambassadorCount: number;
  settlementForkupFee: number;
  settlementNetNonprofit: number;
};

/**
 * Superadmin organization detail payload from
 * GET /api/superadmin/organizations/:type/:id
 */
export type SuperAdminOrgProfile = {
  id: number;
  slug?: string | null;
  organizationName?: string | null;
  businessName?: string | null;
  logoUrl?: string | null;
  mission?: string | null;
  description?: string | null;
  website?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  causeCategory?: string | null;
  ein?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  businessType?: string | null;
  verificationStatus?: string | null;
  claimStatus?: string | null;
  profileStatus?: string | null;
  businessStatus?: string | null;
  defaultGivebackPercentage?: number | null;
  supportsDineAndDonate?: boolean;
  supportsShopAndDonate?: boolean;
  supportsServiceGiveback?: boolean;
  supportsGuestBartending?: boolean;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  linkedinUrl?: string | null;
  tiktokUrl?: string | null;
  youtubeUrl?: string | null;
  claimedByUserId?: number | null;
  claimDate?: string | null;
  verificationDate?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type SuperAdminOrganizationDetails = {
  organizationType: "nonprofit" | "business";
  organization: SuperAdminOrgProfile;
  locations?: {
    id: number;
    locationName: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    phone: string | null;
    websiteUrl: string | null;
    reservationUrl?: string | null;
    bookingUrl?: string | null;
    activeStatus?: boolean;
  }[];
  accessRequest: AccessRequest | null;
  /** Creator-parity totals across this org's campaigns. */
  activitySummary?: SuperAdminActivitySummary;
  /** Per-campaign KPIs (raised, supporters, receipts, partners, settlement). */
  campaigns?: SuperAdminCampaignActivity[];
};

/**
 * GET /api/superadmin/organizations/:type/:id
 * Inputs: organization type + id, optional requestId.
 * Outputs: full organization profile (+ locations for business), optional access request,
 *          and campaign activity KPIs for superadmin visibility.
 */
export function fetchSuperAdminOrganizationDetails(
  organizationType: "nonprofit" | "business",
  organizationId: number,
  requestId?: number | null,
) {
  const qs = new URLSearchParams();
  if (requestId != null && Number.isFinite(requestId) && requestId > 0) {
    qs.set("requestId", String(requestId));
  }
  const q = qs.toString();
  return fetchJson<SuperAdminOrganizationDetails>(
    `/api/superadmin/organizations/${encodeURIComponent(organizationType)}/${organizationId}${
      q ? `?${q}` : ""
    }`,
  );
}

/** Nick V2 Layer 6 — campaigns needing ForkUp timing review. */
export type ForkupReviewQueueItem = {
  slug: string;
  name: string;
  nonprofit: string;
  status: string;
  businessTimingStatus: string;
  forkupReviewStatus: string;
  startDate: string | null;
  eventDate: string | null;
};

export function fetchSuperAdminForkupReviewQueue() {
  return fetchJson<ForkupReviewQueueItem[]>("/api/superadmin/forkup-review-queue");
}

/**
 * Full campaign detail for ForkUp review View details.
 * Method: GET /api/superadmin/forkup-review/:slug
 */
export type SuperAdminForkupReviewDetail = {
  slug: string;
  name: string;
  nonprofit: string;
  nonprofitContactName: string | null;
  nonprofitContactEmail: string | null;
  status: string;
  goal: number;
  story: string | null;
  coverImageUrl: string | null;
  startDate: string | null;
  endDate: string | null;
  eventDate: string | null;
  businessTimingStatus: string;
  forkupReviewStatus: string;
  forkupReviewReason: string | null;
  methods: {
    methodType: string;
    methodName: string;
    methodStatus: string;
    timingStatus: string;
  }[];
};

export function fetchSuperAdminForkupReviewDetail(slug: string) {
  return fetchJson<SuperAdminForkupReviewDetail>(
    `/api/superadmin/forkup-review/${encodeURIComponent(slug)}`,
  );
}

/** Approve short-timeline ForkUp review for a campaign (superadmin). */
export function approveSuperAdminForkupReview(slug: string) {
  return fetchJson<{
    success: boolean;
    slug: string;
    forkupReviewStatus: string;
    businessTimingStatus: string;
  }>(`/api/superadmin/forkup-review/${encodeURIComponent(slug)}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
}

/** Deny short-timeline ForkUp review for a campaign (superadmin). */
export function denySuperAdminForkupReview(slug: string) {
  return fetchJson<{
    success: boolean;
    slug: string;
    forkupReviewStatus: string;
    businessTimingStatus: string;
  }>(`/api/superadmin/forkup-review/${encodeURIComponent(slug)}/deny`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
}

/**
 * Request changes on a campaign in ForkUp review (superadmin).
 * Method: POST /api/superadmin/forkup-review/:slug/request-changes
 * Body: { notes?: string }
 * Response: { success, slug, forkupReviewStatus, campaignStatus }
 */
export function requestChangesSuperAdminForkupReview(slug: string, notes?: string) {
  return fetchJson<{
    success: boolean;
    slug: string;
    forkupReviewStatus: string;
    businessTimingStatus: string;
    campaignStatus: string;
  }>(`/api/superadmin/forkup-review/${encodeURIComponent(slug)}/request-changes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes: notes?.trim() || undefined }),
  });
}

/**
 * Live campaigns list for superadmin console.
 * Method: GET /api/superadmin/live-campaigns
 */
export type SuperAdminLiveCampaign = {
  slug: string;
  name: string;
  nonprofit: string;
  status: string;
  goal: number;
  raised: number;
  startDate: string | null;
  endDate: string | null;
  updatedAt: string | null;
};

export function fetchSuperAdminLiveCampaigns() {
  return fetchJson<SuperAdminLiveCampaign[]>("/api/superadmin/live-campaigns");
}

/**
 * Hard-delete a live campaign (superadmin).
 * Method: DELETE /api/superadmin/live-campaigns/:slug
 */
export function deleteSuperAdminLiveCampaign(slug: string) {
  return fetchJson<{ success: boolean; slug: string }>(
    `/api/superadmin/live-campaigns/${encodeURIComponent(slug)}`,
    { method: "DELETE" },
  );
}

/** v1-parity directory endpoints (list/view). */
export type SuperAdminOverview = {
  users: number;
  nonprofits: number;
  businesses: number;
  campaigns: number;
  fundraisers: number;
  donations: number;
};

export function fetchSuperAdminOverview() {
  return fetchJson<SuperAdminOverview>("/api/superadmin/overview");
}

export type SuperAdminDirectoryUser = {
  id: number;
  email: string;
  fullName: string | null;
  username: string | null;
  isPlatformAdmin: boolean;
  memberships: { organizationType: string; organizationId: number; role: string }[];
  createdAt: string;
  updatedAt: string;
};

export function fetchSuperAdminUsers(opts?: { search?: string; limit?: number; offset?: number }) {
  const q = new URLSearchParams();
  if (opts?.search) q.set("search", opts.search);
  if (opts?.limit != null) q.set("limit", String(opts.limit));
  if (opts?.offset != null) q.set("offset", String(opts.offset));
  const qs = q.toString();
  return fetchJson<{ totalCount: number; users: SuperAdminDirectoryUser[] }>(
    `/api/superadmin/users${qs ? `?${qs}` : ""}`,
  );
}

/**
 * Hard-delete a non-platform-admin user (superadmin).
 * Method: DELETE /api/superadmin/users/:id
 * Response: { success, id, email }
 */
export function deleteSuperAdminUser(id: number) {
  return fetchJson<{ success: boolean; id: number; email: string }>(
    `/api/superadmin/users/${id}`,
    { method: "DELETE" },
  );
}

export type SuperAdminRoleRow = {
  id: string;
  roleName: string;
  description: string;
  userCount: number;
};

export function fetchSuperAdminRoles() {
  return fetchJson<{ roles: SuperAdminRoleRow[] }>("/api/superadmin/roles");
}

export type SuperAdminNonprofitRow = {
  id: number;
  organizationName: string;
  slug: string;
  logoUrl: string | null;
  website: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  city: string | null;
  state: string | null;
  ein: string | null;
  verificationStatus: string | null;
  claimStatus: string | null;
  profileStatus: string | null;
  createdAt: string;
  updatedAt: string;
};

export function fetchSuperAdminNonprofits(opts?: {
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const q = new URLSearchParams();
  if (opts?.search) q.set("search", opts.search);
  if (opts?.limit != null) q.set("limit", String(opts.limit));
  if (opts?.offset != null) q.set("offset", String(opts.offset));
  const qs = q.toString();
  return fetchJson<{ totalCount: number; nonprofits: SuperAdminNonprofitRow[] }>(
    `/api/superadmin/nonprofits${qs ? `?${qs}` : ""}`,
  );
}

export type SuperAdminBusinessLocationRow = {
  id: number;
  locationName: string;
  city: string | null;
  state: string | null;
  achBankName: string | null;
  achAccountLast4: string | null;
  achAuthorizationStatus: string | null;
  hasAchData: boolean;
  hasSignature: boolean;
};

export type SuperAdminBusinessRow = {
  id: number;
  businessName: string;
  slug: string;
  businessType: string | null;
  logoUrl: string | null;
  website: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  businessStatus: string | null;
  claimStatus: string | null;
  profileStatus: string | null;
  locationCount: number;
  achLocationCount: number;
  locations: SuperAdminBusinessLocationRow[];
  createdAt: string;
  updatedAt: string;
};

export function fetchSuperAdminBusinesses(opts?: {
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const q = new URLSearchParams();
  if (opts?.search) q.set("search", opts.search);
  if (opts?.limit != null) q.set("limit", String(opts.limit));
  if (opts?.offset != null) q.set("offset", String(opts.offset));
  const qs = q.toString();
  return fetchJson<{ totalCount: number; businesses: SuperAdminBusinessRow[] }>(
    `/api/superadmin/businesses${qs ? `?${qs}` : ""}`,
  );
}

export type SuperAdminCampaignRow = {
  id: number;
  slug: string;
  name: string;
  nonprofit: string | null;
  status: string | null;
  goal: number | null;
  raised: number;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export function fetchSuperAdminCampaigns(opts?: {
  search?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const q = new URLSearchParams();
  if (opts?.search) q.set("search", opts.search);
  if (opts?.status) q.set("status", opts.status);
  if (opts?.limit != null) q.set("limit", String(opts.limit));
  if (opts?.offset != null) q.set("offset", String(opts.offset));
  const qs = q.toString();
  return fetchJson<{ totalCount: number; campaigns: SuperAdminCampaignRow[] }>(
    `/api/superadmin/campaigns${qs ? `?${qs}` : ""}`,
  );
}

export type SuperAdminFundraiserRow = {
  id: number;
  email: string;
  fullName: string | null;
  campaignCount: number;
  status: string | null;
  createdAt: string;
};

export function fetchSuperAdminFundraisers(opts?: {
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const q = new URLSearchParams();
  if (opts?.search) q.set("search", opts.search);
  if (opts?.limit != null) q.set("limit", String(opts.limit));
  if (opts?.offset != null) q.set("offset", String(opts.offset));
  const qs = q.toString();
  return fetchJson<{ totalCount: number; fundraisers: SuperAdminFundraiserRow[] }>(
    `/api/superadmin/fundraisers${qs ? `?${qs}` : ""}`,
  );
}

export type SuperAdminDonationRow = {
  id: number;
  amount: number;
  donationType: string | null;
  paymentStatus: string | null;
  campaignName: string | null;
  campaignSlug: string | null;
  createdAt: string;
};

export function fetchSuperAdminDonations(opts?: { limit?: number; offset?: number }) {
  const q = new URLSearchParams();
  if (opts?.limit != null) q.set("limit", String(opts.limit));
  if (opts?.offset != null) q.set("offset", String(opts.offset));
  const qs = q.toString();
  return fetchJson<{ totalCount: number; donations: SuperAdminDonationRow[] }>(
    `/api/superadmin/donations${qs ? `?${qs}` : ""}`,
  );
}

/** Nick V2 Layer 4 — campaign AI guidance (rules first, AI polish optional). */
export type CampaignAiTimingGuidance = {
  timing: {
    status: string;
    message: string | null;
    daysUntilAnchor: number | null;
    anchorKind: string | null;
  };
  summary: string;
  aiExplanation: string | null;
  provider: string;
};

export type CampaignAiInviteReadiness = {
  score: number;
  summary: string;
  factors: { label: string; points: number; note: string }[];
  aiExplanation: string | null;
  provider: string;
};

export type CampaignAiMethodMix = {
  recommended: string[];
  summary: string;
  aiExplanation: string | null;
  provider: string;
};

export type CampaignAiHealth = {
  summary: string;
  nudges: { severity: "info" | "warn" | "critical"; message: string }[];
  provider: string;
};

export function postCampaignAiTimingGuidance(body: Record<string, unknown>) {
  return fetchJson<CampaignAiTimingGuidance>("/api/campaign-ai/timing-guidance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function postCampaignAiMethodMix(body: Record<string, unknown>) {
  return fetchJson<CampaignAiMethodMix>("/api/campaign-ai/method-mix", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function postCampaignAiInviteReadiness(body: Record<string, unknown>) {
  return fetchJson<CampaignAiInviteReadiness>("/api/campaign-ai/invite-readiness", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function postCampaignAiGenerateCalendar(slug: string) {
  return fetchJson<{
    success: boolean;
    created: number;
    totalDrafts: number;
    message: string;
    provider: string;
  }>("/api/campaign-ai/generate-calendar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug }),
  });
}

export function fetchCampaignAiHealth(slug: string) {
  return fetchJson<CampaignAiHealth>(
    `/api/campaign-ai/${encodeURIComponent(slug)}/health`,
  );
}

export function postCampaignAiAdminReviewSummary(slug: string) {
  return fetchJson<{
    summary: string;
    recommendation: string;
    provider: string;
  }>(`/api/campaign-ai/${encodeURIComponent(slug)}/admin-review-summary`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
}

export function postCampaignAiSettlementNarrative(slug: string) {
  return fetchJson<{
    summary: string;
    totals: Record<string, number>;
    provider: string;
  }>(`/api/campaign-ai/${encodeURIComponent(slug)}/settlement-narrative`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
}

/** Send an in-app Success Team message (SMTP to platform admin / support inbox). */
export function postSupportContact(body: {
  message: string;
  campaignSlug?: string;
  campaignName?: string;
}) {
  return fetchJson<{ success: boolean }>("/api/support/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
