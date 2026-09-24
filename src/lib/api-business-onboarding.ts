/**
 * Business AI onboarding API (Tasks 6–7).
 * POST /api/generate-business-draft — website scrape + AI profile draft.
 */
import { getApiBaseUrl } from "@/lib/api-config";
import { authHeaders } from "@/lib/auth-storage";

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
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(init?.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      typeof (body as { error?: string }).error === "string"
        ? (body as { error: string }).error
        : `API error: ${res.status}`;
    throw new Error(message);
  }
  return body as T;
}

export type BusinessDraftApiResult = {
  website: string;
  businessName: string;
  businessType: string;
  about: string;
  contactEmail: string;
  phone: string;
  city: string;
  state: string;
  locations: {
    locationName: string;
    city: string;
    state: string;
    address?: string;
    reservationUrl?: string;
  }[];
  reservationUrl?: string | null;
  bookingPlatform?: string | null;
  imageUrls: string[];
  /** Weekday labels from the public site. Absent on older API responses. */
  discountHours?: Record<string, string> | null;
  eligibleWindow?: string | null;
  /** Additive: social profile URLs from the website. */
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  linkedinUrl?: string | null;
  youtubeUrl?: string | null;
  tiktokUrl?: string | null;
  supportsDineAndDonate: boolean;
  supportsShopAndDonate: boolean;
  supportsServiceGiveback: boolean;
  supportsGuestBartending: boolean;
  missingFields: string[];
  confirmationStatus: string;
  provider: string;
};

export function generateBusinessDraft(
  website: string,
  near?: { nearZip?: string; city?: string; state?: string },
) {
  return fetchJson<BusinessDraftApiResult>("/api/generate-business-draft", {
    method: "POST",
    body: JSON.stringify({
      website,
      nearZip: near?.nearZip,
      city: near?.city,
      state: near?.state,
    }),
  });
}

/** Pass D1/D2 — find restaurant/local business from a typed name. */
export type FindBusinessProfileResult = {
  businessName: string;
  website: string;
  businessType: string;
  about: string;
  contactEmail: string;
  phone: string;
  city: string;
  state: string;
  address: string;
  zip: string;
  locations: {
    locationName: string;
    city: string;
    state: string;
    address?: string;
    reservationUrl?: string;
  }[];
  reservationUrl?: string | null;
  bookingPlatform?: string | null;
  logoUrl: string | null;
  imageUrls: string[];
  /** Weekday labels from the public site. Absent on older API responses. */
  discountHours?: Record<string, string> | null;
  eligibleWindow?: string | null;
  /** Additive: social profile URLs from the website. */
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  linkedinUrl?: string | null;
  youtubeUrl?: string | null;
  tiktokUrl?: string | null;
  checks: {
    websiteFound: boolean;
    logoFound: boolean;
    photosFound: boolean;
    locationFound: boolean;
  };
  locationSourceUrl: string | null;
  joinDoorType: "restaurant" | "local" | null;
  confirmationStatus: string;
  provider: string;
};

/**
 * POST /api/find-business-profile
 * Inputs: businessName, optional joinDoorType, optional nearZip/city/state,
 *         optional website (known DB/site URL — preferred for social scrape).
 * Outputs: confirmation card payload (website, location, photos, social, checks).
 */
export function findBusinessProfile(body: {
  businessName: string;
  joinDoorType?: "restaurant" | "local";
  nearZip?: string;
  city?: string;
  state?: string;
  /** Known public website — skip AI host guess when set (e.g. The Pear). */
  website?: string;
  /** Persist discovered public links onto this business (null-only fill). */
  businessId?: number;
}) {
  return fetchJson<FindBusinessProfileResult>("/api/find-business-profile", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * POST /api/business-venue-images — Resy carousel + site gallery photos only.
 */
export function fetchBusinessVenueImages(body: {
  websiteUrl: string;
  reservationUrl?: string | null;
  /** Persist gallery onto this business when scrape returns photos. */
  businessId?: number;
}) {
  return fetchJson<{
    imageUrls: string[];
    reservationUrl: string | null;
    /** Durable cover from businesses.venue_cover_url when cached. */
    coverUrl?: string | null;
  }>("/api/business-venue-images", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * POST /api/business-venue-gallery — append user uploads + set cover (auth).
 */
export function saveBusinessVenueGallery(body: {
  businessId: number;
  imageUrls?: string[];
  coverUrl?: string | null;
}) {
  return fetchJson<{ imageUrls: string[]; coverUrl: string | null }>(
    "/api/business-venue-gallery",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

/**
 * POST /api/business-venue-links — overwrite venue social / contact links (auth).
 */
export function saveBusinessVenueLinks(body: {
  businessId: number;
  website?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  linkedinUrl?: string | null;
  tiktokUrl?: string | null;
  phone?: string | null;
  venueEmail?: string | null;
}) {
  return fetchJson<{
    website?: string | null;
    facebookUrl?: string | null;
    instagramUrl?: string | null;
    linkedinUrl?: string | null;
    tiktokUrl?: string | null;
    phone?: string | null;
    venueEmail?: string | null;
  }>("/api/business-venue-links", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
