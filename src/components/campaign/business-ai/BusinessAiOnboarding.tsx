"use client";

/**
 * Business AI onboarding (Tasks 6–9): website → AI draft → review → pick campaign → done.
 * Minimal UI — matches existing BusinessClaim form styling; does not replace manual claim.
 * Pass B: role-aware CTA copy (Create My Restaurant/Business Profile) from Join Us door hint.
 */
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Globe,
  Loader2,
  MapPin,
  Plus,
  Store,
  Trash2,
} from "lucide-react";
import { useCampaign } from "@/lib/campaign-context";
import { fetchCampaigns, linkUserOrganization, submitBusinessClaimRequest } from "@/lib/api";
import { generateBusinessDraft } from "@/lib/api-business-onboarding";
import {
  clearBusinessAiDraft,
  defaultBusinessAiDraft,
  loadBusinessAiDraft,
  saveBusinessAiDraft,
  type BusinessAiDraft,
} from "@/lib/business-onboarding-draft";
import { campaignHasEnded } from "@/components/campaign/CampaignDatePicker";
import type { CampaignListItem } from "@/lib/campaign-types";
import { getAuthToken } from "@/lib/auth-storage";
import { loadUserSession, syncAuthSession } from "@/lib/auth-session";
import { stashRoleHint, prepareBusinessJoinAuth, stashClaimLockEmail } from "@/lib/campaign-auth";
import { useClientMounted } from "@/lib/use-client-mounted";
import {
  businessDoorRoleLabel,
  businessProfileCtaLabel,
  readBusinessDoor,
  type BusinessDoor,
} from "@/lib/business-door";

type Phase = "website" | "analyzing" | "review" | "campaign" | "done";

export function BusinessAiOnboarding() {
  const { goTo, setBusinessProfile, update, switchActiveRole, state } = useCampaign();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("token")?.trim() ?? "";
  const mounted = useClientMounted();
  const [businessDoor, setBusinessDoor] = useState<BusinessDoor | null>(null);

  const [phase, setPhase] = useState<Phase>("website");
  const [draft, setDraft] = useState<BusinessAiDraft>(() => loadBusinessAiDraft() ?? defaultBusinessAiDraft());
  const [websiteInput, setWebsiteInput] = useState(draft.website);
  const [error, setError] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [doneEmail, setDoneEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!mounted) return;
    setBusinessDoor(readBusinessDoor());
  }, [mounted]);

  const profileCta = businessProfileCtaLabel(businessDoor);
  const roleWord = businessDoorRoleLabel(businessDoor);

  useEffect(() => {
    if (inviteToken) {
      setDraft((prev) => {
        const next = { ...prev, inviteToken };
        saveBusinessAiDraft(next);
        return next;
      });
    }
  }, [inviteToken]);

  useEffect(() => {
    if (!mounted || !getAuthToken()) return;
    const hasBusiness =
      state.businessMemberships.length > 0 || Boolean(state.businessProfile?.id);
    if (!hasBusiness) return;
    if (inviteToken) {
      goTo("business-acceptance", { query: { token: inviteToken } });
      return;
    }
    goTo("business-dashboard");
  }, [
    mounted,
    state.businessMemberships.length,
    state.businessProfile?.id,
    inviteToken,
    goTo,
  ]);

  const patchDraft = (patch: Partial<BusinessAiDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      saveBusinessAiDraft(next);
      return next;
    });
  };

  const runAnalyze = async () => {
    const website = websiteInput.trim();
    if (!website) {
      setError("Enter your business website to continue.");
      return;
    }
    setError(null);
    setPhase("analyzing");
    try {
      const result = await generateBusinessDraft(website);
      const sessionEmail = loadUserSession()?.email?.trim() ?? "";
      const next: BusinessAiDraft = {
        ...draft,
        website: result.website,
        businessName: result.businessName,
        businessType: result.businessType,
        about: result.about,
        contactEmail: sessionEmail || result.contactEmail,
        phone: result.phone,
        city: result.city,
        state: result.state,
        locations:
          result.locations.length > 0
            ? result.locations.map((loc) => ({
                locationName: loc.locationName,
                city: loc.city,
                state: loc.state,
                address: loc.address,
              }))
            : [{ locationName: "Main Location", city: result.city, state: result.state }],
        imageUrls: result.imageUrls,
        selectedImageUrl: result.imageUrls[0],
        supportsDine: result.supportsDineAndDonate,
        supportsShop: result.supportsShopAndDonate,
        supportsService: result.supportsServiceGiveback,
        supportsBartending: result.supportsGuestBartending,
        inviteToken: draft.inviteToken || inviteToken || undefined,
      };
      setDraft(next);
      saveBusinessAiDraft(next);
      setPhase("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not analyze website");
      setPhase("website");
    }
  };

  const loadLiveCampaigns = async () => {
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

  const goToCampaignStep = () => {
    void loadLiveCampaigns();
    setPhase("campaign");
  };

  const finishOnboarding = async () => {
    const primary = draft.locations[0];
    if (!draft.businessName.trim() || !draft.contactEmail.trim()) {
      setError("Business name and contact email are required.");
      setPhase("review");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitBusinessClaimRequest({
        businessName: draft.businessName.trim(),
        contactName: draft.contactName.trim() || draft.businessName.trim(),
        contactEmail: draft.contactEmail.trim(),
        businessType: draft.businessType.trim() || undefined,
        website: draft.website.trim() || undefined,
        locationName: primary?.locationName?.trim() || "Main Location",
        city: primary?.city?.trim() || draft.city.trim() || undefined,
        state: primary?.state?.trim() || draft.state.trim() || undefined,
        supportsDineAndDonate: draft.supportsDine,
        supportsShopAndDonate: draft.supportsShop,
        supportsServiceGiveback: draft.supportsService,
        supportsGuestBartending: draft.supportsBartending,
        joinDoorType: businessDoor ?? readBusinessDoor() ?? undefined,
      });

      if (result.action === "access_requested") {
        setError(result.message ?? "Access request submitted for review.");
        setSubmitting(false);
        return;
      }

      const business = result.business;
      const loc = business.locations[0];
      if (!loc) throw new Error("No location on business profile");

      setBusinessProfile({
        id: business.id,
        businessName: business.businessName,
        contactName: business.contactName ?? draft.contactName,
        contactEmail: business.contactEmail ?? draft.contactEmail,
        locationId: loc.id,
        locationName: loc.locationName,
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
          sessionStorage.setItem("forkup-business-onboarding-campaign", draft.selectedCampaignSlug);
        } catch {
          /* ignore */
        }
      }

      clearBusinessAiDraft();
      setDoneEmail(draft.contactEmail.trim());
      setPhase("done");

      if (draft.inviteToken) {
        goTo("business-acceptance", { query: { token: draft.inviteToken } });
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save business profile");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-lg px-5 py-10 sm:px-6">
      <button
        type="button"
        onClick={() =>
          goTo(
            inviteToken ? "business-acceptance" : "business-claim",
            inviteToken ? { query: { token: inviteToken } } : undefined,
          )
        }
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {inviteToken ? "Back to invitation" : "Manual business setup"}
      </button>

      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-accent text-primary">
          <Store className="size-5" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Quick {roleWord} setup
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Create your {roleWord} profile from your website
          </h1>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        No account needed to start — confirm a few details, optionally pick a campaign, then create
        your profile draft. Deeper setup comes after email.
      </p>

      {phase === "done" && (
        <div className="mt-10 rounded-2xl border border-border bg-card p-6 text-center">
          <CheckCircle2 className="mx-auto size-10 text-primary" />
          <h2 className="mt-4 text-xl font-bold">Profile draft created</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your {roleWord} profile draft is saved
            {doneEmail ? (
              <>
                {" "}
                for <span className="font-medium text-foreground">{doneEmail}</span>.
              </>
            ) : (
              "."
            )}{" "}
            You can finish verification, ACH, and campaign details later.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            {getAuthToken() ? (
              <button
                type="button"
                onClick={() => goTo("business-dashboard")}
                className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
              >
                Go to business dashboard
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  prepareBusinessJoinAuth();
                  const emailForLock = doneEmail || draft.contactEmail.trim();
                  if (emailForLock) stashClaimLockEmail(emailForLock);
                  goTo("auth-login", {
                    query: { email: emailForLock || undefined, token: undefined },
                  });
                }}
                className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
              >
                Create account (optional)
              </button>
            )}
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

      {phase !== "done" && error && (
        <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {phase !== "done" && phase === "website" && (
        <div className="mt-8 space-y-4">
          <label className="block text-sm font-medium">
            Business website
            <div className="relative mt-1.5">
              <Globe className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="url"
                value={websiteInput}
                onChange={(e) => setWebsiteInput(e.target.value)}
                placeholder="https://yourrestaurant.com"
                className="w-full rounded-xl border border-border py-2.5 pl-10 pr-3 text-sm"
              />
            </div>
          </label>
          <button
            type="button"
            onClick={() => void runAnalyze()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
          >
            Analyze website
            <ArrowRight className="size-4" />
          </button>
        </div>
      )}

      {phase !== "done" && phase === "analyzing" && (
        <div className="mt-12 flex flex-col items-center gap-3 text-center">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Reading your website and building a draft profile…</p>
        </div>
      )}

      {phase !== "done" && phase === "review" && (
        <div className="mt-8 space-y-4">
          {draft.imageUrls.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium">Choose a profile image</p>
              <div className="flex flex-wrap gap-2">
                {draft.imageUrls.map((url) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => patchDraft({ selectedImageUrl: url })}
                    className={`size-16 overflow-hidden rounded-lg border-2 ${
                      draft.selectedImageUrl === url ? "border-primary" : "border-border"
                    }`}
                  >
                    <img src={url} alt="" className="size-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="block text-sm font-medium">
            Business name
            <input
              className="mt-1.5 w-full rounded-xl border border-border px-3 py-2.5 text-sm"
              value={draft.businessName}
              onChange={(e) => patchDraft({ businessName: e.target.value })}
            />
          </label>
          <label className="block text-sm font-medium">
            Contact email
            <input
              type="email"
              className="mt-1.5 w-full rounded-xl border border-border px-3 py-2.5 text-sm"
              value={draft.contactEmail}
              onChange={(e) => patchDraft({ contactEmail: e.target.value })}
            />
          </label>
          <label className="block text-sm font-medium">
            Contact name
            <input
              className="mt-1.5 w-full rounded-xl border border-border px-3 py-2.5 text-sm"
              value={draft.contactName}
              onChange={(e) => patchDraft({ contactName: e.target.value })}
            />
          </label>

          <div>
            <p className="text-sm font-medium">Locations</p>
            {draft.locations.map((loc, idx) => (
              <div key={idx} className="mt-2 rounded-xl border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    <MapPin className="mr-1 inline size-3" />
                    Location {idx + 1}
                  </span>
                  {draft.locations.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        patchDraft({
                          locations: draft.locations.filter((_, i) => i !== idx),
                        })
                      }
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
                <input
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                  placeholder="Location name"
                  value={loc.locationName}
                  onChange={(e) => {
                    const locations = [...draft.locations];
                    locations[idx] = { ...loc, locationName: e.target.value };
                    patchDraft({ locations });
                  }}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="rounded-lg border border-border px-3 py-2 text-sm"
                    placeholder="City"
                    value={loc.city}
                    onChange={(e) => {
                      const locations = [...draft.locations];
                      locations[idx] = { ...loc, city: e.target.value };
                      patchDraft({ locations });
                    }}
                  />
                  <input
                    className="rounded-lg border border-border px-3 py-2 text-sm"
                    placeholder="State"
                    value={loc.state}
                    onChange={(e) => {
                      const locations = [...draft.locations];
                      locations[idx] = { ...loc, state: e.target.value };
                      patchDraft({ locations });
                    }}
                  />
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                patchDraft({
                  locations: [
                    ...draft.locations,
                    { locationName: `Location ${draft.locations.length + 1}`, city: "", state: "" },
                  ],
                })
              }
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary"
            >
              <Plus className="size-3.5" />
              Add another location
            </button>
          </div>

          <div className="flex flex-wrap gap-3 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.supportsDine}
                onChange={(e) => patchDraft({ supportsDine: e.target.checked })}
              />
              Dine &amp; Donate
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.supportsShop}
                onChange={(e) => patchDraft({ supportsShop: e.target.checked })}
              />
              Shop &amp; Donate
            </label>
          </div>

          <button
            type="button"
            onClick={goToCampaignStep}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
          >
            Continue — pick a campaign
            <ArrowRight className="size-4" />
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void finishOnboarding()}
            className="inline-flex w-full items-center justify-center text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            Skip campaign — {profileCta}
          </button>
        </div>
      )}

      {phase !== "done" && phase === "campaign" && (
        <div className="mt-8 space-y-4">
          <p className="text-sm text-muted-foreground">
            Choose a live campaign to join. You can accept a formal invite after your profile draft is
            saved.
          </p>
          {loadingCampaigns && (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          )}
          {!loadingCampaigns && campaigns.length === 0 && (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No live campaigns right now. You can create your profile draft and join when campaigns
              are available.
            </p>
          )}
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {campaigns.map((c) => (
              <button
                key={c.slug}
                type="button"
                onClick={() => patchDraft({ selectedCampaignSlug: c.slug })}
                className={`block w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
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
          <button
            type="button"
            disabled={submitting}
            onClick={() => void finishOnboarding()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            {profileCta}
          </button>
        </div>
      )}
    </main>
  );
}
