/**
 * NPO org profile snapshot — local cache for dashboard "View profile".
 * Mirrors business-venue-profile.ts (without hours / giveback).
 */
import { getAuthToken } from "@/lib/auth-storage";
import {
  saveNonprofitGallery,
  saveNonprofitLinks,
} from "@/lib/api-nonprofit-org-profile";

export type NonprofitOrgProfileSnapshot = {
  nonprofitId: number | null;
  organizationName: string;
  city: string;
  state: string;
  zip: string;
  about: string;
  coverUrl: string | null;
  photoUrls: string[];
  websiteUrl?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  linkedinUrl?: string | null;
  youtubeUrl?: string | null;
  tiktokUrl?: string | null;
  phone?: string | null;
  email?: string | null;
  causeCategory?: string | null;
  logoUrl?: string | null;
};

const storageKey = (nonprofitId: number) =>
  `forkup-nonprofit-org-profile:${nonprofitId}`;

export function formatNonprofitAddress(
  profile: Pick<NonprofitOrgProfileSnapshot, "city" | "state" | "zip">,
): string {
  const parts = [profile.city, profile.state, profile.zip]
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return "";
  if (profile.city && profile.state) {
    const zip = profile.zip.trim();
    return `${profile.city.trim()}, ${profile.state.trim()}${zip ? ` ${zip}` : ""}`;
  }
  return parts.join(", ");
}

export function saveNonprofitOrgProfileSnapshot(
  snapshot: NonprofitOrgProfileSnapshot,
) {
  if (typeof window === "undefined") return;
  const id = snapshot.nonprofitId;
  if (id == null || id <= 0) return;
  try {
    window.localStorage.setItem(storageKey(id), JSON.stringify(snapshot));
  } catch {
    /* ignore quota */
  }
}

export function loadNonprofitOrgProfileSnapshot(
  nonprofitId: number,
): NonprofitOrgProfileSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(nonprofitId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<NonprofitOrgProfileSnapshot>;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      nonprofitId,
      organizationName:
        typeof parsed.organizationName === "string"
          ? parsed.organizationName
          : "",
      city: typeof parsed.city === "string" ? parsed.city : "",
      state: typeof parsed.state === "string" ? parsed.state : "",
      zip: typeof parsed.zip === "string" ? parsed.zip : "",
      about: typeof parsed.about === "string" ? parsed.about : "",
      coverUrl:
        typeof parsed.coverUrl === "string" ? parsed.coverUrl : null,
      photoUrls: Array.isArray(parsed.photoUrls)
        ? parsed.photoUrls.filter(
            (u): u is string => typeof u === "string" && u.trim().length > 0,
          )
        : [],
      websiteUrl: parsed.websiteUrl ?? null,
      facebookUrl: parsed.facebookUrl ?? null,
      instagramUrl: parsed.instagramUrl ?? null,
      linkedinUrl: parsed.linkedinUrl ?? null,
      youtubeUrl: parsed.youtubeUrl ?? null,
      tiktokUrl: parsed.tiktokUrl ?? null,
      phone: parsed.phone ?? null,
      email: parsed.email ?? null,
      causeCategory: parsed.causeCategory ?? null,
      logoUrl: parsed.logoUrl ?? null,
    };
  } catch {
    return null;
  }
}

export function mergeNonprofitOrgProfilePatch(
  prev: NonprofitOrgProfileSnapshot,
  patch: Partial<NonprofitOrgProfileSnapshot>,
): NonprofitOrgProfileSnapshot {
  return {
    ...prev,
    ...patch,
    nonprofitId: patch.nonprofitId ?? prev.nonprofitId,
    photoUrls: patch.photoUrls ?? prev.photoUrls,
  };
}

/**
 * Persist hydrated join profile (links + gallery) to the server after claim/auth.
 * Best-effort — local snapshot is always written when id is valid.
 */
export async function persistNonprofitOrgProfileFromSnapshot(
  snapshot: NonprofitOrgProfileSnapshot,
): Promise<void> {
  const id = snapshot.nonprofitId;
  if (id == null || id <= 0) return;

  saveNonprofitOrgProfileSnapshot(snapshot);
  if (!getAuthToken()) return;

  try {
    await saveNonprofitLinks({
      nonprofitId: id,
      website: snapshot.websiteUrl ?? null,
      facebookUrl: snapshot.facebookUrl ?? null,
      instagramUrl: snapshot.instagramUrl ?? null,
      linkedinUrl: snapshot.linkedinUrl ?? null,
      tiktokUrl: snapshot.tiktokUrl ?? null,
      youtubeUrl: snapshot.youtubeUrl ?? null,
      phone: snapshot.phone ?? null,
      contactEmail: snapshot.email ?? null,
      about: snapshot.about || null,
      city: snapshot.city || null,
      state: snapshot.state || null,
      zip: snapshot.zip || null,
      organizationName: snapshot.organizationName || null,
    });
  } catch {
    /* best-effort */
  }

  const photos = (snapshot.photoUrls ?? [])
    .map((u) => u.trim())
    .filter(Boolean);
  const cover =
    snapshot.coverUrl?.trim() ||
    photos[0] ||
    snapshot.logoUrl?.trim() ||
    null;
  if (photos.length === 0 && !cover) return;

  try {
    await saveNonprofitGallery({
      nonprofitId: id,
      imageUrls: photos.length > 0 ? photos : cover ? [cover] : [],
      coverUrl: cover,
    });
  } catch {
    /* best-effort — View profile can live-refresh */
  }
}
