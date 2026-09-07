/**
 * Nonprofit ACH settings API client (Task 19).
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
    throw new Error(typeof body.error === "string" ? body.error : `API error: ${res.status}`);
  }
  return body as T;
}

export type NonprofitAchSettings = {
  nonprofitId: number;
  organizationName: string;
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
};

export function fetchNonprofitAch(nonprofitId: number) {
  return fetchJson<NonprofitAchSettings>(`/api/profiles/nonprofits/${nonprofitId}/ach`);
}

export function saveNonprofitAch(
  nonprofitId: number,
  body: {
    achBankName?: string;
    achAccountHolderName?: string;
    achAccountType?: string;
    achRoutingNumber?: string;
    achAccountNumber?: string;
    achAuthorizedBy?: string;
    achAuthorizedEmail?: string;
    achContactEmail?: string;
    achAuthorizationStatus?: string;
    achSignatureBase64?: string;
  },
) {
  return fetchJson<{ ok: boolean; nonprofitId: number; hasAchData: boolean }>(
    `/api/profiles/nonprofits/${nonprofitId}/ach`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}
