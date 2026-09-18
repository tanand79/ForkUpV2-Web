"use client";

import {
  HeartHandshake,
  Store,
  Send,
  CheckCircle2,
  Copy,
  Loader2,
  ArrowLeft,
  ArrowRight,
  XCircle,
  MapPin,
  Percent,
  Clock,
  ShieldAlert,
  Facebook,
  Instagram,
  AlertTriangle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCampaign } from "@/lib/campaign-context";
import { stateFromBusinessInvite } from "@/lib/campaign-flow";
import { syncAuthSession } from "@/lib/auth-session";
import { stashAuthReturnStep, stashRoleHint, stashClaimLockEmail } from "@/lib/campaign-auth";
import { getAuthToken } from "@/lib/auth-storage";
import { useClientMounted } from "@/lib/use-client-mounted";
import {
  acceptNonprofitCampaignInvite,
  submitBusinessClaimRequest,
  submitNonprofitClaimRequest,
  declineNonprofitCampaignInvite,
  fetchNonprofitCampaignInvite,
  linkUserOrganization,
  searchNonprofits,
  enrichUsNonprofit,
  sendNonprofitCampaignInvite,
  type NonprofitCampaignInvite,
  type NonprofitClaimRequestResult,
  type NonprofitProfile,
  type BusinessClaimRequestResult,
  type OrganizationSearchCandidate,
  type OrganizationDraftResult,
} from "@/lib/api";
import { OrganizationLookupConfirm, ORG_TYPE_OPTIONS } from "@/components/campaign/OrganizationLookupConfirm";
import { OrganizationAvatar } from "@/components/campaign/OrganizationAvatar";
import { InviteSenderSelect } from "@/components/campaign/InviteSenderSelect";
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

/**
 * Keep US ZIP as 5 digits (drop ZIP+4 / extra characters).
 * Input: raw zip string from form, draft, or directory enrichment.
 * Output: up to 5 digits, or empty string.
 */
function normalizeUsZip(value: string): string {
  return value.replace(/\D/g, "").slice(0, 5);
}

/** Lovable Edit organization details — rounded inputs (Ui/OrganizationReadiness). */
const lovableInput =
  "mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary/50";
const lovableLabel = "text-sm font-medium";
const lovableCard = "rounded-2xl border border-border bg-card p-5";
const lovablePrimaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60";
const lovableGhostBtn =
  "inline-flex items-center justify-center gap-1.5 rounded-full border border-border px-5 py-2.5 text-sm font-medium hover:bg-secondary";

const METHOD_OPTIONS = [
  { value: "dine_and_donate", label: "Dine & Donate" },
  { value: "shop_and_donate", label: "Shop & Donate" },
  { value: "service_giveback", label: "Service Giveback" },
  { value: "guest_bartending_event", label: "Guest Bartending" },
] as const;

/** Session draft so nonprofit claim form survives the sign-in redirect. */
const NONPROFIT_CLAIM_DRAFT_KEY = "forkup-nonprofit-claim-draft";

type NonprofitClaimDraft = {
  organizationName: string;
  contactName: string;
  contactEmail: string;
  mission: string;
  website: string;
  ein: string;
  city: string;
  stateVal: string;
  zip: string;
  relationship: string;
  existingSlug?: string;
  alreadyClaimed: boolean;
};

function stashNonprofitClaimDraft(draft: NonprofitClaimDraft) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(NONPROFIT_CLAIM_DRAFT_KEY, JSON.stringify(draft));
}

function consumeNonprofitClaimDraft(): NonprofitClaimDraft | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(NONPROFIT_CLAIM_DRAFT_KEY);
  sessionStorage.removeItem(NONPROFIT_CLAIM_DRAFT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as NonprofitClaimDraft;
  } catch {
    return null;
  }
}

function clearNonprofitClaimDraft() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(NONPROFIT_CLAIM_DRAFT_KEY);
}

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
  /** Remounts lookup so prior search/AI results cannot stick when returning to search. */
  const [lookupKey, setLookupKey] = useState(0);
  const [organizationName, setOrganizationName] = useState(existing?.organizationName ?? "");
  const [contactName, setContactName] = useState(existing?.contactName ?? "");
  const [contactEmail, setContactEmail] = useState(existing?.contactEmail ?? "");
  const [mission, setMission] = useState(existing?.mission ?? "");
  const [website, setWebsite] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
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
  /** Lovable “Edit organization details” after ForkUp find/AI review. */
  const [foundByForkUp, setFoundByForkUp] = useState(false);
  const [orgType, setOrgType] = useState("Nonprofit");
  const [socialLinks, setSocialLinks] = useState<string[]>([]);
  /** Keep last ForkUp draft so Back to Review restores the populated card. */
  const [savedAiDraft, setSavedAiDraft] = useState<OrganizationDraftResult | null>(null);
  const [reviewActive, setReviewActive] = useState(false);

  const returnToLookup = () => {
    clearNonprofitClaimDraft();
    setExistingSlug(undefined);
    setAlreadyClaimed(false);
    setError(null);
    setFoundByForkUp(false);
    setOrgType("Nonprofit");
    setSocialLinks([]);
    setSavedAiDraft(null);
    setReviewActive(false);
    setLookupKey((k) => k + 1);
    setPhase("lookup");
  };

  /** Back to Review keeps the ForkUp draft — does not wipe search results. */
  const backToForkUpReview = () => {
    setFoundByForkUp(false);
    setError(null);
    setPhase("lookup");
  };

  // Restore claim form after sign-in redirect (client-only; avoids SSR mismatch).
  useEffect(() => {
    if (isEditing) return;
    const draft = consumeNonprofitClaimDraft();
    if (!draft) return;
    setOrganizationName(draft.organizationName);
    setContactName(draft.contactName);
    setContactEmail(draft.contactEmail);
    setMission(draft.mission);
    setWebsite(draft.website);
    setEin(draft.ein);
    setCity(draft.city);
    setStateVal(draft.stateVal);
    setZip(normalizeUsZip(draft.zip));
    setRelationship(draft.relationship);
    setExistingSlug(draft.existingSlug);
    setAlreadyClaimed(draft.alreadyClaimed);
    setPhase("form");
  }, [isEditing]);

  const applyCandidate = (candidate: OrganizationSearchCandidate) => {
    // Replace every field so a prior org's mission/email/website cannot linger.
    setOrganizationName(candidate.organizationName);
    setContactEmail(candidate.contactEmail ?? "");
    setMission(candidate.mission ?? "");
    setWebsite(candidate.website ?? "");
    setLogoUrl(candidate.logoUrl ?? null);
    setEin(candidate.ein ?? "");
    setCity(candidate.city ?? "");
    setStateVal(candidate.state ?? "");
    setZip(normalizeUsZip(candidate.zip ?? ""));
    setExistingSlug(candidate.slug);
    setAlreadyClaimed(candidate.claimStatus === "claimed");
    setError(null);
    setPhase("form");

    // US IRS picks often lack website/logo/ZIP in ProPublica search — enrich via Every.org + detail.
    const einValue = candidate.ein?.trim();
    if (
      einValue &&
      (candidate.source === "irs_us" || !candidate.website || !candidate.logoUrl || !candidate.zip)
    ) {
      void enrichUsNonprofit({
        ein: einValue,
        organizationName: candidate.organizationName,
        city: candidate.city ?? undefined,
        state: candidate.state ?? undefined,
      })
        .then((enriched) => {
          if (enriched.website) setWebsite(enriched.website);
          if (enriched.logoUrl) setLogoUrl(enriched.logoUrl);
          if (enriched.zip) setZip(normalizeUsZip(enriched.zip));
          if (enriched.mission) setMission((prev) => prev || enriched.mission || "");
          if (enriched.city) setCity((prev) => prev || enriched.city || "");
          if (enriched.state) setStateVal((prev) => prev || enriched.state || "");
          if (enriched.organizationName) {
            setOrganizationName((prev) => prev || enriched.organizationName || "");
          }
        })
        .catch(() => {
          /* keep ProPublica fields — enrichment is best-effort */
        });
    }
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
    // Lovable parity: search/confirm is public; sign-in is required only when
    // claiming or saving the organization profile.
    if (!getAuthToken()) {
      stashNonprofitClaimDraft({
        organizationName: organizationName.trim(),
        contactName: contactName.trim(),
        contactEmail: contactEmail.trim(),
        mission: mission.trim(),
        website: website.trim(),
        ein: ein.trim(),
        city: city.trim(),
        stateVal: stateVal.trim(),
        zip: zip.trim(),
        relationship: relationship.trim(),
        existingSlug,
        alreadyClaimed,
      });
      stashRoleHint("nonprofit");
      stashAuthReturnStep("nonprofit-claim");
      if (contactEmail.trim()) stashClaimLockEmail(contactEmail.trim());
      goTo("auth-login", {
        query: { email: contactEmail.trim() || undefined, token: undefined },
      });
      return;
    }
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

      // Nick V2 flow: Claim → Organization Ready ("start") → Build Campaign.
      goTo("start");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setLoading(false);
    }
  };

  // Lovable OrganizationReadiness Shell: max-w-3xl, Playfair titles, back link.
  return (
    <main className="mx-auto max-w-3xl px-5 py-8 sm:px-6">
      {!(foundByForkUp && phase === "form" && !isEditing) && !reviewActive && (
        <div>
          {phase === "lookup" && !isEditing && (
            <button
              type="button"
              onClick={() => goTo("website-landing")}
              className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Back to Home
            </button>
          )}
          {phase === "lookup" && !isEditing ? (
            <h1 className="font-display text-3xl font-bold tracking-tight">Find your organization</h1>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-accent text-primary">
                <HeartHandshake className="size-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Organization setup</p>
                <h1 className="font-display text-3xl font-bold tracking-tight">
                  {isEditing
                    ? "Update your nonprofit profile"
                    : "Confirm your organization details"}
                </h1>
              </div>
            </div>
          )}
        </div>
      )}

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
                  returnToLookup();
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
                onClick={() => goTo("start")}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
              >
                Continue — Organization Ready
                <ArrowRight className="size-4" />
              </button>
            </div>
          )}
        </div>
      ) : phase === "lookup" && !isEditing ? (
        <div className="mt-6">
          <OrganizationLookupConfirm
            key={lookupKey}
            onConfirm={applyCandidate}
            restoredDraft={savedAiDraft}
            onReviewActiveChange={setReviewActive}
            onDraftCaptured={setSavedAiDraft}
            onManualEntry={(prefill) => {
              // Always replace fields so a previous search cannot leave stagnant data.
              const locParts = (prefill?.location ?? "")
                .split(",")
                .map((p) => p.trim())
                .filter(Boolean);
              setOrganizationName(prefill?.organizationName?.trim() ?? "");
              setWebsite(prefill?.website?.trim() ?? "");
              setLogoUrl(null);
              setMission(prefill?.mission?.trim() ?? "");
              setContactName(prefill?.contactName?.trim() ?? "");
              setContactEmail(prefill?.contactEmail?.trim() ?? "");
              setEin(prefill?.ein?.trim() ?? "");
              setCity(prefill?.city?.trim() || locParts[0] || "");
              setStateVal(prefill?.state?.trim() || locParts[1] || "");
              setZip("");
              setOrgType(() => {
                const t = (prefill?.orgType ?? "").toLowerCase();
                if (t.includes("foundation")) return "Foundation";
                if (t.includes("school")) return "School";
                if (t.includes("team") || t.includes("sport")) return "Team";
                if (t.includes("community")) return "Community group";
                if (t.includes("nonprofit") || t.includes("charity") || t.includes("rescue"))
                  return "Nonprofit";
                if (ORG_TYPE_OPTIONS.includes(prefill?.orgType as (typeof ORG_TYPE_OPTIONS)[number])) {
                  return prefill!.orgType!;
                }
                return "Nonprofit";
              });
              setSocialLinks(prefill?.social ?? []);
              setFoundByForkUp(Boolean(prefill?.foundByForkUp));
              setExistingSlug(undefined);
              setAlreadyClaimed(false);
              setError(null);
              setPhase("form");
            }}
          />
        </div>
      ) : foundByForkUp && !isEditing ? (
        /* Lovable EditOrganizationDetails: Found by ForkUp + Still needed */
        <div className="mt-2">
          <button
            type="button"
            onClick={backToForkUpReview}
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            ← Back to Review
          </button>
          <h1 className="font-display text-3xl font-bold tracking-tight">Edit organization details</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Review what ForkUp found and update anything that is missing or incorrect.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className={lovableCard}>
              <p className="flex items-center gap-2 text-sm font-semibold">
                <CheckCircle2 className="size-4 text-emerald-600" /> Found by ForkUp
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                ForkUp prefilled these from your website. Correct anything that looks wrong.
              </p>
              <div className="mt-4 space-y-4">
                <div>
                  <label className={lovableLabel}>
                    Organization name <span className="text-destructive">*</span>
                  </label>
                  <input
                    required
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    className={lovableInput}
                  />
                </div>
                <div>
                  <label className={lovableLabel}>Website</label>
                  <input
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://..."
                    className={lovableInput}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={lovableLabel}>
                      City <span className="text-destructive">*</span>
                    </label>
                    <input
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className={lovableInput}
                    />
                  </div>
                  <div>
                    <label className={lovableLabel}>
                      State <span className="text-destructive">*</span>
                    </label>
                    <input
                      required
                      value={stateVal}
                      onChange={(e) => setStateVal(e.target.value)}
                      placeholder="PA"
                      className={lovableInput}
                    />
                  </div>
                </div>
                <div>
                  <label className={lovableLabel}>Mission or short description</label>
                  <textarea
                    value={mission}
                    onChange={(e) => setMission(e.target.value)}
                    rows={3}
                    className={lovableInput}
                  />
                </div>
                {socialLinks.length > 0 && (
                  <div>
                    <label className={lovableLabel}>Social links</label>
                    <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
                      {socialLinks.includes("Facebook") && (
                        <span className="inline-flex items-center gap-1.5">
                          <Facebook className="size-3.5" /> Facebook
                        </span>
                      )}
                      {socialLinks.includes("Instagram") && (
                        <span className="inline-flex items-center gap-1.5">
                          <Instagram className="size-3.5" /> Instagram
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className={lovableCard}>
              <p className="flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle className="size-4 text-amber-500" /> Still needed
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                ForkUp couldn&apos;t find these. Add them to continue.
              </p>
              <div className="mt-4 space-y-4">
                <div>
                  <label className={lovableLabel}>
                    Organization type <span className="text-destructive">*</span>
                  </label>
                  <select
                    required
                    value={orgType}
                    onChange={(e) => setOrgType(e.target.value)}
                    className={lovableInput}
                  >
                    <option value="">Select a type</option>
                    {ORG_TYPE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={lovableLabel}>
                    Primary contact name <span className="text-destructive">*</span>
                  </label>
                  <input
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className={lovableInput}
                  />
                </div>
                <div>
                  <label className={lovableLabel}>
                    Primary contact email <span className="text-destructive">*</span>
                  </label>
                  <input
                    required
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className={lovableInput}
                  />
                </div>
                <div>
                  <label className={lovableLabel}>Your role at this organization (optional)</label>
                  <input
                    value={relationship}
                    onChange={(e) => setRelationship(e.target.value)}
                    placeholder="e.g. Executive Director, Board Member"
                    className={lovableInput}
                  />
                </div>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-wrap gap-3">
              <button type="submit" disabled={loading} className={lovablePrimaryBtn}>
                {loading ? "Saving…" : alreadyClaimed ? "Request access" : "Continue"}
                {!loading && <ArrowRight className="size-4" />}
              </button>
              <button type="button" onClick={backToForkUpReview} className={lovableGhostBtn}>
                Back to Review
              </button>
            </div>
          </form>
        </div>
      ) : (
        <>
          <p className="mt-3 text-sm text-muted-foreground">
            {isEditing
              ? "Update your organization details. Changes apply to future campaigns."
              : "Review and complete your profile. Nothing is saved until you confirm below."}
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
              <OrganizationAvatar
                className="size-14"
                organizationName={organizationName || "Organization"}
                logoUrl={logoUrl}
                website={website}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {organizationName || "Organization"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {logoUrl || website
                    ? "Profile image from public charity directory"
                    : "No public logo on file — using initials"}
                </p>
              </div>
            </div>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">
                Organization name <span className="text-destructive">*</span>
              </span>
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
                <input
                  value={zip}
                  onChange={(e) => setZip(normalizeUsZip(e.target.value))}
                  maxLength={5}
                  inputMode="numeric"
                  autoComplete="postal-code"
                  className={field}
                />
              </label>
            </div>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">Contact name</span>
              <input value={contactName} onChange={(e) => setContactName(e.target.value)} className={field} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">
                Contact email <span className="text-destructive">*</span>
              </span>
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
                onClick={returnToLookup}
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
  const mounted = useClientMounted();
  /** When signed in, Contact email is locked to the account email (not editable). */
  const lockedAccountEmail =
    mounted && getAuthToken() ? (loadUserSession()?.email?.trim() || null) : null;

  const initialDraft = (): BusinessClaimDraft => {
    const sessionEmail = loadUserSession()?.email ?? "";
    const loggedIn = Boolean(getAuthToken() && sessionEmail);
    if (isEditing && existing) {
      return {
        businessName: existing.businessName,
        contactName: existing.contactName ?? "",
        contactEmail: loggedIn ? sessionEmail : (existing.contactEmail ?? sessionEmail),
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
    if (saved) {
      return loggedIn ? { ...saved, contactEmail: sessionEmail } : saved;
    }
    return {
      ...defaultBusinessClaimDraft(),
      contactEmail: sessionEmail,
    };
  };

  const [form, setForm] = useState<BusinessClaimDraft>(initialDraft);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<BusinessClaimRequestResult | null>(null);

  useEffect(() => {
    if (!lockedAccountEmail) return;
    setForm((prev) => {
      if (prev.contactEmail === lockedAccountEmail) return prev;
      const next = { ...prev, contactEmail: lockedAccountEmail };
      saveBusinessClaimDraft(next);
      return next;
    });
  }, [lockedAccountEmail]);

  const patchForm = (patch: Partial<BusinessClaimDraft>) => {
    setForm((prev) => {
      const next = {
        ...prev,
        ...patch,
        ...(lockedAccountEmail ? { contactEmail: lockedAccountEmail } : null),
      };
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
        contactEmail: (lockedAccountEmail ?? contactEmail).trim(),
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
      {!isEditing && (
        <p className="mt-3 text-sm">
          <button
            type="button"
            onClick={() => goTo("business-ai-onboarding")}
            className="font-semibold text-primary hover:underline"
          >
            Quick setup with your website instead →
          </button>
        </p>
      )}

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
          <span className="text-sm font-semibold">
            Business name <span className="text-destructive">*</span>
          </span>
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
          <span className="text-sm font-semibold">
            Contact email <span className="text-destructive">*</span>
          </span>
          <input
            required
            type="email"
            value={lockedAccountEmail ?? contactEmail}
            onChange={(e) => {
              if (lockedAccountEmail) return;
              patchForm({ contactEmail: e.target.value });
            }}
            readOnly={Boolean(lockedAccountEmail)}
            disabled={Boolean(lockedAccountEmail)}
            aria-readonly={Boolean(lockedAccountEmail)}
            className={`${field}${lockedAccountEmail ? " cursor-not-allowed bg-muted/50 text-muted-foreground" : ""}`}
          />
          {lockedAccountEmail ? (
            <span className="text-xs text-muted-foreground">
              Uses your signed-in account email and can&apos;t be changed here.
            </span>
          ) : null}
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
  const [inviteSenderUserId, setInviteSenderUserId] = useState<number | null>(null);

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
        inviteSenderUserId: inviteSenderUserId ?? undefined,
      });
      // Absolute URL so the nonprofit can open the invite when shared outside the app.
      setSentLink(
        typeof window !== "undefined"
          ? `${window.location.origin}${result.acceptPath}`
          : result.acceptPath
      );
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
        <button
          type="button"
          onClick={() => {
            if (!sentLink) return;
            void navigator.clipboard.writeText(sentLink);
          }}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold"
        >
          <Copy className="size-3.5" />
          Copy invite link
        </button>
        <button type="button" onClick={() => goTo("website-landing")} className="mt-6 block text-sm font-medium text-primary">
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

        <InviteSenderSelect
          organizationType="business"
          organizationId={biz.id}
          value={inviteSenderUserId}
          onChange={setInviteSenderUserId}
        />

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
  const { setNonprofitProfile, goTo, update, startNewCampaign, state } = useCampaign();
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
      stashAuthReturnStep("ai-campaign-preview");
      if (!getAuthToken()) {
        goTo("auth-login");
        return;
      }
      if (
        state.aiDrafted ||
        (state.title.trim() && state.description.trim())
      ) {
        goTo("ai-campaign-preview");
        return;
      }
      startNewCampaign();
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
