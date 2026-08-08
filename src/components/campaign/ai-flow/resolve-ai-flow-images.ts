/**
 * AI-flow image resolution — social media suggest first, then AI analysis images.
 *
 * Purpose: One shared priority for Purpose / Ideas / Preview so featured cover
 * and gallery stay consistent across the AI create funnel.
 *
 * Priority:
 *   1) POST /api/campaign-images/suggest — social first; website if social empty
 *   2) AI session analysis images (social-sourced first; website if still empty)
 *   3) Optional fallback URLs when still empty (idea thumbnail / library)
 *
 * Cover ranking (among collected URLs):
 *   facebook → instagram → website → other social → analysis → library
 *   Logo-like URLs (logo/icon/avatar/favicon…) are demoted within each tier.
 *
 * Inputs: social links + analysis images + optional fallbacks.
 * Outputs: { cover, images } ready for campaign context update.
 *
 * Changelog: Prefer true social OG images for cover; demote tall-logo URLs.
 * Fall back to website images when social scrape returns nothing.
 * Additive: pass linkedinUrl/youtubeUrl into suggest; preserve post captions.
 * Additive: when social post images exist, prefer them over idea thumbnail cover.
 * Additive: channel priority Instagram → Facebook → LinkedIn → YouTube → website.
 */
import type { CampaignImage } from "@/lib/campaign-context";
import { suggestCampaignImages } from "@/lib/api";

const DEFAULT_LIMIT = 6;
const SCRATCH_LIMIT = 10;

export type AiFlowAnalysisImage = {
  url: string;
  sourceUrl?: string | null;
  /** When present from analysis, preserves provider channel for ranking. */
  source?: string | null;
  caption?: string | null;
};

export type ResolveAiFlowImagesInput = {
  facebookUrl?: string | null;
  instagramHandle?: string | null;
  websiteUrl?: string | null;
  /** Additive: LinkedIn profile/company for post extraction. */
  linkedinUrl?: string | null;
  /** Additive: YouTube channel for recent video thumbnails. */
  youtubeUrl?: string | null;
  analysisImages?: AiFlowAnalysisImage[] | null;
  /** Used only when social + analysis produced nothing. */
  fallbackUrls?: Array<string | null | undefined>;
  limit?: number;
  /**
   * idea — keep this URL as the featured cover (chosen campaign card thumbnail).
   * scratch — ignore (scratch loads up to 10 social images).
   */
  preferredCoverUrl?: string | null;
  /**
   * idea — prefer analysis/idea images for gallery around the preferred cover.
   * scratch — scrape up to `limit` from social (website only if social empty).
   */
  mode?: "idea" | "scratch";
};

export type ResolveAiFlowImagesResult = {
  cover: CampaignImage | null;
  images: CampaignImage[];
};

function normalizeUrl(raw: string | null | undefined): string {
  return (raw ?? "").trim();
}

function dedupeKey(url: string): string {
  return url.split("?")[0].toLowerCase();
}

/** True when the URL path/query looks like a logo, icon, or avatar — poor campaign covers. */
export function looksLikeLogoUrl(url: string): boolean {
  return /logo|icon|favicon|avatar|profile[_-]?pic|wordmark|seal|badge|sprite|emoji/i.test(
    url,
  );
}

/**
 * Lower is better for featured cover.
 * Channel priority: Instagram → Facebook → LinkedIn → YouTube → website → library.
 * Logo-like URLs always rank last within that order.
 */
function coverRank(img: CampaignImage): number {
  const source = img.source ?? "";
  const ref = `${img.sourceUrl || ""} ${normalizeUrl(img.url) || normalizeUrl(img.storedUrl)}`;
  let base = 50;
  if (source === "instagram") base = 0;
  else if (source === "facebook") base = 10;
  else if (source === "social_suggest") {
    if (/linkedin\.com|licdn\.com/i.test(ref)) base = 20;
    else if (/youtube\.com|youtu\.be|ytimg\.com/i.test(ref)) base = 30;
    else base = 35;
  } else if (source === "website") base = 40;
  else if (source === "library") base = 45;
  else if (img.id.startsWith("ai-img-")) base = 48;

  const src = normalizeUrl(img.url) || normalizeUrl(img.storedUrl);
  // Heavy demotion so a FB logo never beats a real website/social photo.
  if (looksLikeLogoUrl(src)) base += 100;
  return base;
}

function sortForCover(images: CampaignImage[]): CampaignImage[] {
  return [...images].sort((a, b) => {
    const rankDiff = coverRank(a) - coverRank(b);
    if (rankDiff !== 0) return rankDiff;
    // Prefer wider-looking filenames lightly (cover/banner/hero vs square/profile).
    const aUrl = normalizeUrl(a.url) || normalizeUrl(a.storedUrl);
    const bUrl = normalizeUrl(b.url) || normalizeUrl(b.storedUrl);
    const aWide = /cover|banner|hero|og|landscape|wide/i.test(aUrl) ? 0 : 1;
    const bWide = /cover|banner|hero|og|landscape|wide/i.test(bUrl) ? 0 : 1;
    return aWide - bWide;
  });
}

/** Human label for cover source badge on Build / Preview. */
export function aiFlowCoverSourceLabel(cover: CampaignImage | null | undefined): string {
  if (!cover) return "Suggested";
  if (cover.id.startsWith("preferred-cover") || cover.name === "Campaign idea photo") {
    return "From campaign idea";
  }
  switch (cover.source) {
    case "facebook":
      return "From Facebook";
    case "instagram":
      return "From Instagram";
    case "website":
      return "From website";
    case "library":
      return "From library";
    case "manual":
      return "Uploaded";
    case "social_suggest": {
      const ref = `${cover.sourceUrl || ""} ${cover.url || cover.storedUrl || ""}`;
      if (/linkedin\.com/i.test(ref)) return "From LinkedIn";
      if (/youtube\.com|youtu\.be/i.test(ref)) return "From YouTube";
      return cover.id.startsWith("ai-img-") ? "From AI analysis" : "From social";
    }
    default:
      return cover.id.startsWith("ai-img-") ? "From AI analysis" : "Suggested";
  }
}

function mapAnalysisSource(
  raw: string | null | undefined,
): CampaignImage["source"] {
  const s = (raw ?? "").toLowerCase();
  if (s === "facebook") return "facebook";
  if (s === "instagram") return "instagram";
  if (s === "website") return "website";
  return "social_suggest";
}

/** Collect non-empty idea card thumbnail URLs (analysis session ideas). */
export function ideaThumbnailFallbackUrls(
  ideas: Array<{ thumbnailUrl?: string | null } | null | undefined> | null | undefined,
): string[] {
  if (!ideas?.length) return [];
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const idea of ideas) {
    const url = normalizeUrl(idea?.thumbnailUrl);
    if (!url) continue;
    const key = dedupeKey(url);
    if (seen.has(key)) continue;
    seen.add(key);
    urls.push(url);
  }
  return urls;
}

function isSocialPostSource(source: CampaignImage["source"] | undefined): boolean {
  return source === "facebook" || source === "instagram" || source === "social_suggest";
}

/**
 * Resolve cover + gallery with social-suggest-first priority and ranked cover pick.
 *
 * Modes:
 *   idea — preferredCoverUrl (idea card thumbnail) used only when no social posts.
 *   scratch — fetch up to 10 social images (website fallback only if social empty).
 */
export async function resolveAiFlowImages(
  input: ResolveAiFlowImagesInput,
): Promise<ResolveAiFlowImagesResult> {
  const mode = input.mode ?? "idea";
  const limit =
    input.limit && input.limit > 0
      ? input.limit
      : mode === "scratch"
        ? SCRATCH_LIMIT
        : DEFAULT_LIMIT;
  // Collect extra candidates so logo demotion still leaves a photo cover.
  const fetchLimit = Math.max(limit * 2, mode === "scratch" ? 20 : 8);
  const facebookUrl = normalizeUrl(input.facebookUrl);
  const instagramHandle = normalizeUrl(input.instagramHandle);
  const websiteUrl = normalizeUrl(input.websiteUrl);
  const linkedinUrl = normalizeUrl(input.linkedinUrl);
  const youtubeUrl = normalizeUrl(input.youtubeUrl);
  const preferredCoverUrl = normalizeUrl(input.preferredCoverUrl);

  const merged: CampaignImage[] = [];
  const seen = new Set<string>();

  const push = (img: CampaignImage) => {
    const src = normalizeUrl(img.url) || normalizeUrl(img.storedUrl);
    if (!src) return;
    const key = dedupeKey(src);
    if (seen.has(key)) return;
    if (merged.length >= fetchLimit) return;
    seen.add(key);
    merged.push(img);
  };

  if (preferredCoverUrl) {
    push({
      id: `preferred-cover-${Date.now()}`,
      url: preferredCoverUrl,
      name: "Campaign idea photo",
      storedUrl: preferredCoverUrl,
      source: "library",
    });
  }

  const hasSocial = Boolean(facebookUrl || instagramHandle || linkedinUrl || youtubeUrl);

  /**
   * Two-pass scrape:
   *  1) Social profiles / posts when links exist
   *  2) Website only if no social photos were collected
   */
  const pushSuggested = (
    suggested: Array<{
      url: string;
      source: string;
      sourceUrl?: string | null;
      caption?: string | null;
    }>,
  ) => {
    for (let i = 0; i < suggested.length; i++) {
      const s = suggested[i];
      push({
        id: `social-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
        url: s.url,
        name: `From ${s.source}`,
        storedUrl: s.url,
        source: s.source as CampaignImage["source"],
        sourceUrl: s.sourceUrl,
        ...(s.caption ? { caption: s.caption } : {}),
      });
    }
  };

  if (hasSocial) {
    try {
      const { images: socialOnly } = await suggestCampaignImages({
        facebookUrl,
        instagramHandle,
        websiteUrl: undefined,
        linkedinUrl: linkedinUrl || undefined,
        youtubeUrl: youtubeUrl || undefined,
        limit: fetchLimit,
      });
      pushSuggested(socialOnly);
    } catch {
      /* try website fallback below */
    }
  }

  const hasSocialPhotos = merged.some((m) => isSocialPostSource(m.source));

  // Website only when social found nothing (scratch + idea).
  if (websiteUrl && !hasSocialPhotos) {
    try {
      const { images: siteImages } = await suggestCampaignImages({
        websiteUrl,
        limit: fetchLimit,
      });
      pushSuggested(siteImages);
    } catch {
      /* fall through to analysis images */
    }
  }

  // Analysis images — prefer social-sourced; website analysis only if still empty.
  const analysis = input.analysisImages ?? [];
  const pushAnalysis = (allowWebsite: boolean) => {
    for (let i = 0; i < analysis.length; i++) {
      const img = analysis[i];
      const url = normalizeUrl(img.url);
      if (!url) continue;
      const mapped = mapAnalysisSource(img.source);
      if (!allowWebsite && mapped === "website") continue;
      // Scratch: once social photos exist, never mix website analysis into the set.
      if (mode === "scratch" && hasSocialPhotos && mapped === "website") continue;
      push({
        id: `ai-img-${i}`,
        url,
        name: `Suggested ${i + 1}`,
        source: mapped,
        ...(img.sourceUrl ? { sourceUrl: img.sourceUrl } : {}),
        ...(img.caption ? { caption: img.caption } : {}),
      });
    }
  };
  pushAnalysis(false);
  if (!hasSocialPhotos && (merged.length === 0 || (mode === "idea" && merged.length < 2))) {
    pushAnalysis(true);
  }

  if (merged.length === 0) {
    const fallbacks = input.fallbackUrls ?? [];
    for (let i = 0; i < fallbacks.length; i++) {
      const url = normalizeUrl(fallbacks[i]);
      if (!url) continue;
      push({
        id: `fallback-img-${i}`,
        url,
        name: "Suggested cover",
        storedUrl: url,
        source: "library",
      });
    }
  }

  if (merged.length === 0) {
    return { cover: null, images: [] };
  }

  const socialRanked = sortForCover(merged.filter((m) => isSocialPostSource(m.source)));
  const ranked = sortForCover(merged).slice(0, limit);

  // Prefer real social post photos over the idea-card thumbnail when available.
  if (socialRanked.length > 0) {
    const cover = socialRanked[0]!;
    const rest = ranked.filter((img) => img.id !== cover.id && img.url !== cover.url);
    // Keep preferred idea thumb in the gallery if it wasn't chosen as cover.
    if (preferredCoverUrl) {
      const preferredInRest = rest.some(
        (img) =>
          dedupeKey(normalizeUrl(img.url) || normalizeUrl(img.storedUrl)) ===
          dedupeKey(preferredCoverUrl),
      );
      if (!preferredInRest) {
        const preferred =
          merged.find(
            (img) =>
              dedupeKey(normalizeUrl(img.url) || normalizeUrl(img.storedUrl)) ===
              dedupeKey(preferredCoverUrl),
          ) || null;
        if (preferred && rest.length < Math.max(0, limit - 1)) {
          rest.push(preferred);
        }
      }
    }
    return { cover, images: rest.slice(0, Math.max(0, limit - 1)) };
  }

  if (preferredCoverUrl) {
    const preferred =
      ranked.find((img) => dedupeKey(normalizeUrl(img.url) || normalizeUrl(img.storedUrl)) === dedupeKey(preferredCoverUrl)) ||
      merged.find(
        (img) =>
          dedupeKey(normalizeUrl(img.url) || normalizeUrl(img.storedUrl)) ===
          dedupeKey(preferredCoverUrl),
      ) ||
      null;
    if (preferred) {
      const rest = ranked.filter((img) => img.id !== preferred.id && img.url !== preferred.url);
      return { cover: preferred, images: rest };
    }
  }

  const [cover, ...images] = ranked;
  return { cover, images };
}
