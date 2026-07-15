/**
 * API base URL for browser and build-time requests.
 *
 * Local dev (localhost):
 *   - Uses relative /api paths → Next.js rewrites proxy to http://localhost:3001
 *   - Ignores runtime-config.js and production env vars
 *
 * Production (static deploy):
 *   1. window.__FORKUP__.apiUrl from /runtime-config.js (edit on server, no rebuild)
 *   2. NEXT_PUBLIC_API_URL baked in at build time
 */
declare global {
  interface Window {
    __FORKUP__?: {
      apiUrl?: string;
    };
  }
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Fallback when runtime-config.js or build env were not set on a known production host. */
const PRODUCTION_API_BY_HOST: Record<string, string> = {
  "powderblue-alligator-791855.hostingersite.com":
    "https://lightslategrey-alligator-326327.hostingersite.com",
};

/** True when the app is running on a local dev machine in the browser. */
export function isLocalBrowser(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

export function getApiBaseUrl(): string {
  // Local dev always uses same-origin /api proxy — never call production.
  if (isLocalBrowser()) {
    return "";
  }

  if (typeof window !== "undefined") {
    const runtime = window.__FORKUP__?.apiUrl?.trim();
    if (runtime) return normalizeBaseUrl(runtime);

    const host = window.location.hostname;
    const mapped = PRODUCTION_API_BY_HOST[host];
    if (mapped) return normalizeBaseUrl(mapped);
  }

  const built = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (built) return normalizeBaseUrl(built);

  return "";
}

export function apiUrl(path: string): string {
  const base = getApiBaseUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}
