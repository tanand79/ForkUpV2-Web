/**
 * API helpers for NPO org profile (gallery + social/about + load).
 * Mirrors api-business-onboarding venue gallery/links helpers.
 */
import { authHeaders } from "@/lib/auth-storage";
import { getApiBaseUrl } from "@/lib/api-config";

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
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(init?.headers ?? {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(
      typeof data === "object" && data && "error" in data && data.error
        ? String(data.error)
        : `Request failed (${res.status})`,
    );
  }
  return data;
}

export type NonprofitOrgProfileResponse = {
  nonprofitId: number;
  organizationName: string;
  slug: string;
  about: string;
  mission: string | null;
  website: string | null;
  contactName: string | null;
  contactEmail: string | null;
  phone: string | null;
  causeCategory: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  logoUrl: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  linkedinUrl: string | null;
  tiktokUrl: string | null;
  youtubeUrl: string | null;
  galleryImageUrls: string[];
  coverUrl: string | null;
};

/** GET /api/nonprofit-org-profile?nonprofitId= */
export function fetchNonprofitOrgProfile(nonprofitId: number) {
  return fetchJson<NonprofitOrgProfileResponse>(
    `/api/nonprofit-org-profile?nonprofitId=${encodeURIComponent(String(nonprofitId))}`,
  );
}

/** POST /api/nonprofit-gallery — append uploads + set cover (auth). */
export function saveNonprofitGallery(body: {
  nonprofitId: number;
  imageUrls?: string[];
  coverUrl?: string | null;
}) {
  return fetchJson<{ imageUrls: string[]; coverUrl: string | null }>(
    "/api/nonprofit-gallery",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

/** POST /api/nonprofit-links — overwrite social / about / contact (auth). */
export function saveNonprofitLinks(body: {
  nonprofitId: number;
  website?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  linkedinUrl?: string | null;
  tiktokUrl?: string | null;
  youtubeUrl?: string | null;
  phone?: string | null;
  contactEmail?: string | null;
  about?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  organizationName?: string | null;
}) {
  return fetchJson<Record<string, string | null>>("/api/nonprofit-links", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
