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
    };
  } catch {
    return null;
  }
}
