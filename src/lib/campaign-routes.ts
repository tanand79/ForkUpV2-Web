import type { StepId } from "@/lib/campaign-context";

const STEP_SLUG_OVERRIDES: Partial<Record<StepId, string>> = {
  guestBartending: "guest-bartending",
};

export const ALL_STEP_IDS: StepId[] = [
  "start",
  "website-landing",
  "campaign-directory",
  "past-campaigns",
  "success-stories",
  "choose-account-type",
  "nonprofit-claim",
  "business-claim",
  "business-invites-nonprofit",
  "nonprofit-accepts-invite",
  "nonprofit-dashboard",
  "business-dashboard",
  "supporter-dashboard",
  "auth-login",
  "account-hub",
  "choose-organizer-mode",
  "create-fundraiser",
  "quick-start",
  "ai-find-org",
  "ai-connect-social",
  "ai-analyzing",
  "ai-campaign-ideas",
  "ai-campaign-purpose",
  "ai-campaign-build",
  "ai-campaign-dates",
  "ai-campaign-preview",
  "ai-continue-guest",
  "campaign-review",
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
  "in-review-preview",
  "receipt-ocr",
  "receipt-upload",
  "supporter-receipts",
  "business-profile",
  "campaign-page",
  "business-acceptance",
  "reporting",
  "analytics",
  "nonprofit-profile",
  "success-engine",
  "architecture-map",
  "admin-preload",
  "admin-email-log",
  "admin-access-requests",
  "super-admin-login",
  "super-admin-forgot-password",
  "super-admin-reset-password",
  "super-admin",
  "organization-library",
  "guestBartending",
  "ambassador",
  "success-virtual",
  "success-ambassador",
  "success-bartending",
  "success-giveback-live",
  "success-mixed",
];

const SLUG_TO_STEP: Record<string, StepId> = Object.fromEntries(
  ALL_STEP_IDS.map((step) => [stepToSlug(step), step]),
) as Record<string, StepId>;

export function stepToSlug(step: StepId): string {
  return STEP_SLUG_OVERRIDES[step] ?? step;
}

/** Browser URL for a screen. Uses query params on `/` so we avoid extra Next.js routes. */
export function stepToPath(step: StepId): string {
  if (step === "website-landing") return "/";
  return `/?step=${encodeURIComponent(step)}`;
}

/** Update the `step` query param while preserving others (e.g. invitation `token`). */
export function pathForStep(
  step: StepId,
  pathname: string = "/",
  search: string = "",
): string {
  return pathForStepWithParams(step, {}, pathname, search);
}

export type StepQueryParams = Record<string, string | undefined>;

/** Set `step` and optional extra query params (e.g. campaign slug for invite review). */
export function pathForStepWithParams(
  step: StepId,
  extra: StepQueryParams = {},
  pathname: string = "/",
  search: string = "",
): string {
  const params = new URLSearchParams(search.replace(/^\?/, ""));
  if (step === "website-landing") {
    params.delete("step");
  } else {
    params.set("step", step);
  }
  for (const [key, value] of Object.entries(extra)) {
    if (value != null && value !== "") params.set(key, value);
    else params.delete(key);
  }
  const qs = params.toString();
  const base = pathname || "/";
  return qs ? `${base}?${qs}` : base;
}

/** Campaign + invitation context for the business invite status screen. */
export function inviteReviewFromSearch(search: string): {
  campaignSlug: string | null;
  invitationId: string | null;
} {
  const params = new URLSearchParams(search.replace(/^\?/, ""));
  return {
    campaignSlug: params.get("campaign"),
    invitationId: params.get("invitation"),
  };
}

export function isStepSlug(slug: string): slug is string {
  return slug in SLUG_TO_STEP;
}

export function slugToStep(slug: string): StepId | null {
  return SLUG_TO_STEP[slug] ?? null;
}

export function isStepId(value: string): value is StepId {
  return ALL_STEP_IDS.includes(value as StepId);
}

export function stepFromLocation(
  pathname: string,
  search: string = "",
  historyStep?: StepId,
): StepId {
  if (historyStep && isStepId(historyStep)) return historyStep;

  const params = new URLSearchParams(search.replace(/^\?/, ""));
  const stepParam = params.get("step");
  if (stepParam && isStepId(stepParam)) return stepParam;

  if (pathname !== "/") {
    const slug = pathname.replace(/^\/+/, "").split("/")[0] ?? "";
    const fromSlug = slugToStep(slug);
    if (fromSlug) return fromSlug;
  }

  return "website-landing";
}

export function stepFromSearchParams(stepParam: string | string[] | undefined): StepId {
  const value = Array.isArray(stepParam) ? stepParam[0] : stepParam;
  if (value && isStepId(value)) return value;
  return "website-landing";
}

export function locationUrl(pathname: string, search: string): string {
  return search ? `${pathname}${search.startsWith("?") ? search : `?${search}`}` : pathname;
}
