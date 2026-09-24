/**
 * Pass D2+ — detect website URL vs business name for the unified find field.
 *
 * Purpose: Route one input to either find-by-name or generate-business-draft,
 * while keeping the same 4-step confirm → giveback → email flow.
 *
 * Inputs: raw query string. Outputs: boolean / normalized URL helpers.
 */
export function looksLikeWebsiteQuery(raw: string): boolean {
  const q = raw.trim();
  if (!q) return false;
  if (/^https?:\/\//i.test(q)) return true;
  if (/\s/.test(q)) return false;
  // domain.tld or www.domain.tld (optional path)
  return /^(www\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z]{2,})+(\/.*)?$/i.test(q);
}

/** Ensure a website query has an https:// prefix. */
export function normalizeWebsiteQuery(raw: string): string {
  const q = raw.trim();
  if (!q) return "";
  return /^https?:\/\//i.test(q) ? q : `https://${q}`;
}

/**
 * Strip path/query from a business website so scrapes start at the homepage
 * (e.g. sovanabistro.com/menus/ → https://www.sovanabistro.com).
 * Prefer www — apex hosts often hang and delay the venue gallery for every business.
 */
export function websiteOriginUrl(raw: string): string {
  const withProto = normalizeWebsiteQuery(raw);
  if (!withProto) return "";
  try {
    const u = new URL(withProto);
    if (!/^www\./i.test(u.hostname) && !/^(localhost|127\.0\.0\.1)$/i.test(u.hostname)) {
      u.hostname = `www.${u.hostname}`;
    }
    return `${u.protocol}//${u.host}`;
  } catch {
    return withProto;
  }
}
