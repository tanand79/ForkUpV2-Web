/** Query-string href for supporter receipt upload, carrying visit context when known. */

export interface ReceiptUploadPrefill {
  campaignSlug: string;
  businessId?: number;
  locationId?: number;
  methodId?: number;
  firstName?: string;
  email?: string;
}

export function buildReceiptUploadHref(opts: ReceiptUploadPrefill): string {
  const q = new URLSearchParams();
  q.set("step", "receipt-upload");
  q.set("campaign", opts.campaignSlug);
  if (opts.businessId != null) q.set("businessId", String(opts.businessId));
  if (opts.locationId != null) q.set("locationId", String(opts.locationId));
  if (opts.methodId != null) q.set("methodId", String(opts.methodId));
  const firstName = opts.firstName?.trim();
  const email = opts.email?.trim();
  if (firstName) q.set("firstName", firstName);
  if (email) q.set("email", email);
  return `/?${q.toString()}`;
}

export function readReceiptUploadPrefillFromSearch(
  search: string,
): Omit<ReceiptUploadPrefill, "campaignSlug"> & { campaignSlug: string | null } {
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const num = (key: string) => {
    const raw = q.get(key);
    if (!raw) return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  };
  return {
    campaignSlug: q.get("campaign"),
    businessId: num("businessId"),
    locationId: num("locationId"),
    methodId: num("methodId"),
    firstName: q.get("firstName")?.trim() || undefined,
    email: q.get("email")?.trim() || undefined,
  };
}

const PARTICIPANT_STORAGE_KEY = "forkup_participant";

export function readStoredParticipant(): { firstName?: string; email?: string } {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(PARTICIPANT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { firstName?: unknown; email?: unknown };
    return {
      firstName: typeof parsed.firstName === "string" ? parsed.firstName.trim() : undefined,
      email: typeof parsed.email === "string" ? parsed.email.trim() : undefined,
    };
  } catch {
    return {};
  }
}
