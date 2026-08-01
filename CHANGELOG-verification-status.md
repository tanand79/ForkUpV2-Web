# Changelog — verification status lists + denied badge (2026-08-01)

## Added
- Super Admin Verification tab: separate Pending / Approved / Denied lists (uses existing `GET /api/superadmin/access-requests?status=`).
- Auth profile DTO field `accessRequestStatus` (latest row from `organization_access_requests`) so requesters see denied/approved on dashboards.
- Nonprofit + Business dashboard badges: **Verification denied** when `accessRequestStatus === "denied"`.
- Optional migration script `migrate-verification-denied.ts` (adds CHECK value `denied`) — not required for this UI; run later when DB locks are free if you want org columns to store `denied` directly.

## Added (date display)
- Shared `formatDateUs` / `formatDateTimeUs` in `src/lib/date-only.ts`
  - Date: `Saturday, August 1, 2026`
  - Date-time: `Saturday, August 1, 2026, 2:25 AM`
- Wired across Super Admin details, admin logs, dashboards, success engine, receipts, analytics, and public donation feed.

## Added (superadmin View Details — campaign activity)
- `GET /api/superadmin/organizations/:type/:id` now also returns `activitySummary` + `campaigns[]` (raised/goal, online gifts, giveback pool, supporters, receipts, partners, ambassadors, settlement) — additive fields only.
- Super Admin **View Details** panel shows Activity overview + per-campaign KPI cards (creator-parity), then existing verification/profile/locations sections unchanged.
