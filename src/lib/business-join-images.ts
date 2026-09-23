/**
 * Pass D2 — pick clear cover photos (not logos / tiny blurry thumbs) for confirm card.
 * Mirrors server looksLikeLogoUrl heuristics; probes pixel size + aspect client-side.
 */
import { apiUrl } from "@/lib/api-config";

/**
 * Resy photos are returned as relative `/api/venue-photo-proxy?url=…`.
 * On Amplify that path hits the SPA host (broken); prefix the Nest API base.
 * Localhost leaves them relative so Next rewrites still work.
 */
export function resolveVenueImageSrc(url: string): string {
  const raw = (url || "").trim();
  if (!raw) return raw;
  if (raw.startsWith("/api/")) {
    return apiUrl(raw);
  }
  try {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "http://localhost";
    const parsed = new URL(raw, origin);
    if (parsed.pathname.replace(/\/+$/, "") === "/api/venue-photo-proxy") {
      return apiUrl(`${parsed.pathname}${parsed.search}`);
    }
  } catch {
    /* keep raw */
  }
  return raw;
}

/** True when URL looks like a brand mark / icon, not a venue photo. */
export function looksLikeLogoImageUrl(url: string): boolean {
  const raw = (url || "").trim();
  if (!raw) return false;
  if (/\.svg(\?|$)/i.test(raw)) return true;
  if (/static\.licdn\.com\/aero/i.test(raw)) return true;
  // Wordmark / brand PNGs often omit "logo" but live under brand asset paths.
  if (/\/(brand|mark|wordmark|identity)\//i.test(raw)) return true;
  return /logo|icon|favicon|avatar|profile[_-]?pic|wordmark|seal|badge|sprite|emoji|brand[_-]?mark|webclip|apple[_-]?touch|sitelogo|site-logo/i.test(
    raw,
  );
}

/**
 * True when URL is a site decoration / illustration (paper-cut strips, doodles,
 * single-ingredient icons) — not a real venue photo.
 */
export function looksLikeDecorativeImageUrl(url: string): boolean {
  const raw = (url || "").trim();
  if (!raw) return false;
  if (
    /paper[_-]?cut|cut[_-]?out|illustrat|doodle|clip[_-]?art|line[_-]?art|hand[_-]?drawn|decorati|ornament|sticker|scribble|silhouette|map[_-]?marker|unnamed|no[_-]?edge|sbox/i.test(
      raw,
    )
  ) {
    return true;
  }
  if (
    /\.png(\?|$)/i.test(raw) &&
    /(?:^|[\/_\-])(tomato|basil|onion|lettuce|corn|egg|blueberry|blueberries|carrot|garlic|lemon|avocado|pepper|wine|glass|goblet|utensil|cutlery|fork|knife|spoon|asparagus|jackelope|jackelop)(?:aj|[_\-.]|$)/i.test(
      raw,
    )
  ) {
    return true;
  }
  // Menu-page ornament filenames (Sovana BentoBox, etc.).
  if (
    /\.png(\?|$)/i.test(raw) &&
    /leaf[_-]?lettuce|egg[_-]?brunch|wine[_-]?glass|asparagus[_-]?group|bwjackelope|menu\.png/i.test(
      raw,
    )
  ) {
    return true;
  }
  return false;
}

/** True when URL hints at a tiny / thumb / low-res asset that blurs when scaled. */
export function looksLikeLowQualityImageUrl(url: string): boolean {
  const raw = (url || "").trim();
  if (!raw) return true;
  // Booking CDN photos use path sizes like /16:9/1600 — not low-res thumbs.
  if (/image\.resy\.com|images\.resy\.com/i.test(raw)) return false;
  return /thumb|thumbnail|tiny|small|blur|low[_-]?res|w=\d{1,2}(?:\D|$)|h=\d{1,2}(?:\D|$)|_\d{2,3}x\d{2,3}\b|\/\d{2,3}x\d{2,3}\//i.test(
    raw,
  );
}

type ImageProbe = {
  url: string;
  width: number;
  height: number;
  /** Wide banner / wordmark / icon — use as logo, never as cover. */
  looksLikeLogo: boolean;
  /** Large enough landscape/portrait photo for a cover gallery. */
  looksLikePhoto: boolean;
};

function loadImageSize(url: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(null);
      return;
    }
    const img = new window.Image();
    let settled = false;
    const finish = (value: { width: number; height: number } | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(value);
    };
    // Resy / CDN hotlinks can hang without onerror — never block the gallery.
    const timer = window.setTimeout(() => finish(null), 4_000);
    img.onload = () => {
      finish({
        width: img.naturalWidth || 0,
        height: img.naturalHeight || 0,
      });
    };
    img.onerror = () => finish(null);
    img.src = url;
  });
}

/** Booking-CDN venue photos (Resy) — never require a pixel probe. */
export function isResyVenuePhotoUrl(url: string): boolean {
  const raw = (url || "").trim();
  if (/image\.resy\.com|images\.resy\.com/i.test(raw)) return true;
  // Proxied Resy URLs from /api/venue-photo-proxy?url=https%3A%2F%2Fimage.resy.com%2F...
  if (/\/api\/venue-photo-proxy\?/i.test(raw) && /image\.resy\.com/i.test(decodeURIComponent(raw))) {
    return true;
  }
  return false;
}

function isBookingCdnPhotoUrl(url: string): boolean {
  return isResyVenuePhotoUrl(url);
}

/**
 * Classify one image by URL hints + pixel aspect.
 * Wordmark banners (very wide) are logos even when the URL has no "logo".
 * When the image fails to load, keep a URL-based guess so gallery photos are not dropped.
 */
export async function probeBusinessImage(url: string): Promise<ImageProbe | null> {
  const u = (url || "").trim();
  if (!u) return null;
  if (looksLikeDecorativeImageUrl(u)) return null;
  // Resy gallery URLs are real venue photos; skip probe (CDN can hang/block hotlink).
  if (isBookingCdnPhotoUrl(u)) {
    return {
      url: u,
      width: 1600,
      height: 900,
      looksLikeLogo: false,
      looksLikePhoto: true,
    };
  }
  const urlSaysLogo = looksLikeLogoImageUrl(u);
  const size = await loadImageSize(u);
  if (!size || size.width < 2 || size.height < 2) {
    // Network / hotlink failure — still allow non-logo JPG/WEBP into the gallery.
    if (urlSaysLogo || looksLikeLowQualityImageUrl(u)) return null;
    if (/\.(jpe?g|webp)(\?|$)/i.test(u)) {
      return {
        url: u,
        width: 800,
        height: 600,
        looksLikeLogo: false,
        looksLikePhoto: true,
      };
    }
    return null;
  }
  const { width, height } = size;
  const aspect = width / height;
  const pixels = width * height;
  // Ultra-wide wordmarks or ultra-tall strips → logo, not cover.
  const bannerLike = aspect >= 2.35 || aspect <= 0.42;
  const iconLike = pixels < 60_000 && aspect >= 0.8 && aspect <= 1.25;
  const looksLikeLogo = urlSaysLogo || bannerLike || iconLike;
  const looksLikePhoto =
    !looksLikeLogo &&
    !looksLikeLowQualityImageUrl(u) &&
    width >= 240 &&
    height >= 180 &&
    pixels >= 60_000 &&
    aspect >= 0.5 &&
    aspect <= 2.2;
  return { url: u, width, height, looksLikeLogo, looksLikePhoto };
}

/**
 * Load image and require a minimum resolution so cover stays sharp.
 * Inputs: url, min width/height. Outputs: true when large enough.
 */
export function probeImageIsSharpEnough(
  url: string,
  minWidth = 280,
  minHeight = 200,
): Promise<boolean> {
  return probeBusinessImage(url).then((p) =>
    Boolean(p && p.width >= minWidth && p.height >= minHeight && p.width * p.height >= 80_000),
  );
}

/**
 * Filter scraped URLs down to cover-worthy photos (exclude logo + low-quality hints).
 * Pixel sharpness is applied separately via probeImageIsSharpEnough / classifyBusinessImages.
 */
export function photoCoverCandidates(
  imageUrls: string[],
  logoUrl: string | null | undefined,
): string[] {
  const logo = (logoUrl || "").trim();
  return imageUrls.filter((url) => {
    const u = (url || "").trim();
    if (!u) return false;
    if (logo && u === logo) return false;
    if (looksLikeLogoImageUrl(u)) return false;
    if (looksLikeDecorativeImageUrl(u)) return false;
    if (looksLikeLowQualityImageUrl(u)) return false;
    return true;
  });
}

export type ClassifiedBusinessImages = {
  logoUrl: string | null;
  photoUrls: string[];
};

/**
 * Sync gallery list from Find API imageUrls — Resy CDN first, then JPG/WEBP.
 * Use this for immediate UI (no Image probe) so session drafts show Resy photos.
 */
export function venueGalleryPhotoUrls(imageUrls: string[]): string[] {
  const unique = [...new Set(imageUrls.map((u) => (u || "").trim()).filter(Boolean))];
  const booking = unique.filter(
    (u) => isBookingCdnPhotoUrl(u) && !looksLikeDecorativeImageUrl(u),
  );
  const jpgs = unique.filter(
    (u) =>
      !isBookingCdnPhotoUrl(u) &&
      !looksLikeLogoImageUrl(u) &&
      !looksLikeDecorativeImageUrl(u) &&
      /\.(jpe?g|webp)(\?|$)/i.test(u) &&
      !looksLikeLowQualityImageUrl(u),
  );
  return [...booking, ...jpgs].slice(0, 16);
}

/** Count Resy (direct or proxied) gallery URLs. */
export function countResyGalleryPhotos(imageUrls: string[]): number {
  return imageUrls.filter((u) => isBookingCdnPhotoUrl(u)).length;
}

/**
 * Split scraped images into one logo mark + cover photos.
 * Never puts a wordmark/banner into photoUrls (fixes logo-as-cover).
 */
export async function classifyBusinessImages(
  imageUrls: string[],
  preferredLogoUrl?: string | null,
): Promise<ClassifiedBusinessImages> {
  const unique = [...new Set(imageUrls.map((u) => (u || "").trim()).filter(Boolean))];
  // Always keep Resy carousel URLs first — do not depend on Image() probe.
  const bookingPhotos = unique.filter(
    (u) => isBookingCdnPhotoUrl(u) && !looksLikeDecorativeImageUrl(u),
  );
  const rest = unique.filter((u) => !isBookingCdnPhotoUrl(u));

  const probes: ImageProbe[] = [];
  for (const url of rest) {
    const probe = await probeBusinessImage(url);
    if (probe) probes.push(probe);
  }

  const preferred = (preferredLogoUrl || "").trim();
  const preferredProbe = preferred
    ? probes.find((p) => p.url === preferred) ?? null
    : null;

  const logoCandidates = probes.filter((p) => p.looksLikeLogo);
  const photoUrls = [
    ...bookingPhotos,
    ...probes.filter((p) => p.looksLikePhoto).map((p) => p.url),
  ];

  let logoUrl: string | null = null;
  if (preferredProbe?.looksLikeLogo) {
    logoUrl = preferredProbe.url;
  } else if (logoCandidates.length > 0) {
    // Prefer URL that literally says logo, then widest banner (wordmarks).
    logoCandidates.sort((a, b) => {
      const aHint = looksLikeLogoImageUrl(a.url) ? 0 : 1;
      const bHint = looksLikeLogoImageUrl(b.url) ? 0 : 1;
      if (aHint !== bHint) return aHint - bHint;
      return b.width / b.height - a.width / a.height;
    });
    logoUrl = logoCandidates[0]!.url;
  } else if (preferredProbe && !preferredProbe.looksLikePhoto) {
    logoUrl = preferredProbe.url;
  }

  // Never list the logo URL as a gallery/cover photo.
  let photos = photoUrls.filter((u) => u !== logoUrl);
  // If classification found no photos but URLs remain, keep non-logo JPGs / Resy.
  if (photos.length === 0) {
    photos = unique.filter(
      (u) =>
        u !== logoUrl &&
        !looksLikeLogoImageUrl(u) &&
        !looksLikeDecorativeImageUrl(u) &&
        (/\.(jpe?g|webp)(\?|$)/i.test(u) || isBookingCdnPhotoUrl(u)) &&
        !looksLikeLowQualityImageUrl(u),
    );
  }
  // Drop decorative / site-ornament PNGs; keep Resy CDN + real JPG/WEBP photos.
  photos = photos.filter(
    (u) =>
      !looksLikeDecorativeImageUrl(u) &&
      (isBookingCdnPhotoUrl(u) || /\.(jpe?g|webp)(\?|$)/i.test(u)),
  );
  // Dedupe while keeping Resy-first order.
  photos = [...new Set(photos)];
  return { logoUrl, photoUrls: photos.slice(0, 16) };
}
