/**
 * Settlement ACH approval API client (public token link from email).
 */
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
  const res = await fetch(url, { cache: "no-store", ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof body.error === "string" ? body.error : `API error: ${res.status}`);
  }
  return body as T;
}

export type SettlementAchApproval = {
  token: string;
  approvalType: "business_debit" | "nonprofit_payout";
  amount: number;
  status: "pending" | "approved" | "rejected";
  campaignName: string;
  organizationName: string;
  businessName: string | null;
  locationName: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
};

export function fetchSettlementAchApproval(token: string) {
  return fetchJson<{ approval: SettlementAchApproval }>(
    `/api/settlement-ach/${encodeURIComponent(token)}`,
  );
}

export function approveSettlementAch(
  token: string,
  body: { approvedByName: string; approvedByEmail: string },
) {
  return fetchJson<{ ok: boolean; approval: SettlementAchApproval }>(
    `/api/settlement-ach/${encodeURIComponent(token)}/approve`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}
