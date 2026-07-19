"use client";

import {
  HeartHandshake,
  Store,
  Send,
  CheckCircle2,
  Loader2,
  ArrowRight,
  XCircle,
  MapPin,
  Percent,
  Clock,
  ShieldAlert,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCampaign } from "@/lib/campaign-context";
import { stateFromBusinessInvite } from "@/lib/campaign-flow";
import { syncAuthSession } from "@/lib/auth-session";
import { stashAuthReturnStep, stashRoleHint } from "@/lib/campaign-auth";
import { getAuthToken } from "@/lib/auth-storage";
import {
  acceptNonprofitCampaignInvite,
  submitBusinessClaimRequest,
  submitNonprofitClaimRequest,
  declineNonprofitCampaignInvite,
  fetchNonprofitCampaignInvite,
  linkUserOrganization,
  searchNonprofits,
  sendNonprofitCampaignInvite,
  type NonprofitCampaignInvite,
  type NonprofitClaimRequestResult,
  type NonprofitProfile,
  type BusinessClaimRequestResult,
  type OrganizationSearchCandidate,
} from "@/lib/api";
import { OrganizationLookupConfirm } from "@/components/campaign/OrganizationLookupConfirm";
import { loadUserSession } from "@/lib/auth-session";
import {
  clearBusinessClaimDraft,
  defaultBusinessClaimDraft,
  loadBusinessClaimDraft,
  saveBusinessClaimDraft,
  type BusinessClaimDraft,
} from "@/lib/business-claim-draft";

const field =
  "w-full rounded-xl border border-border bg-background px-4 py-3 text-sm";

const METHOD_OPTIONS = [
  { value: "dine_and_donate", label: "Dine & Donate" },
  { value: "shop_and_donate", label: "Shop & Donate" },
  { value: "service_giveback", label: "Service Giveback" },
  { value: "guest_bartending_event", label: "Guest Bartending" },
] as const;

export function ChooseAccountType() {
  const { goTo } = useCampaign();

  return (
    <main className="mx-auto max-w-lg px-5 py-10 sm:px-6">
      <h1 className="text-3xl font-extrabold tracking-tight">Who are you?</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        One ForkUp account can hold nonprofit, business, and supporter roles. Pick where to start.
      </p>
      <div className="mt-8 grid gap-4">
        <button
          type="button"
          onClick={() => {
            stashRoleHint("nonprofit");
            goTo(getAuthToken() ? "account-hub" : "auth-login");
          }}
          className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5 text-left transition-colors hover:border-primary/40"
        >
          <HeartHandshake className="mt-0.5 size-6 text-primary" />
          <div>
            <p className="font-semibold">I&apos;m a Nonprofit</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Claim your profile and build a fundraising campaign.
            </p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => {
            stashRoleHint("business");
            goTo(getAuthToken() ? "account-hub" : "auth-login");
          }}
          className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5 text-left transition-colors hover:border-primary/40"
        >
          <Store className="mt-0.5 size-6 text-primary" />
          <div>
            <p className="font-semibold">I&apos;m a Business</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Claim your profile and invite a nonprofit to a specific method.
            </p>
          </div>
        </button>
      </div>
    </main>
  );
}

export function NonprofitClaim() {
  const { setNonprofitProfile, goTo, state, update, switchActiveRole } = useCampaign();
  const existing = state.nonprofitProfile;
  const isEditing = Boolean(existing?.id);
  const [phase, setPhase] = useState<"lookup" | "form">(isEditing ? "form" : "lookup");
  const [organizationName, setOrganizationName] = useState(existing?.organizationName ?? "");
  const [contactName, setContactName] = useState(existing?.contactName ?? "");
  const [contactEmail, setContactEmail] = useState(existing?.contactEmail ?? "");
  const [mission, setMission] = useState(existing?.mission ?? "");
  const [website, setWebsite] = useState("");
  const [ein, setEin] = useState("");
  const [city, setCity] = useState("");
  const [stateVal, setStateVal] = useState("");
  const [zip, setZip] = useState("");
  const [relationship, setRelationship] = useState("");
  const [existingSlug, setExistingSlug] = useState<string | undefined>();
  const [alreadyClaimed, setAlreadyClaimed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<NonprofitClaimRequestResult | null>(null);

  const applyCandidate = (candidate: OrganizationSearchCandidate) => {
    setOrganizationName(candidate.organizationName);
    setContactEmail(candidate.contactEmail ?? contactEmail);
    setMission(candidate.mission ?? mission);
    setWebsite(candidate.website ?? website);
    setEin(candidate.ein ?? "");
    setCity(candidate.city ?? "");
    setStateVal(candidate.state ?? "");
    setZip(candidate.zip ?? "");
    setExistingSlug(candidate.slug);
    setAlreadyClaimed(candidate.claimStatus === "claimed");
    setPhase("form");
  };

  const applyActiveProfile = (nonprofit: NonprofitProfile) => {
    setNonprofitProfile({
      id: nonprofit.id,
      organizationName: nonprofit.organizationName,
      contactName: nonprofit.contactName ?? nonprofit.organizationName,
      contactEmail: nonprofit.contactEmail ?? contactEmail.trim(),
      mission: nonprofit.mission ?? undefined,
      causeCategory: nonprofit.causeCategory ?? undefined,
      verificationStatus: nonprofit.verificationStatus,
      claimStatus: nonprofit.claimStatus,
    });
    update({ accountIntent: "nonprofit" });
    switchActiveRole("nonprofit", nonprofit.id);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await submitNonprofitClaimRequest({
        organizationName: organizationName.trim(),
        contactName: contactName.trim() || organizationName.trim(),
        contactEmail: contactEmail.trim(),
        mission: mission.trim() || undefined,
        website: website.trim() || undefined,
        ein: ein.trim() || undefined,
        city: city.trim() || undefined,
        state: stateVal.trim() || undefined,
        zip: zip.trim() || undefined,
        relationship: relationship.trim() || undefined,
        existingSlug,
      });

      // High-risk: organization already claimed by another user. Do NOT adopt it.
      if (result.action === "access_requested") {
        setOutcome(result);
        return;
      }

      applyActiveProfile(result.nonprofit);
      if (getAuthToken()) {
        try {
          await linkUserOrganization({
            organizationType: "nonprofit",
            organizationId: result.nonprofit.id,
            role: "admin",
          });
          await syncAuthSession("nonprofit");
        } catch {
          /* org link optional */
        }
      }

      // Medium-risk: profile saved but pending ForkUp verification.
      if (
        result.action === "claimed_pending_verification" ||
        result.action === "created_pending_verification"
      ) {
        setOutcome(result);
        return;
      }

      goTo("nonprofit-dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-lg px-5 py-10 sm:px-6">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-accent text-primary">
          <HeartHandshake className="size-5" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Organization setup</p>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {isEditing
              ? "Update your nonprofit profile"
              : phase === "lookup"
                ? "Find your organization"
                : "Confirm your organization details"}
          </h1>
        </div>
      </div>

      {outcome ? (
        <div className="mt-6">
          {outcome.action === "access_requested" ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
              <ShieldAlert className="mx-auto size-10 text-amber-600" />
              <p className="mt-4 text-lg font-bold">Access request submitted</p>
              <p className="mt-2 text-sm text-amber-800">
                {outcome.message ??
                  "This organization is already claimed. Your request has been sent to ForkUp for review."}
              </p>
              <button
                type="button"
                onClick={() => {
                  setOutcome(null);
                  setExistingSlug(undefined);
                  setAlreadyClaimed(false);
                  setPhase("lookup");
                }}
                className="mt-6 w-full rounded-full border border-border px-6 py-3 text-sm font-semibold hover:bg-secondary/60"
              >
                Search for a different organization
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-6 text-center">
              <Clock className="mx-auto size-10 text-primary" />
              <p className="mt-4 text-lg font-bold">Profile saved — verification pending</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Thanks! We&apos;ve saved{" "}
                <span className="font-medium">{outcome.nonprofit.organizationName}</span>. A ForkUp
                team member will verify your organization. You can keep setting things up now —
                launching a campaign may require verification to finish.
              </p>
              <button
                type="button"
                onClick={() => goTo("nonprofit-dashboard")}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
              >
                Continue to dashboard
                <ArrowRight className="size-4" />
              </button>
            </div>
          )}
        </div>
      ) : phase === "lookup" && !isEditing ? (
        <div className="mt-6">
          <OrganizationLookupConfirm
            onConfirm={applyCandidate}
            onManualEntry={() => setPhase("form")}
          />
        </div>
      ) : (
        <>
          <p className="mt-3 text-sm text-muted-foreground">
            {isEditing
              ? "Update your organization details. Changes apply to future campaigns."
              : "Review and complete your profile. Nothing is saved until you confirm below."}
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">Organization name</span>
              <input required value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} className={field} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">Website (optional)</span>
              <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." className={field} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">EIN / tax ID (optional)</span>
              <input value={ein} onChange={(e) => setEin(e.target.value)} placeholder="12-3456789" className={field} />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="block space-y-1.5 sm:col-span-1">
                <span className="text-sm font-semibold">City (optional)</span>
                <input value={city} onChange={(e) => setCity(e.target.value)} className={field} />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold">State</span>
                <input value={stateVal} onChange={(e) => setStateVal(e.target.value)} placeholder="PA" className={field} />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold">ZIP</span>
                <input value={zip} onChange={(e) => setZip(e.target.value)} className={field} />
              </label>
            </div>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">Contact name</span>
              <input value={contactName} onChange={(e) => setContactName(e.target.value)} className={field} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">Contact email</span>
              <input required type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={field} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">Mission (optional)</span>
              <textarea value={mission} onChange={(e) => setMission(e.target.value)} rows={3} className={field} />
            </label>
            {!isEditing && (
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold">Your role at this organization (optional)</span>
                <input
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                  placeholder="e.g. Executive Director, Board Member"
                  className={field}
                />
              </label>
            )}
            {!isEditing && alreadyClaimed && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                This organization is already claimed. Submitting will send an access request to
                ForkUp for review rather than claiming it directly.
              </p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button type="submit" disabled={loading} className="w-full rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
              {loading
                ? "Saving…"
                : isEditing
                  ? "Save changes"
                  : alreadyClaimed
                    ? "Request access"
                    : "Save profile & continue"}
            </button>
            {!isEditing && (
              <button
                type="button"
                onClick={() => setPhase("lookup")}
                className="w-full text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                ← Search by website again
              </button>
            )}
            {isEditing && (
              <button
                type="button"
                onClick={() => goTo("nonprofit-dashboard")}
                className="w-full text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Cancel — back to dashboard
              </button>
            )}
          </form>
        </>
      )}
    </main>
  );
}

export function BusinessClaim() {
  const { setBusinessProfile, goTo, state, update, switchActiveRole } = useCampaign();
  const existing = state.businessProfile;
  const isEditing = Boolean(existing?.id);

  const initialDraft = (): BusinessClaimDraft => {
    if (isEditing && existing) {
      return {
        businessName: existing.businessName,
        contactName: existing.contactName ?? "",
        contactEmail: existing.contactEmail ?? loadUserSession()?.email ?? "",
        website: "",
        locationName: existing.locationName ?? "Main Location",
        city: "",
        stateCode: "",
        supportsDine: existing.capabilities?.dineAndDonate ?? true,
        supportsShop: existing.capabilities?.shopAndDonate ?? false,
        supportsService: existing.capabilities?.serviceGiveback ?? false,
        supportsBartending: existing.capabilities?.guestBartending ?? false,
      };
    }
    const saved = loadBusinessClaimDraft();
    if (saved) return saved;
    const session = loadUserSession();
    return {
      ...defaultBusinessClaimDraft(),
      contactEmail: session?.email ?? "",
    };
  };

  const [form, setForm] = useState<BusinessClaimDraft>(initialDraft);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<BusinessClaimRequestResult | null>(null);

  const patchForm = (patch: Partial<BusinessClaimDraft>) => {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      saveBusinessClaimDraft(next);
      return next;
    });
  };

  const {
    businessName,
    contactName,
    contactEmail,
    website,
    locationName,
    city,
    stateCode,
    supportsDine,
    supportsShop,
    supportsService,
    supportsBartending,
  } = form;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await submitBusinessClaimRequest({
        businessName: businessName.trim(),
        contactName: contactName.trim() || businessName.trim(),
        contactEmail: contactEmail.trim(),
        website: website.trim() || undefined,
        locationName: locationName.trim(),
        city: city.trim() || undefined,
        state: stateCode.trim() || undefined,
        supportsDineAndDonate: supportsDine,
        supportsShopAndDonate: supportsShop,
        supportsServiceGiveback: supportsService,
        supportsGuestBartending: supportsBartending,
      });

      // High-risk: business already claimed by another user. Do NOT adopt it.
      if (result.action === "access_requested") {
        setOutcome(result);
        return;
      }

      const business = result.business;
      const loc = business.locations[0];
      if (!loc) throw new Error("No location on business profile");
      setBusinessProfile({
        id: business.id,
        businessName: business.businessName,
        contactName: business.contactName ?? contactName.trim(),
        contactEmail: business.contactEmail ?? contactEmail.trim(),
        locationId: loc.id,
        locationName: loc.locationName,
        capabilities: business.capabilities,
        claimStatus: business.claimStatus,
        businessStatus: business.businessStatus,
      });
      update({ accountIntent: "business" });
      switchActiveRole("business", business.id);
      clearBusinessClaimDraft();
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

      // Medium-risk: profile saved but pending ForkUp verification.
      if (
        result.action === "claimed_pending_verification" ||
        result.action === "created_pending_verification"
      ) {
        setOutcome(result);
        return;
      }

      goTo("business-dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save business profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-lg px-5 py-10 sm:px-6">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-accent text-primary">
          <Store className="size-5" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Business setup</p>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {isEditing ? "Update your business profile" : "Claim or create your business profile"}
          </h1>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        {isEditing
          ? "Update your business details. Changes apply to future partnerships."
          : "Confirm your business and the fundraising methods you can support. Your entries are saved as you type."}
      </p>

      {outcome ? (
        <div className="mt-6">
          {outcome.action === "access_requested" ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
              <ShieldAlert className="mx-auto size-10 text-amber-600" />
              <p className="mt-4 text-lg font-bold">Access request submitted</p>
              <p className="mt-2 text-sm text-amber-800">
                {outcome.message ??
                  "This business is already claimed. Your request has been sent to ForkUp for review."}
              </p>
              <button
                type="button"
                onClick={() => setOutcome(null)}
                className="mt-6 w-full rounded-full border border-border px-6 py-3 text-sm font-semibold hover:bg-secondary/60"
              >
                Edit business details
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-6 text-center">
              <Clock className="mx-auto size-10 text-primary" />
              <p className="mt-4 text-lg font-bold">Profile saved — verification pending</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Thanks! We&apos;ve saved{" "}
                <span className="font-medium">{outcome.business.businessName}</span>. A ForkUp team
                member will verify your business. You can keep setting things up now.
              </p>
              <button
                type="button"
                onClick={() => goTo("business-dashboard")}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
              >
                Continue to dashboard
                <ArrowRight className="size-4" />
              </button>
            </div>
          )}
        </div>
      ) : (
      <form onSubmit={submit} className="mt-8 space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">Business name</span>
          <input
            required
            value={businessName}
            onChange={(e) => patchForm({ businessName: e.target.value })}
            className={field}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">Contact name</span>
          <input
            value={contactName}
            onChange={(e) => patchForm({ contactName: e.target.value })}
            placeholder="Owner or manager name"
            className={field}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">Contact email</span>
          <input
            required
            type="email"
            value={contactEmail}
            onChange={(e) => patchForm({ contactEmail: e.target.value })}
            className={field}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">
            Website <span className="font-normal text-muted-foreground">(optional)</span>
          </span>
          <input
            type="url"
            value={website}
            onChange={(e) => patchForm({ website: e.target.value })}
            placeholder="https://yourbusiness.com"
            className={field}
          />
          <span className="text-xs text-muted-foreground">
            A contact email that matches your website domain speeds up verification.
          </span>
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">Primary location</span>
          <input
            value={locationName}
            onChange={(e) => patchForm({ locationName: e.target.value })}
            className={field}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <input
            value={city}
            onChange={(e) => patchForm({ city: e.target.value })}
            placeholder="City"
            className={field}
          />
          <input
            value={stateCode}
            onChange={(e) => patchForm({ stateCode: e.target.value })}
            placeholder="State"
            className={field}
          />
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Supported methods</legend>
          {(
            [
              ["Dine & Donate", supportsDine, (v: boolean) => patchForm({ supportsDine: v })],
              ["Shop & Donate", supportsShop, (v: boolean) => patchForm({ supportsShop: v })],
              ["Service Giveback", supportsService, (v: boolean) => patchForm({ supportsService: v })],
              ["Guest Bartending", supportsBartending, (v: boolean) => patchForm({ supportsBartending: v })],
            ] as const
          ).map(([label, checked, setter]) => (
            <label key={label} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={checked}
                onChange={(e) => setter(e.target.checked)}
              />
              {label}
            </label>
          ))}
        </fieldset>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button type="submit" disabled={loading} className="w-full rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
          {loading ? "Saving…" : "Save & invite a nonprofit"}
        </button>
      </form>
      )}
    </main>
  );
}

export function BusinessInvitesNonprofit() {
  const { state, goTo } = useCampaign();
  const biz = state.businessProfile;
  const [methodType, setMethodType] = useState("dine_and_donate");
  const [nonprofitQuery, setNonprofitQuery] = useState("");
  const [nonprofits, setNonprofits] = useState<NonprofitProfile[]>([]);
  const [selectedNp, setSelectedNp] = useState<NonprofitProfile | null>(null);
  const [message, setMessage] = useState("");
  const [giveback, setGiveback] = useState(15);
  const [loading, setLoading] = useState(false);
  const [sentLink, setSentLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const availableMethods = METHOD_OPTIONS.filter((m) => {
    if (!biz) return false;
    if (m.value === "dine_and_donate") return biz.capabilities.dineAndDonate;
    if (m.value === "shop_and_donate") return biz.capabilities.shopAndDonate;
    if (m.value === "service_giveback") return biz.capabilities.serviceGiveback;
    if (m.value === "guest_bartending_event") return biz.capabilities.guestBartending;
    return false;
  });

  useEffect(() => {
    if (availableMethods.length > 0 && !availableMethods.some((m) => m.value === methodType)) {
      setMethodType(availableMethods[0].value);
    }
  }, [availableMethods, methodType]);

  const search = async () => {
    if (!nonprofitQuery.trim()) return;
    try {
      setNonprofits(await searchNonprofits(nonprofitQuery));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!biz || !selectedNp) return;
    setError(null);
    setLoading(true);
    try {
      const result = await sendNonprofitCampaignInvite({
        businessId: biz.id,
        locationId: biz.locationId,
        nonprofitId: selectedNp.id,
        methodType,
        givebackPercentage: giveback,
        message: message.trim() || undefined,
      });
      setSentLink(result.acceptPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invitation");
    } finally {
      setLoading(false);
    }
  };

  if (!biz) {
    return (
      <main className="mx-auto max-w-lg px-5 py-12 text-center">
        <p className="text-muted-foreground">Claim your business profile first.</p>
        <button type="button" onClick={() => goTo("business-claim")} className="btn-primary mt-4 rounded-full px-6 py-3 text-sm font-semibold">
          Business claim
        </button>
      </main>
    );
  }

  if (sentLink) {
    return (
      <main className="mx-auto max-w-lg px-5 py-10 sm:px-6">
        <CheckCircle2 className="size-10 text-primary" />
        <h1 className="mt-4 text-2xl font-extrabold">Invitation sent</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Share this link with {selectedNp?.organizationName} to accept the campaign draft:
        </p>
        <p className="mt-4 break-all rounded-xl bg-secondary p-3 text-sm font-medium">{sentLink}</p>
        <button type="button" onClick={() => goTo("website-landing")} className="mt-6 text-sm font-medium text-primary">
          Back to home
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-5 py-10 sm:px-6">
      <div className="flex items-center gap-3">
        <Send className="size-6 text-primary" />
        <h1 className="text-2xl font-extrabold tracking-tight">Invite a nonprofit to a method</h1>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {biz.businessName} — {biz.locationName}. This creates a campaign draft pending nonprofit acceptance.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">Fundraising method</span>
          <select value={methodType} onChange={(e) => setMethodType(e.target.value)} className={field}>
            {availableMethods.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">Giveback %</span>
          <input type="number" min={1} max={100} value={giveback} onChange={(e) => setGiveback(Number(e.target.value))} className={field} />
        </label>

        <div className="space-y-2">
          <span className="text-sm font-semibold">Find nonprofit</span>
          <div className="flex gap-2">
            <input value={nonprofitQuery} onChange={(e) => setNonprofitQuery(e.target.value)} placeholder="Search by name" className={field} />
            <button type="button" onClick={() => void search()} className="shrink-0 rounded-full border border-border px-4 text-sm font-semibold">
              Search
            </button>
          </div>
          {nonprofits.length > 0 && (
            <ul className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-border p-2">
              {nonprofits.map((np) => (
                <li key={np.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedNp(np)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm ${selectedNp?.id === np.id ? "bg-primary/10 font-semibold" : "hover:bg-secondary"}`}
                  >
                    {np.organizationName}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">Message (optional)</span>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className={field} />
        </label>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <button
          type="submit"
          disabled={loading || !selectedNp}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Send invitation
        </button>
      </form>
    </main>
  );
}

export function NonprofitAcceptsInvite() {
  const { setNonprofitProfile, goTo, update } = useCampaign();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [invite, setInvite] = useState<NonprofitCampaignInvite | null>(null);
  const [loading, setLoading] = useState(!!token);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"accepted" | "declined" | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    void fetchNonprofitCampaignInvite(token)
      .then(setInvite)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load invitation"))
      .finally(() => setLoading(false));
  }, [token]);

  const accept = async () => {
    if (!token || !invite) return;
    setBusy(true);
    setError(null);
    try {
      const result = await acceptNonprofitCampaignInvite(token);
      setNonprofitProfile({
        id: invite.nonprofit.id,
        organizationName: invite.nonprofit.name,
        contactName: invite.nonprofit.name,
        contactEmail: invite.nonprofit.email ?? "",
      });
      update(stateFromBusinessInvite(invite, result.campaignSlug));
      try {
        window.localStorage.removeItem("forkup-campaign-draft");
      } catch {
        /* ignore */
      }
      stashRoleHint("nonprofit");
      setDone("accepted");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept");
    } finally {
      setBusy(false);
    }
  };

  const decline = async () => {
    if (!token) return;
    setBusy(true);
    try {
      await declineNonprofitCampaignInvite(token);
      setDone("declined");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to decline");
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <main className="mx-auto max-w-lg px-5 py-12 text-center text-sm text-muted-foreground">
        Missing invitation token. Open the link from your email.
      </main>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (done === "accepted") {
    const continueSetup = () => {
      stashAuthReturnStep("details");
      if (!getAuthToken()) {
        goTo("auth-login");
        return;
      }
      goTo("details");
    };

    return (
      <main className="mx-auto max-w-lg px-5 py-10 text-center">
        <CheckCircle2 className="mx-auto size-12 text-primary" />
        <h1 className="mt-4 text-2xl font-extrabold">Partnership confirmed</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          <strong>{invite?.business.name}</strong> is already set as your business partner. Finish your
          campaign details, add photos, and launch when you&apos;re ready.
        </p>
        <button
          type="button"
          onClick={continueSetup}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
        >
          Continue setup <ArrowRight className="size-4" />
        </button>
      </main>
    );
  }

  if (done === "declined") {
    return (
      <main className="mx-auto max-w-lg px-5 py-10 text-center">
        <XCircle className="mx-auto size-12 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-extrabold">Invitation declined</h1>
        <button type="button" onClick={() => goTo("website-landing")} className="mt-6 text-sm font-medium text-primary">
          Back to home
        </button>
      </main>
    );
  }

  if (!invite) {
    return (
      <main className="mx-auto max-w-lg px-5 py-12 text-center">
        <p className="text-destructive">{error ?? "Invitation not found"}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-5 py-10 sm:px-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Business partnership invitation</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        <strong>{invite.business.name}</strong> invited <strong>{invite.nonprofit.name}</strong> to run{" "}
        <strong>{invite.method.name}</strong>.
      </p>

      <div className="mt-6 space-y-3 rounded-2xl border border-border bg-card p-5 text-sm">
        <p className="font-semibold">{invite.campaign.name}</p>
        <p className="text-muted-foreground">{invite.campaign.story}</p>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" />
            {invite.location.name}, {invite.location.city}
          </span>
          <span className="inline-flex items-center gap-1">
            <Percent className="size-3.5" />
            {invite.givebackPercentage}% giveback
          </span>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          disabled={busy || invite.invitationStatus !== "pending"}
          onClick={() => void accept()}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          Accept & continue
        </button>
        <button
          type="button"
          disabled={busy || invite.invitationStatus !== "pending"}
          onClick={() => void decline()}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-border py-3 text-sm font-semibold"
        >
          <XCircle className="size-4" />
          Decline
        </button>
      </div>
    </main>
  );
}
