import type { CreateCampaignPayload, CreateCampaignResult } from "@/lib/builder-submit";
import type { CampaignDetail, CampaignListItem } from "@/lib/campaign-types";
import { authHeaders } from "@/lib/auth-storage";
import { getApiBaseUrl } from "@/lib/api-config";

/** API paths must not end with `/` — Next `trailingSlash` can add one and break Express routes. */
function normalizeApiPath(path: string): string {
  const q = path.indexOf("?");
  const pathname = q === -1 ? path : path.slice(0, q);
  const search = q === -1 ? "" : path.slice(q);
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return `${normalized}${search}`;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = normalizeApiPath(`${baseUrl}${path}`);
  const res = await fetch(url, {
    cache: "no-store",
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
    const hint = baseUrl
      ? "The API URL may be wrong or the server returned an error page."
      : "Set NEXT_PUBLIC_API_URL at build time or apiUrl in public/runtime-config.js on the server.";
    throw new Error(`API returned HTML instead of JSON. ${hint}`);
  }
  return res.json() as Promise<T>;
}

export function fetchCampaigns(status?: string) {
  const q = status ? `?status=${encodeURIComponent(status)}` : "";
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
}

export interface ApiBusiness {
  id: number;
  businessName: string;
  businessType: string;
  defaultGivebackPercentage: number;
  capabilities: string[];
  locations: ApiBusinessLocation[];
}

export function fetchBuilderBusinesses(query?: string) {
  const q = query?.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
  return fetchJson<ApiBusiness[]>(`/api/builder/businesses${q}`);
}

export function createCampaign(payload: CreateCampaignPayload) {
  return fetchJson<CreateCampaignResult>("/api/builder/campaigns", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
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
  campaignName: string;
  campaignStory: string;
  campaignGoal: number;
  startDate: string | null;
  endDate: string | null;
  coverImageUrl: string | null;
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
  verificationStatus: string;
  claimStatus: string;
  profileStatus: string;
  verified: boolean;
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

export interface OrganizationSearchCandidate extends NonprofitProfile {
  matchStrength: OrganizationMatchStrength;
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
}

/** Unified "Find your organization" search by name, website, EIN, and/or location. */
export function searchOrganizations(params: {
  q?: string;
  website?: string;
  ein?: string;
  location?: string;
}) {
  const search = new URLSearchParams();
  if (params.q?.trim()) search.set("q", params.q.trim());
  if (params.website?.trim()) search.set("website", params.website.trim());
  if (params.ein?.trim()) search.set("ein", params.ein.trim());
  if (params.location?.trim()) search.set("location", params.location.trim());
  // Bust any intermediary GET cache so a new search never shows a prior org.
  search.set("_", String(Date.now()));
  return fetchJson<OrganizationSearchResult>(
    `/api/profiles/nonprofits/search?${search.toString()}`,
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
}

/**
 * GoFundMe-style quick-start: send the organizer's short answers and receive an
 * AI-prepared title / story / purpose to review and edit. Text only — no image
 * generation. Mirrors the improve-story gateway route on the backend.
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
}) {
  return fetchJson<CampaignDraftResult>("/api/generate-campaign-draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
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
  givebackPercentage: number;
  participationHours: string | null;
  eligibleSalesRules: string | null;
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
  location: { name: string; city: string; state: string };
  method: { type: string; name: string };
}

export function fetchBusinessInvitation(token: string) {
  return fetchJson<BusinessInvitationDetail>(`/api/business/invitations/${token}`);
}

export interface BusinessCollaboration {
  id: number;
  token: string | null;
  acceptanceStatus: string;
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
  location: { name: string; city: string; state: string };
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
  invitationDeadline: string | null;
  methods: { id: number; methodType: string; methodName: string; methodStatus: string }[];
  invitations: {
    id: number;
    businessName: string;
    businessEmail: string | null;
    locationName: string;
    methodType: string;
    methodName: string;
    acceptanceStatus: string;
    givebackPercentage: number;
    invitedAt?: string | null;
    changeRequestMessage?: string | null;
    reviewPath?: string | null;
    token: string | null;
    acceptPath: string | null;
  }[];
  virtualDonations: { count: number; total: number };
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
  partnersInvited?: number;
  partnersPending?: number;
  partnersChangesRequested?: number;
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
}

export function fetchNonprofitPendingInvites(nonprofitId: number) {
  return fetchJson<NonprofitPendingInvite[]>(
    `/api/manage/nonprofits/${nonprofitId}/pending-invites`,
  );
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
  return fetchJson<{ token: string; user: AuthUser }>("/api/auth/register", {
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
  },
) {
  return fetchJson<ReceiptUploadResult>(`/api/campaigns/${slug}/receipts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

// ─── Settlement ──────────────────────────────────────────────────────────────

export interface SettlementReport {
  campaign: {
    name: string;
    status: string;
    startDate: string | null;
    endDate: string | null;
    isLocked: boolean;
  };
  receiptStats: { total: number; approved: number; pending: number };
  businessReports: {
    id: number;
    businessName: string;
    locationName: string;
    eligibleSales: number;
    donationPercentage: number;
    donationPool: number;
    forkupFee: number;
    netNonprofitAmount: number;
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
}

export function fetchSettlementReport(slug: string) {
  return fetchJson<SettlementReport>(`/api/manage/campaigns/${slug}/settlement`);
}

export function lockCampaignSettlement(slug: string) {
  return fetchJson<{ success: boolean; status: string }>(`/api/manage/campaigns/${slug}/lock`, {
    method: "POST",
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

export function fetchSuperAdminAiSettings() {
  return fetchJson<{
    selectedModelId: string;
    models: {
      id: string;
      label: string;
      vendor: string;
      tier: string;
      blurb: string;
      inputPer1M: number;
      outputPer1M: number;
      estimatedRunCost: number;
    }[];
  }>("/api/superadmin/settings/ai");
}

export function saveSuperAdminAiSettings(modelId: string) {
  return fetchJson<{ success: boolean; selectedModelId: string }>("/api/superadmin/settings/ai", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modelId }),
  });
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
