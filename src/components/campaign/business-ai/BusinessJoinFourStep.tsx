"use client";

/**
 * Pass D2 — Restaurant / Local Business 4-step giveback join (mockup).
 *
 * Steps: (1) Find by name or website → (2) Confirm found → (3) Giveback + cause → (4) Email.
 * Inputs: Join Us door hint (restaurant | local). Outputs: claim-request profile draft.
 * One field accepts business name or website URL; both stay in this flow.
 */
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Store,
} from "lucide-react";
import { useCampaign } from "@/lib/campaign-context";
import {
  findBusinessProfile,
  generateBusinessDraft,
  type BusinessDraftApiResult,
  type FindBusinessProfileResult,
} from "@/lib/api-business-onboarding";
import { submitBusinessClaimRequest, linkUserOrganization } from "@/lib/api";
import { fetchCampaigns } from "@/lib/api";
import type { CampaignListItem } from "@/lib/campaign-types";
import { campaignHasEnded } from "@/components/campaign/CampaignDatePicker";
import { getAuthToken } from "@/lib/auth-storage";
import { syncAuthSession } from "@/lib/auth-session";
import { stashRoleHint, prepareBusinessJoinAuth } from "@/lib/campaign-auth";
import { useClientMounted } from "@/lib/use-client-mounted";
import {
  businessDoorRoleLabel,
  readBusinessDoor,
  type BusinessDoor,
} from "@/lib/business-door";
import {
  looksLikeWebsiteQuery,
  normalizeWebsiteQuery,
} from "@/lib/business-join-query";
import {
  clearBusinessJoinDraft,
  defaultBusinessJoinDraft,
  loadBusinessJoinDraft,
  saveBusinessJoinDraft,
  type BusinessJoinFourStepDraft,
  type CauseMode,
  type LocalGivebackMode,
} from "@/lib/business-join-four-step-draft";

type Phase = "find" | "confirm" | "giveback" | "email" | "done";

/**
 * Map website draft API result into the confirm-card shape used by name find.
 */
function mapWebsiteDraftToFindResult(
  draft: BusinessDraftApiResult,
  joinDoorType: BusinessDoor | null,
): FindBusinessProfileResult {
  const city = draft.city?.trim() || draft.locations[0]?.city?.trim() || "";
  const state = draft.state?.trim() || draft.locations[0]?.state?.trim() || "";
  const address = draft.locations[0]?.address?.trim() || "";
  const imageUrls = draft.imageUrls ?? [];
  const locationFound = Boolean(city || state || address);
  return {
    businessName: draft.businessName?.trim() || "Your business",
    website: draft.website,
    businessType: draft.businessType || (joinDoorType === "local" ? "Local Business" : "Restaurant"),
    about: draft.about || "",
    contactEmail: draft.contactEmail || "",
    phone: draft.phone || "",
    city,
    state,
    address,
    zip: "",
    locations:
      draft.locations.length > 0
        ? draft.locations.map((loc) => ({
            locationName: loc.locationName || draft.businessName || "Main Location",
            city: loc.city || city,
            state: loc.state || state,
            ...(loc.address ? { address: loc.address } : address ? { address } : {}),
          }))
        : [
            {
              locationName: draft.businessName || "Main Location",
              city,
              state,
              ...(address ? { address } : {}),
            },
          ],
    logoUrl: imageUrls[0] ?? null,
    imageUrls,
    checks: {
      websiteFound: Boolean(draft.website),
      logoFound: imageUrls.length > 0,
      photosFound: imageUrls.length > 0,
      locationFound,
    },
    locationSourceUrl: draft.website || null,
    joinDoorType,
    confirmationStatus: draft.confirmationStatus || "Website Draft",
    provider: draft.provider,
  };
}

/**
 * Four-step Restaurant / Local giveback onboarding matching product mockup.
 */
export function BusinessJoinFourStep() {
  const { goTo, setBusinessProfile, update, switchActiveRole, state } = useCampaign();
  const mounted = useClientMounted();
  const [door, setDoor] = useState<BusinessDoor | null>(null);
  const [phase, setPhase] = useState<Phase>("find");
  const [draft, setDraft] = useState<BusinessJoinFourStepDraft>(() =>
    loadBusinessJoinDraft() ?? defaultBusinessJoinDraft(),
  );
  const [error, setError] = useState<string | null>(null);
  const [finding, setFinding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  /** Done-screen variant when a second email hits a locked guest draft. */
  const [doneAccessRequested, setDoneAccessRequested] = useState(false);
  const [claimEmailSent, setClaimEmailSent] = useState(false);
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  useEffect(() => {
    if (!mounted) return;
    const d = readBusinessDoor();
    setDoor(d);
    setDraft((prev) => {
      const next = { ...prev, door: d ?? prev.door };
      saveBusinessJoinDraft(next);
      return next;
    });
  }, [mounted]);

  useEffect(() => {
    if (!mounted || !getAuthToken()) return;
    const hasBusiness =
      state.businessMemberships.length > 0 || Boolean(state.businessProfile?.id);
    if (!hasBusiness) return;
    goTo("business-dashboard");
  }, [mounted, state.businessMemberships.length, state.businessProfile?.id, goTo]);

  const roleWord = businessDoorRoleLabel(door);
  const isRestaurant = door !== "local";

  const patchDraft = (patch: Partial<BusinessJoinFourStepDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      saveBusinessJoinDraft(next);
      return next;
    });
  };

  const runFind = async () => {
    const q = draft.nameQuery.trim();
    if (!q) {
      setError(`Enter your ${roleWord} name or website to continue.`);
      return;
    }
    setError(null);
    setFinding(true);
    try {
      const doorType = door ?? readBusinessDoor() ?? undefined;
      let found: FindBusinessProfileResult;
      if (looksLikeWebsiteQuery(q)) {
        const website = normalizeWebsiteQuery(q);
        const websiteDraft = await generateBusinessDraft(website);
        found = mapWebsiteDraftToFindResult(websiteDraft, doorType ?? null);
      } else {
        found = await findBusinessProfile({
          businessName: q,
          joinDoorType: doorType,
        });
      }
      patchDraft({ found, nameQuery: q });
      setPhase("confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not find that ${roleWord}`);
    } finally {
      setFinding(false);
    }
  };

  const loadCauses = async () => {
    setLoadingCampaigns(true);
    try {
      const rows = await fetchCampaigns();
      setCampaigns(rows.filter((c) => !campaignHasEnded(c)));
    } catch {
      setCampaigns([]);
    } finally {
      setLoadingCampaigns(false);
    }
  };

  const goGiveback = () => {
    setError(null);
    void loadCauses();
    setPhase("giveback");
  };

  const finishJoin = async () => {
    const found = draft.found;
    const email = draft.email.trim();
    if (!found) {
      setError("Find your business first.");
      setPhase("find");
      return;
    }
    if (!email.includes("@")) {
      setError("Enter a valid email for your dashboard.");
      setPhase("email");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const loc = found.locations[0];
      const supportsDine = isRestaurant || draft.localGivebackMode === "percent_of_purchase";
      const supportsShop = !isRestaurant && draft.localGivebackMode !== "percent_of_purchase";
      const joinGivebackMode = isRestaurant
        ? ("restaurant_dine_percent" as const)
        : draft.localGivebackMode;

      const result = await submitBusinessClaimRequest({
        businessName: found.businessName.trim(),
        contactName: found.businessName.trim(),
        contactEmail: email,
        businessType: found.businessType || undefined,
        website: found.website || undefined,
        locationName: loc?.locationName?.trim() || found.businessName.trim(),
        city: loc?.city?.trim() || found.city || undefined,
        state: loc?.state?.trim() || found.state || undefined,
        supportsDineAndDonate: supportsDine,
        supportsShopAndDonate: supportsShop,
        supportsServiceGiveback: false,
        supportsGuestBartending: false,
        joinDoorType: door ?? readBusinessDoor() ?? undefined,
        joinGivebackMode,
        joinCauseMode: draft.causeMode,
        joinPreferredCampaignSlug:
          draft.causeMode === "pick_now" ? draft.selectedCampaignSlug : undefined,
      });

      if (result.action === "access_requested") {
        setDoneAccessRequested(true);
        setClaimEmailSent(false);
        setError(null);
        setPhase("done");
        setSubmitting(false);
        return;
      }

      const business = result.business;
      const primary = business.locations[0];
      if (!primary) throw new Error("No location on business profile");

      setDoneAccessRequested(false);
      setClaimEmailSent(Boolean(result.claimEmailSent));

      setBusinessProfile({
        id: business.id,
        businessName: business.businessName,
        contactName: business.contactName ?? found.businessName,
        contactEmail: business.contactEmail ?? email,
        locationId: primary.id,
        locationName: primary.locationName,
        capabilities: business.capabilities,
        claimStatus: business.claimStatus,
        businessStatus: business.businessStatus,
      });
      update({ accountIntent: "business" });
      switchActiveRole("business", business.id);
      stashRoleHint("business");

      if (getAuthToken()) {
        try {
          await linkUserOrganization({
            organizationType: "business",
            organizationId: business.id,
            role: "admin",
          });
          await syncAuthSession("business");
        } catch {
          /* optional */
        }
      }

      if (draft.selectedCampaignSlug) {
        try {
          sessionStorage.setItem(
            "forkup-business-onboarding-campaign",
            draft.selectedCampaignSlug,
          );
        } catch {
          /* ignore */
        }
      }
      try {
        sessionStorage.setItem(
          "forkup-business-join-prefs",
          JSON.stringify({
            causeMode: draft.causeMode,
            localGivebackMode: draft.localGivebackMode,
            door: door ?? null,
          }),
        );
      } catch {
        /* ignore */
      }

      clearBusinessJoinDraft();
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join ForkUp");
    } finally {
      setSubmitting(false);
    }
  };

  const locationLine = draft.found
    ? [draft.found.city, draft.found.state].filter(Boolean).join(", ") ||
      draft.found.address ||
      "Location to confirm"
    : "";

  return (
    <main className="mx-auto max-w-lg px-5 py-10 sm:px-6">
      <button
        type="button"
        onClick={() => goTo("website-landing")}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to home
      </button>

      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-accent text-primary">
          <Store className="size-5" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            {isRestaurant ? "Restaurant" : "Local business"} — give back
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {phase === "find" && `Find your ${roleWord}`}
            {phase === "confirm" && "We found you"}
            {phase === "giveback" &&
              (isRestaurant ? "How you'll give back" : "How would you like to help?")}
            {phase === "email" &&
              (isRestaurant ? "You're ready to ForkUp!" : "You're ready to make an impact!")}
            {phase === "done" &&
              (doneAccessRequested ? "Request submitted" : "You're in")}
          </h1>
        </div>
      </div>

      {phase !== "done" && error && (
        <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {phase === "find" && (
        <div className="mt-8 space-y-4">
          <p className="text-sm text-muted-foreground">
            Enter your {roleWord} name or website.
          </p>
          <label className="block text-sm font-medium">
            {isRestaurant ? "Restaurant name or website" : "Business name or website"}
            <input
              className="mt-1.5 w-full rounded-xl border border-border px-3 py-2.5 text-sm"
              value={draft.nameQuery}
              onChange={(e) => patchDraft({ nameQuery: e.target.value })}
              placeholder={
                isRestaurant
                  ? "e.g. Sovana Bistro or https://www.sovanabistro.com"
                  : "e.g. Main Street Salon or https://…"
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") void runFind();
              }}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Our AI will find your website,{" "}
            {isRestaurant ? "menu, photos and location" : "photos, location and public information"}
            — or use the URL you paste.
          </p>
          <button
            type="button"
            disabled={finding}
            onClick={() => void runFind()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {finding ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                Find My {isRestaurant ? "Restaurant" : "Business"}
                <ArrowRight className="size-4" />
              </>
            )}
          </button>
        </div>
      )}

      {phase === "confirm" && draft.found && (
        <div className="mt-8 space-y-4">
          <p className="text-sm text-muted-foreground">
            Here&apos;s what we found. Let us know if this is you.
          </p>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {(draft.found.imageUrls[0] || draft.found.logoUrl) && (
              <img
                src={draft.found.imageUrls[0] || draft.found.logoUrl || ""}
                alt=""
                className="h-40 w-full object-cover"
              />
            )}
            <div className="space-y-2 p-4">
              <div className="flex items-center gap-3">
                {draft.found.logoUrl && (
                  <img
                    src={draft.found.logoUrl}
                    alt=""
                    className="size-12 rounded-lg border border-border object-cover"
                  />
                )}
                <div>
                  <p className="text-lg font-bold">{draft.found.businessName}</p>
                  <p className="text-sm text-muted-foreground">{locationLine}</p>
                </div>
              </div>
              <ul className="mt-3 space-y-1.5 text-sm">
                <CheckRow ok={draft.found.checks.websiteFound} label="Website found" />
                <CheckRow ok={draft.found.checks.logoFound} label="Logo found" />
                <CheckRow ok={draft.found.checks.photosFound} label="Photos found" />
                <CheckRow ok={draft.found.checks.locationFound} label="Location found" />
              </ul>
            </div>
          </div>
          <button
            type="button"
            onClick={goGiveback}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
          >
            Yes, that&apos;s us
            <ArrowRight className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              patchDraft({ found: null });
              setPhase("find");
            }}
            className="w-full text-center text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            Not correct? Search again
          </button>
        </div>
      )}

      {phase === "giveback" && (
        <div className="mt-8 space-y-5">
          {isRestaurant ? (
            <div className="rounded-2xl border-2 border-primary/40 bg-primary/5 px-5 py-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Give 15% back
              </p>
              <div className="mt-3 flex items-start gap-3">
                <CheckCircle2 className="mt-1 size-6 shrink-0 text-primary" />
                <div>
                  <p className="text-4xl font-extrabold tracking-tight text-foreground">
                    15%
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    of eligible dining proceeds
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    ForkUp donates from supporters who dine with you. Make a real
                    difference with every meal.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-2xl border-2 border-primary/40 bg-primary/5 px-5 py-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Your give-back choice
                </p>
                <div className="mt-3 flex items-start gap-3">
                  <CheckCircle2 className="mt-1 size-6 shrink-0 text-primary" />
                  <div>
                    {draft.localGivebackMode === "percent_of_purchase" && (
                      <>
                        <p className="text-sm font-semibold text-primary">Recommended</p>
                        <p className="text-3xl font-extrabold tracking-tight text-foreground">
                          % of purchase
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Give a percentage when a ForkUp supporter shops with you.
                        </p>
                      </>
                    )}
                    {draft.localGivebackMode === "dollar_per_visit" && (
                      <>
                        <p className="text-3xl font-extrabold tracking-tight text-foreground">
                          $ per visit
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Give a set amount for each qualifying customer.
                        </p>
                      </>
                    )}
                    {draft.localGivebackMode === "special_offer" && (
                      <>
                        <p className="text-3xl font-extrabold tracking-tight text-foreground">
                          Special offer
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Create your own ForkUp give-back offer.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                How would you like to give back? Choose the option that works best for your
                business.
              </p>
              <div className="space-y-2">
                {(
                  [
                    {
                      id: "percent_of_purchase" as LocalGivebackMode,
                      title: "% of Purchase (Recommended)",
                      note: "Give a percentage when a ForkUp supporter shops with you.",
                    },
                    {
                      id: "dollar_per_visit" as LocalGivebackMode,
                      title: "$ Per Visit",
                      note: "Give a set amount for each qualifying customer.",
                    },
                    {
                      id: "special_offer" as LocalGivebackMode,
                      title: "Special Offer",
                      note: "Create your own ForkUp give-back offer.",
                    },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => patchDraft({ localGivebackMode: opt.id })}
                    className={`block w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                      draft.localGivebackMode === opt.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-accent"
                    }`}
                  >
                    <span className="font-semibold">{opt.title}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{opt.note}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-sm font-medium">Choose a cause to support</p>
            <div className="mt-2 space-y-2">
              {(
                [
                  { id: "pick_now" as CauseMode, label: "Select a local cause now" },
                  { id: "forkup_match" as CauseMode, label: "Let ForkUp match me with local causes" },
                ] as const
              ).map((opt) => (
                <label
                  key={opt.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm ${
                    draft.causeMode === opt.id
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  }`}
                >
                  <input
                    type="radio"
                    name="causeMode"
                    checked={draft.causeMode === opt.id}
                    onChange={() => patchDraft({ causeMode: opt.id })}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {draft.causeMode === "pick_now" && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Optional — pick a live campaign now or skip.</p>
              {loadingCampaigns && (
                <div className="flex justify-center py-4">
                  <Loader2 className="size-5 animate-spin text-primary" />
                </div>
              )}
              {!loadingCampaigns && campaigns.length === 0 && (
                <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  No live campaigns right now — you can still join and match later.
                </p>
              )}
              <div className="max-h-48 space-y-2 overflow-y-auto">
                {campaigns.map((c) => (
                  <button
                    key={c.slug}
                    type="button"
                    onClick={() => patchDraft({ selectedCampaignSlug: c.slug })}
                    className={`block w-full rounded-xl border px-3 py-2.5 text-left text-sm ${
                      draft.selectedCampaignSlug === c.slug
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-accent"
                    }`}
                  >
                    <span className="font-semibold">{c.name}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {c.nonprofit} · {c.dateRange}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setError(null);
              setPhase("email");
            }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
          >
            Count Us In
            <ArrowRight className="size-4" />
          </button>
        </div>
      )}

      {phase === "email" && (
        <div className="mt-8 space-y-4">
          <p className="text-sm text-muted-foreground">
            Where should we send your {roleWord} dashboard?
          </p>
          <label className="block text-sm font-medium">
            Email
            <input
              type="email"
              className="mt-1.5 w-full rounded-xl border border-border px-3 py-2.5 text-sm"
              value={draft.email}
              onChange={(e) => patchDraft({ email: e.target.value })}
              placeholder={isRestaurant ? "you@restaurant.com" : "you@yourbusiness.com"}
            />
          </label>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void finishJoin()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            Join ForkUp
            {!submitting && <ArrowRight className="size-4" />}
          </button>
          <p className="text-center text-xs text-muted-foreground">
            No password needed. You can always add more details later.
          </p>
        </div>
      )}

      {phase === "done" && (
        <div className="mt-10 rounded-2xl border border-border bg-card p-6 text-center">
          <CheckCircle2 className="mx-auto size-10 text-primary" />
          <h2 className="mt-4 text-xl font-bold">
            {doneAccessRequested ? "Access requested" : "Welcome to ForkUp"}
          </h2>
          {doneAccessRequested ? (
            <p className="mt-2 text-sm text-muted-foreground">
              This {roleWord} draft is already saved under another email. ForkUp will review your
              access request
              {draft.email ? (
                <>
                  {" "}
                  for <span className="font-medium text-foreground">{draft.email}</span>
                </>
              ) : null}
              .
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Your {roleWord} profile draft is saved
              {draft.email ? (
                <>
                  {" "}
                  for <span className="font-medium text-foreground">{draft.email}</span>
                </>
              ) : null}
              .
              {claimEmailSent || !getAuthToken() ? (
                <>
                  {" "}
                  Check your inbox for a claim link so you can manage it on any device.
                </>
              ) : (
                <> Finish verification and campaign details anytime.</>
              )}
            </p>
          )}
          <div className="mt-6 flex flex-col gap-2">
            {!doneAccessRequested && getAuthToken() ? (
              <button
                type="button"
                onClick={() => goTo("business-dashboard")}
                className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
              >
                Go to business dashboard
              </button>
            ) : !doneAccessRequested ? (
              <button
                type="button"
                onClick={() => {
                  prepareBusinessJoinAuth();
                  goTo("auth-login");
                }}
                className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
              >
                Create account (optional)
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => goTo("website-landing")}
              className="text-sm font-semibold text-primary"
            >
              Back to ForkUp home
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <CheckCircle2 className={`size-4 ${ok ? "text-primary" : "text-muted-foreground/40"}`} />
      <span className={ok ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </li>
  );
}
