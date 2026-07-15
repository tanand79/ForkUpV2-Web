/**
 * Optional production override (static hosts). Prefer NEXT_PUBLIC_API_URL in env
 * (Amplify / .env.production / _env.production) — leave apiUrl unset to use env.
 */
window.__FORKUP__ = window.__FORKUP__ || {};
// window.__FORKUP__.apiUrl = ""; // optional override; unset = use NEXT_PUBLIC_API_URL
