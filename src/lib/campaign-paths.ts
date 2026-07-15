/** Public campaign page path (trailing slash matches `next.config` trailingSlash). */
export function campaignPublicPath(slug: string): string {
  const s = slug.trim();
  if (!s) return "/";
  return `/campaign/${encodeURIComponent(s)}/`;
}

/** Absolute campaign URL in the browser (production static host). */
export function campaignPublicUrl(slug: string): string {
  const path = campaignPublicPath(slug);
  if (typeof window !== "undefined") {
    return `${window.location.origin}${path}`;
  }
  return path;
}
