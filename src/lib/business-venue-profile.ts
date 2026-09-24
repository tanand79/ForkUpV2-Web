/**
 * Venue profile shown after "Yes, that's us" and from the business dashboard.
 * Saved in localStorage so the dashboard can reopen the same screen on this device.
 */

export const VENUE_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export type VenueDay = (typeof VENUE_DAYS)[number];
export type VenueDiscountHours = Record<VenueDay, string>;

export type VenueProfileSnapshot = {
  businessId: number | null;
  businessName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  about: string;
  coverUrl: string | null;
  photoUrls: string[];
  hours: VenueDiscountHours;
  eligibleWindow: string;
  givebackPercent: number;
  causeName: string | null;
  isRestaurant: boolean;
  /** Additive: public site + social URLs for Lovable-style icon row. */
  websiteUrl?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  linkedinUrl?: string | null;
  youtubeUrl?: string | null;
  tiktokUrl?: string | null;
  /** Additive: public contact from site scrape / businesses row. */
  phone?: string | null;
  email?: string | null;
};

const storageKey = (businessId: number) => `forkup-venue-profile:${businessId}`;

/** Closed / unknown day marker used in the Discount Eligible table. */
export function defaultVenueHours(): VenueDiscountHours {
  return {
    Monday: "-",
    Tuesday: "-",
    Wednesday: "-",
    Thursday: "-",
    Friday: "-",
    Saturday: "-",
    Sunday: "-",
  };
}

/** Keep only known weekdays; blank values become "-". */
export function normalizeVenueHours(value: unknown): VenueDiscountHours {
  const hours = defaultVenueHours();
  if (!value || typeof value !== "object") return hours;
  for (const day of VENUE_DAYS) {
    const raw = (value as Record<string, unknown>)[day];
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    hours[day] = trimmed || "-";
  }
  return hours;
}

export function isOpenVenueDay(value: string): boolean {
  const trimmed = value.trim();
  return Boolean(trimmed) && trimmed !== "-" && trimmed !== "—";
}

/** Split a day label into meal periods for the Lovable eligibility table. */
export function periodsFromHourLabel(value: string): string[] {
  if (!isOpenVenueDay(value)) return [];
  const parts = value
    .split(/\s*(?:·|;|,|\/| and )\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [value.trim()];
}

/** Week rows for Eligible days & meal periods. */
export function eligibilityRowsFromHours(
  hours: VenueDiscountHours,
): { day: VenueDay; periods: string[] }[] {
  return VENUE_DAYS.map((day) => ({
    day,
    periods: periodsFromHourLabel(hours[day]),
  }));
}

/** "Eligible on Tuesday, Wednesday and Thursday" from open days. */
export function eligibleDaysLabel(hours: VenueDiscountHours): string {
  const open = VENUE_DAYS.filter((day) => isOpenVenueDay(hours[day]));
  if (open.length === 0) return "";
  if (open.length === 1) return `Eligible on ${open[0]}`;
  const last = open[open.length - 1];
  return `Eligible on ${open.slice(0, -1).join(", ")} and ${last}`;
}

export function formatVenueAddress(parts: {
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
}): string {
  const street = parts.address?.trim() || "";
  const city = parts.city?.trim() || "";
  const state = parts.state?.trim() || "";
  const zip = parts.zip?.trim() || "";
  const cityState = [city, state].filter(Boolean).join(", ");
  const region = [cityState, zip].filter(Boolean).join(" ");
  return [street, region].filter(Boolean).join(", ");
}

function snapshotKey(id: number | null): string | null {
  if (id == null || !Number.isFinite(id)) return null;
  return storageKey(id);
}

/** Persist the venue screen for the business dashboard on this device. */
export function saveVenueProfileSnapshot(snapshot: VenueProfileSnapshot) {
  if (typeof window === "undefined") return;
  const key = snapshotKey(snapshot.businessId);
  if (!key) return;
  try {
    const next: VenueProfileSnapshot = {
      ...snapshot,
      hours: normalizeVenueHours(snapshot.hours),
      givebackPercent: Number.isFinite(snapshot.givebackPercent)
        ? snapshot.givebackPercent
        : 15,
    };
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
}

/** Build the venue screen from the join draft (before or after claim). */
export function venueSnapshotFromJoin(input: {
  found: {
    businessName: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    about: string;
    website?: string;
    facebookUrl?: string | null;
    instagramUrl?: string | null;
    linkedinUrl?: string | null;
    youtubeUrl?: string | null;
    tiktokUrl?: string | null;
    phone?: string | null;
    contactEmail?: string | null;
  };
  hours: VenueDiscountHours;
  eligibleWindow: string;
  coverUrl: string | null;
  photoUrls: string[];
  givebackPercent: number;
  causeName: string | null;
  isRestaurant: boolean;
  businessId: number | null;
}): VenueProfileSnapshot {
  return {
    businessId: input.businessId,
    businessName: input.found.businessName?.trim() || "Your business",
    address: input.found.address || "",
    city: input.found.city || "",
    state: input.found.state || "",
    zip: input.found.zip || "",
    about: input.found.about || "",
    coverUrl: input.coverUrl,
    photoUrls: input.photoUrls,
    hours: normalizeVenueHours(input.hours),
    eligibleWindow: input.eligibleWindow || "",
    givebackPercent: Number.isFinite(input.givebackPercent) ? input.givebackPercent : 15,
    causeName: input.causeName,
    isRestaurant: input.isRestaurant,
    websiteUrl: input.found.website?.trim() || null,
    facebookUrl: input.found.facebookUrl?.trim() || null,
    instagramUrl: input.found.instagramUrl?.trim() || null,
    linkedinUrl: input.found.linkedinUrl?.trim() || null,
    youtubeUrl: input.found.youtubeUrl?.trim() || null,
    tiktokUrl: input.found.tiktokUrl?.trim() || null,
    phone: input.found.phone?.trim() || null,
    email: input.found.contactEmail?.trim() || null,
  };
}

/**
 * Dashboard fallback when this device has no saved venue screen yet.
 * Name and location come from the signed-in business profile.
 */
export function venueFromDashboardBusiness(biz: {
  id: number;
  businessName: string;
  locationName: string;
  dineAndDonate: boolean;
}): VenueProfileSnapshot {
  return {
    businessId: biz.id,
    businessName: biz.businessName,
    address:
      biz.locationName.trim() && biz.locationName.trim() !== biz.businessName.trim()
        ? biz.locationName.trim()
        : "",
    city: "",
    state: "",
    zip: "",
    about: "",
    coverUrl: null,
    photoUrls: [],
    hours: defaultVenueHours(),
    eligibleWindow: "",
    givebackPercent: 15,
    causeName: null,
    isRestaurant: biz.dineAndDonate,
  };
}

/** Load a previously saved venue screen. Null when this device has none. */
export function loadVenueProfileSnapshot(businessId: number): VenueProfileSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(businessId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<VenueProfileSnapshot>;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.businessName !== "string" || !parsed.businessName.trim()) return null;
    return {
      businessId,
      businessName: parsed.businessName,
      address: typeof parsed.address === "string" ? parsed.address : "",
      city: typeof parsed.city === "string" ? parsed.city : "",
      state: typeof parsed.state === "string" ? parsed.state : "",
      zip: typeof parsed.zip === "string" ? parsed.zip : "",
      about: typeof parsed.about === "string" ? parsed.about : "",
      coverUrl: typeof parsed.coverUrl === "string" ? parsed.coverUrl : null,
      photoUrls: Array.isArray(parsed.photoUrls)
        ? parsed.photoUrls.filter((url): url is string => typeof url === "string")
        : [],
      hours: normalizeVenueHours(parsed.hours),
      eligibleWindow: typeof parsed.eligibleWindow === "string" ? parsed.eligibleWindow : "",
      givebackPercent: Number.isFinite(Number(parsed.givebackPercent))
        ? Number(parsed.givebackPercent)
        : 15,
      causeName: typeof parsed.causeName === "string" ? parsed.causeName : null,
      isRestaurant: parsed.isRestaurant !== false,
      websiteUrl: typeof parsed.websiteUrl === "string" ? parsed.websiteUrl : null,
      facebookUrl: typeof parsed.facebookUrl === "string" ? parsed.facebookUrl : null,
      instagramUrl: typeof parsed.instagramUrl === "string" ? parsed.instagramUrl : null,
      linkedinUrl: typeof parsed.linkedinUrl === "string" ? parsed.linkedinUrl : null,
      youtubeUrl: typeof parsed.youtubeUrl === "string" ? parsed.youtubeUrl : null,
      tiktokUrl: typeof parsed.tiktokUrl === "string" ? parsed.tiktokUrl : null,
      phone: typeof parsed.phone === "string" ? parsed.phone : null,
      email: typeof parsed.email === "string" ? parsed.email : null,
    };
  } catch {
    return null;
  }
}

const photoCacheKey = (businessId: number) => `forkup-venue-photos:${businessId}`;

/** Session-cached gallery URLs so profile opens skip a full re-scrape. */
export function loadCachedVenuePhotos(businessId: number): string[] | null {
  if (typeof window === "undefined") return null;
  if (!Number.isFinite(businessId)) return null;
  try {
    const raw = window.sessionStorage.getItem(photoCacheKey(businessId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const urls = parsed.filter(
      (u): u is string => typeof u === "string" && u.trim().length > 0,
    );
    return urls.length > 0 ? urls : null;
  } catch {
    return null;
  }
}

export function saveCachedVenuePhotos(businessId: number, urls: string[]) {
  if (typeof window === "undefined" || urls.length === 0) return;
  if (!Number.isFinite(businessId)) return;
  try {
    window.sessionStorage.setItem(photoCacheKey(businessId), JSON.stringify(urls));
  } catch {
    /* ignore quota */
  }
}

const contactTriedKey = (businessId: number) =>
  `forkup-venue-contact-tried:${businessId}`;

/** One contact scrape attempt per tab session — sites without email must not re-find forever. */
export function loadContactLookupTried(businessId: number): boolean {
  if (typeof window === "undefined" || !Number.isFinite(businessId)) return false;
  try {
    return window.sessionStorage.getItem(contactTriedKey(businessId)) === "1";
  } catch {
    return false;
  }
}

export function markContactLookupTried(businessId: number) {
  if (typeof window === "undefined" || !Number.isFinite(businessId)) return;
  try {
    window.sessionStorage.setItem(contactTriedKey(businessId), "1");
  } catch {
    /* ignore */
  }
}

/** Keep existing non-empty string; only fill from next when current is blank. */
export function keepFilled(
  current: string | null | undefined,
  next: string | null | undefined,
): string {
  const cur = typeof current === "string" ? current.trim() : "";
  if (cur) return cur;
  const n = typeof next === "string" ? next.trim() : "";
  return n;
}

/** Prefer the longer photo list so a sparse find does not wipe a good gallery. */
export function preferRicherPhotos(
  current: string[] | null | undefined,
  next: string[] | null | undefined,
): string[] {
  const a = Array.isArray(current) ? current.filter((u) => typeof u === "string" && u.trim()) : [];
  const b = Array.isArray(next) ? next.filter((u) => typeof u === "string" && u.trim()) : [];
  if (b.length > a.length) return b;
  if (a.length > 0) return a;
  return b;
}

/**
 * Merge hydrate/find fields into an existing venue snapshot without clearing
 * values that were already present (SafetyNet append-only for profile data).
 */
export function mergeVenueSnapshotKeepExisting(
  prev: VenueProfileSnapshot,
  patch: Partial<VenueProfileSnapshot>,
): VenueProfileSnapshot {
  return {
    ...prev,
    businessId: patch.businessId ?? prev.businessId,
    businessName: keepFilled(prev.businessName, patch.businessName) || prev.businessName,
    address: keepFilled(prev.address, patch.address),
    city: keepFilled(prev.city, patch.city),
    state: keepFilled(prev.state, patch.state),
    zip: keepFilled(prev.zip, patch.zip),
    about: keepFilled(prev.about, patch.about),
    coverUrl:
      (typeof patch.coverUrl === "string" && patch.coverUrl.trim()
        ? patch.coverUrl.trim()
        : null) ||
      prev.coverUrl ||
      null,
    photoUrls: preferRicherPhotos(prev.photoUrls, patch.photoUrls),
    hours:
      patch.hours && Object.values(patch.hours).some((v) => isOpenVenueDay(v))
        ? normalizeVenueHours(patch.hours)
        : prev.hours,
    eligibleWindow: keepFilled(prev.eligibleWindow, patch.eligibleWindow),
    givebackPercent:
      patch.givebackPercent != null && Number.isFinite(patch.givebackPercent)
        ? patch.givebackPercent
        : prev.givebackPercent,
    causeName: keepFilled(prev.causeName, patch.causeName) || prev.causeName,
    isRestaurant:
      patch.isRestaurant !== undefined ? patch.isRestaurant : prev.isRestaurant,
    websiteUrl: keepFilled(prev.websiteUrl, patch.websiteUrl) || null,
    facebookUrl: keepFilled(prev.facebookUrl, patch.facebookUrl) || null,
    instagramUrl: keepFilled(prev.instagramUrl, patch.instagramUrl) || null,
    linkedinUrl: keepFilled(prev.linkedinUrl, patch.linkedinUrl) || null,
    youtubeUrl: keepFilled(prev.youtubeUrl, patch.youtubeUrl) || null,
    tiktokUrl: keepFilled(prev.tiktokUrl, patch.tiktokUrl) || null,
    phone: keepFilled(prev.phone, patch.phone) || null,
    email: keepFilled(prev.email, patch.email) || null,
  };
}
