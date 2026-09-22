/**
 * Pass D2 — pick clear cover photos (not logos / tiny blurry thumbs) for confirm card.
 * Mirrors server looksLikeLogoUrl heuristics; probes pixel size client-side.
 */

/** True when URL looks like a brand mark / icon, not a venue photo. */
export function looksLikeLogoImageUrl(url: string): boolean {
  const raw = (url || "").trim();
  if (!raw) return false;
  if (/\.svg(\?|$)/i.test(raw)) return true;
  if (/static\.licdn\.com\/aero/i.test(raw)) return true;
  return /logo|icon|favicon|avatar|profile[_-]?pic|wordmark|seal|badge|sprite|emoji|brand[_-]?mark|webclip|apple[_-]?touch/i.test(
    raw,
  );
}

/** True when URL hints at a tiny / thumb / low-res asset that blurs when scaled. */
export function looksLikeLowQualityImageUrl(url: string): boolean {
  const raw = (url || "").trim();
  if (!raw) return true;
  return /thumb|thumbnail|tiny|small|blur|low[_-]?res|w=\d{1,2}(?:\D|$)|h=\d{1,2}(?:\D|$)|_\d{2,3}x\d{2,3}\b|\/\d{2,3}x\d{2,3}\//i.test(
    raw,
  );
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
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }
    const img = new window.Image();
    img.onload = () => {
      const w = img.naturalWidth || 0;
      const h = img.naturalHeight || 0;
      resolve(w >= minWidth && h >= minHeight && w * h >= 80_000);
    };
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

/**
 * Filter scraped URLs down to cover-worthy photos (exclude logo + low-quality hints).
 * Pixel sharpness is applied separately via probeImageIsSharpEnough.
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
    if (looksLikeLowQualityImageUrl(u)) return false;
    return true;
  });
}
