/**
 * API base URL for browser and build-time requests.
 *
 * Local dev (localhost):
 *   - Uses relative /api paths → Next.js rewrites proxy to http://localhost:3001
 *   - Ignores runtime-config.js and production env vars
 *
 * Production (static deploy on Amplify HTTPS):
 *   1. NEXT_PUBLIC_API_URL baked in at build time (Amplify / .env.production)
 *   2. Optional window.__FORKUP__.apiUrl from /runtime-config.js (post-deploy override)
 *   3. If the page is HTTPS and the API URL is HTTP, falls back to same-origin
 *      `/api` to avoid mixed content — Amplify must reverse-proxy those paths
 *      to EC2 (see amplify-rewrites.json).
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

function isLoopbackApiUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  } catch {
    return false;
  }
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

/**
 * Browsers block HTTPS pages calling HTTP APIs (mixed content).
 * When that would happen, use same-origin `/api` and let Amplify
 * reverse-proxy to the EC2 HTTP backend (see amplify-rewrites.json).
 */
function avoidMixedContent(base: string): string {
  if (
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    base.startsWith("http:")
  ) {
    return "";
  }
  return base;
}

export function getApiBaseUrl(): string {
  // Local dev always uses same-origin /api proxy — never call production.
  if (isLocalBrowser()) {
    return "";
  }

  // Prefer build-time env, but ignore a mis-baked loopback URL on a remote host
  // (e.g. Amplify built with local .env instead of EC2).
  const built = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (built && !isLoopbackApiUrl(built)) {
    return avoidMixedContent(normalizeBaseUrl(built));
  }

  if (typeof window !== "undefined") {
    const runtime = window.__FORKUP__?.apiUrl?.trim();
    if (runtime) return avoidMixedContent(normalizeBaseUrl(runtime));

    const host = window.location.hostname;
    const mapped = PRODUCTION_API_BY_HOST[host];
    if (mapped) return avoidMixedContent(normalizeBaseUrl(mapped));
  }

  return "";
}

export function apiUrl(path: string): string {
  const base = getApiBaseUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}
