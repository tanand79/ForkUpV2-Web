/**
 * AI-flow image resolution — social media suggest first, then AI analysis images.
 *
 * Purpose: One shared priority for Purpose / Ideas / Preview so featured cover
 * and gallery stay consistent across the AI create funnel.
 *
 * Priority:
 *   1) POST /api/campaign-images/suggest (Facebook / Instagram / website)
 *   2) AI session analysis images
 *   3) Optional fallback URLs (idea thumbnail, library suggested image)
 *
 * Cover ranking (among collected URLs):
 *   facebook → instagram → website → other social → analysis → library
 *   Logo-like URLs (logo/icon/avatar/favicon…) are demoted within each tier.
 *
 * Inputs: social links + analysis images + optional fallbacks.
 * Outputs: { cover, images } ready for campaign context update.
 *
 * Changelog: Prefer true social OG images for cover; demote tall-logo URLs.
 */
import type { CampaignImage } from "@/lib/campaign-context";
import { suggestCampaignImages } from "@/lib/api";

const DEFAULT_LIMIT = 6;

export type AiFlowAnalysisImage = {
  url: string;
  sourceUrl?: string | null;
  /** When present from analysis, preserves provider channel for ranking. */
  source?: string | null;
};

export type ResolveAiFlowImagesInput = {
  facebookUrl?: string | null;
  instagramHandle?: string | null;
  websiteUrl?: string | null;
  analysisImages?: AiFlowAnalysisImage[] | null;
  /** Used only when social + analysis produced nothing. */
  fallbackUrls?: Array<string | null | undefined>;
  limit?: number;
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
 * Real social channels beat analysis/library; logo-like URLs always rank last.
 */
function coverRank(img: CampaignImage): number {
  const source = img.source ?? "";
  let base = 50;
  if (source === "facebook") base = 0;
  else if (source === "instagram") base = 10;
  else if (source === "website") base = 20;
  else if (source === "social_suggest") base = 30;
  else if (source === "library") base = 40;
  else if (img.id.startsWith("ai-img-")) base = 45;

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
    case "social_suggest":
      return cover.id.startsWith("ai-img-") ? "From AI analysis" : "From social";
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

/**
 * Resolve cover + gallery with social-suggest-first priority and ranked cover pick.
 */
export async function resolveAiFlowImages(
  input: ResolveAiFlowImagesInput,
): Promise<ResolveAiFlowImagesResult> {
  const limit = input.limit && input.limit > 0 ? input.limit : DEFAULT_LIMIT;
  // Collect extra candidates so logo demotion still leaves a photo cover.
  const fetchLimit = Math.max(limit * 2, 8);
  const facebookUrl = normalizeUrl(input.facebookUrl);
  const instagramHandle = normalizeUrl(input.instagramHandle);
  const websiteUrl = normalizeUrl(input.websiteUrl);

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

  // 1) Social media suggest first (live OG scrape)
  if (facebookUrl || instagramHandle || websiteUrl) {
    try {
      const { images: suggested } = await suggestCampaignImages({
        facebookUrl,
        instagramHandle,
        websiteUrl,
        limit: fetchLimit,
      });
      for (let i = 0; i < suggested.length; i++) {
        const s = suggested[i];
        push({
          id: `social-${Date.now()}-${i}`,
          url: s.url,
          name: `From ${s.source}`,
          storedUrl: s.url,
          source: s.source,
          sourceUrl: s.sourceUrl,
        });
      }
    } catch {
      /* fall through to analysis images */
    }
  }

  // 2) AI session analysis images next (never displace real social slots above)
  const analysis = input.analysisImages ?? [];
  for (let i = 0; i < analysis.length; i++) {
    const img = analysis[i];
    const url = normalizeUrl(img.url);
    if (!url) continue;
    push({
      id: `ai-img-${i}`,
      url,
      name: `Suggested ${i + 1}`,
      source: mapAnalysisSource(img.source),
      ...(img.sourceUrl ? { sourceUrl: img.sourceUrl } : {}),
    });
  }

  // 3) Last-resort fallbacks (idea thumbnail / library URL)
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

  if (merged.length === 0) {
    return { cover: null, images: [] };
  }

  const ranked = sortForCover(merged).slice(0, limit);
  const [cover, ...images] = ranked;
  return { cover, images };
}
