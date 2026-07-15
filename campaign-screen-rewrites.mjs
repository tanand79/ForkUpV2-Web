/** Screen path rewrites for next.config — keep in plain JS (no @/ imports). */

const STEP_SLUG_OVERRIDES = {
  guestBartending: "guest-bartending",
};

const ALL_STEP_IDS = [
  "start",
  "website-landing",
  "campaign-directory",
  "choose-account-type",
  "nonprofit-claim",
  "business-claim",
  "business-invites-nonprofit",
  "nonprofit-accepts-invite",
  "nonprofit-dashboard",
  "methods",
  "businesses",
  "invite",
  "edit-invite",
  "business-invite-flow",
  "details",
  "media",
  "review",
  "created",
  "dashboard",
  "receipt-ocr",
  "business-profile",
  "campaign-page",
  "business-acceptance",
  "reporting",
  "nonprofit-profile",
  "success-engine",
  "architecture-map",
  "admin-preload",
  "guestBartending",
  "ambassador",
  "success-virtual",
  "success-ambassador",
  "success-bartending",
  "success-giveback-live",
  "success-mixed",
];

function stepToSlug(step) {
  return STEP_SLUG_OVERRIDES[step] ?? step;
}

export const screenRewrites = ALL_STEP_IDS.filter((id) => id !== "website-landing").map(
  (id) => ({
    source: `/${stepToSlug(id)}`,
    destination: `/?step=${encodeURIComponent(id)}`,
  }),
);
