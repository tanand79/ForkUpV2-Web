/**
 * Optional production override (static hosts). Prefer NEXT_PUBLIC_API_URL in env
 * (Amplify / .env.production / _env.production) — leave apiUrl unset to use env.
 *
 * Amplify same-origin /api is broken for venue images (trailingSlash 308 → 404).
 * Pin the HTTPS EC2 API so /api/venue-photo-proxy and /uploads resolve correctly.
 */
window.__FORKUP__ = window.__FORKUP__ || {};
window.__FORKUP__.apiUrl = window.__FORKUP__.apiUrl || "https://forkup2.duckdns.org";
