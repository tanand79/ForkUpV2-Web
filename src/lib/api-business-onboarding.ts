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
  locations: { locationName: string; city: string; state: string; address?: string }[];
  imageUrls: string[];
  supportsDineAndDonate: boolean;
  supportsShopAndDonate: boolean;
  supportsServiceGiveback: boolean;
  supportsGuestBartending: boolean;
  missingFields: string[];
  confirmationStatus: string;
  provider: string;
};

export function generateBusinessDraft(website: string) {
  return fetchJson<BusinessDraftApiResult>("/api/generate-business-draft", {
    method: "POST",
    body: JSON.stringify({ website }),
  });
}
