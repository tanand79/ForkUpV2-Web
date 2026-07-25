"use client";

import {
  AlertTriangle,
  Building2,
  Facebook,
  Globe,
  Hash,
  Instagram,
  Loader2,
  MapPin,
  Search,
  Sparkles,
} from "lucide-react";
import { useRef, useState, useEffect } from "react";
import {
  searchOrganizations,
  generateOrganizationDraft,
  type OrganizationBusinessWarning,
  type OrganizationMatchStrength,
  type OrganizationSearchCandidate,
  type OrganizationDraftResult,
} from "@/lib/api";

const field =
  "w-full rounded-xl border border-border bg-background px-4 py-3 text-sm";

type SearchMode = "name" | "website" | "ein" | "location";

const MODE_CONFIG: Record<
  SearchMode,
  { toggle: string; label: string; placeholder: string; inputType: string }
> = {
  name: {
    toggle: "By name",
    label: "Organization name",
    placeholder: "e.g. Bayside Animal Rescue",
    inputType: "text",
  },
  website: {
    toggle: "By website",
    label: "Organization website",
    placeholder: "https://yourorganization.org",
    inputType: "url",
  },
  ein: {
    toggle: "By EIN",
    label: "EIN (tax ID)",
    placeholder: "e.g. 12-3456789",
    inputType: "text",
  },
  location: {
    toggle: "By location",
    label: "City, state, or ZIP",
    placeholder: "e.g. West Chester, PA or 19380",
    inputType: "text",
  },
};

const MODE_ORDER: SearchMode[] = ["name", "website", "ein", "location"];

const STRENGTH_META: Record<
  OrganizationMatchStrength,
  { label: string; cls: string }
> = {
  strong: { label: "Strong match", cls: "bg-emerald-100 text-emerald-700" },
  partial: { label: "Possible match", cls: "bg-amber-100 text-amber-700" },
  weak: { label: "Weak match", cls: "bg-secondary text-muted-foreground" },
};

const STRENGTH_ORDER: OrganizationMatchStrength[] = ["strong", "partial", "weak"];

/**
 * Prefill for Nick's "create when not found" path.
 * May come from a simple domain guess OR a Lovable-style AI website draft.
 */
export type ManualEntryPrefill = {
  website?: string;
  organizationName?: string;
  mission?: string;
  contactName?: string;
  contactEmail?: string;
  ein?: string;
  city?: string;
  state?: string;
  location?: string;
  causeCategory?: string;
  /** Display-only org type from known profile / AI (e.g. Foundation, Nonprofit). */
  orgType?: string;
  social?: string[];
  /** True when opened from ForkUp find/AI review (Lovable “Found by ForkUp” edit screen). */
  foundByForkUp?: boolean;
};

/** Lovable Edit “Organization type” select options. */
export const ORG_TYPE_OPTIONS = [
  "Nonprofit",
  "School",
  "Team",
  "Foundation",
  "Community group",
  "Other",
] as const;

/** Suggest a display name from a website URL/domain (e.g. a2ztechnologies.com → A2ztechnologies). */
function suggestNameFromWebsite(raw: string): string {
  let host = raw.trim().toLowerCase();
  if (!host) return "";
  try {
    if (!/^https?:\/\//i.test(host)) host = `https://${host}`;
    host = new URL(host).hostname.replace(/^www\./, "");
  } catch {
    host = host
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0] ?? "";
  }
  const base = host.split(".")[0] ?? "";
  if (!base) return "";
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function normalizeWebsiteInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function prefillFromSearch(mode: SearchMode, value: string): ManualEntryPrefill {
  const trimmed = value.trim();
  if (!trimmed) return {};
  if (mode === "website") {
    return {
      website: normalizeWebsiteInput(trimmed),
      organizationName: suggestNameFromWebsite(trimmed),
    };
  }
  if (mode === "name") return { organizationName: trimmed };
  if (mode === "ein") return { ein: trimmed };
  return { city: trimmed };
}

interface OrganizationLookupConfirmProps {
  onConfirm: (candidate: OrganizationSearchCandidate) => void;
  /** Opens the create/confirm form. Optional prefill when directory search found nothing. */
  onManualEntry: (prefill?: ManualEntryPrefill) => void;
  /** Re-open the review card after Back to Review from the edit screen. */
  restoredDraft?: OrganizationDraftResult | null;
  /** Parent hides the “Find your organization” chrome while review is showing. */
  onReviewActiveChange?: (active: boolean) => void;
  /** Persist draft so Back to Review can restore the populated card. Pass null to clear. */
  onDraftCaptured?: (draft: OrganizationDraftResult | null) => void;
}

/** Split "City, ST" location strings when city/state fields are empty. */
function cityStateFromLocation(location: string | undefined): { city: string; state: string } {
  if (!location?.trim()) return { city: "", state: "" };
  const parts = location.split(",").map((p) => p.trim()).filter(Boolean);
  return { city: parts[0] ?? "", state: parts[1] ?? "" };
}

export function OrganizationLookupConfirm({
  onConfirm,
  onManualEntry,
  restoredDraft = null,
  onReviewActiveChange,
  onDraftCaptured,
}: OrganizationLookupConfirmProps) {
  const [mode, setMode] = useState<SearchMode>("website");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<OrganizationSearchCandidate[]>([]);
  const [businessWarning, setBusinessWarning] =
    useState<OrganizationBusinessWarning | null>(null);
  const [searched, setSearched] = useState(Boolean(restoredDraft));
  const [aiDraft, setAiDraft] = useState<OrganizationDraftResult | null>(restoredDraft);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  /** Ignores stale AI/search responses when the user searches again quickly. */
  const requestIdRef = useRef(0);

  useEffect(() => {
    onReviewActiveChange?.(Boolean(aiDraft) && !aiBusy);
  }, [aiDraft, aiBusy, onReviewActiveChange]);

  useEffect(() => {
    if (restoredDraft === undefined) return;
    if (restoredDraft === null) {
      // Parent cleared the draft (new search) — do not re-hydrate.
      return;
    }
    setAiDraft(restoredDraft);
    setSearched(true);
    setCandidates([]);
  }, [restoredDraft]);

  const resetResults = () => {
    setCandidates([]);
    setBusinessWarning(null);
    setError(null);
    setAiDraft(null);
    setAiError(null);
    setAiBusy(false);
    onDraftCaptured?.(null);
  };

  /**
   * Lovable: Review screen only lists what’s still needed.
   * Editable fields live on “Edit organization details” (next step).
   * Always copy every found field so the edit form is fully prefilled.
   */
  const applyAiDraftToForm = (draft: OrganizationDraftResult) => {
    const f = draft.generatedFields;
    const fromLocation = cityStateFromLocation(f.location);
    const city = f.city?.trim() || fromLocation.city;
    const state = f.state?.trim() || fromLocation.state;
    onDraftCaptured?.(draft);
    onManualEntry({
      website: (f.website?.trim() || (looksLikeWebsite(value) ? normalizeWebsiteInput(value) : "")).trim(),
      organizationName: (
        f.organizationName?.trim() ||
        (looksLikeWebsite(value) ? suggestNameFromWebsite(value) : value.trim())
      ).trim(),
      mission: (f.missionStatement?.trim() || f.about?.trim() || "").trim(),
      contactEmail: (f.contactEmail?.trim() || "").trim(),
      ein: (f.ein?.trim() || "").trim(),
      city,
      state,
      location: (f.location?.trim() || [city, state].filter(Boolean).join(", ")).trim(),
      causeCategory: (f.causeCategory?.trim() || "").trim(),
      orgType: draft.orgType?.trim() || "Nonprofit",
      social: draft.social ?? [],
      foundByForkUp: true,
    });
  };

  const looksLikeWebsite = (raw: string) =>
    /^https?:\/\//i.test(raw) || /^www\./i.test(raw) || /\.[a-z]{2,}(\/|$)/i.test(raw);

  const tryAiDraft = async (raw: string) => {
    const reqId = ++requestIdRef.current;
    setAiBusy(true);
    setAiError(null);
    setAiDraft(null);
    try {
      const trimmed = raw.trim();
      const draft = await generateOrganizationDraft(
        looksLikeWebsite(trimmed)
          ? { website: normalizeWebsiteInput(trimmed), kind: "nonprofit" }
          : { name: trimmed, kind: "nonprofit" },
      );
      if (reqId !== requestIdRef.current) return; // stale — user searched again
      setAiDraft(draft);
      onDraftCaptured?.(draft);
    } catch (err) {
      if (reqId !== requestIdRef.current) return;
      // Do not invent an empty local draft — that produced blank "AI Draft" screens.
      setAiError(
        err instanceof Error ? err.message : "Could not look up that organization.",
      );
    } finally {
      if (reqId === requestIdRef.current) setAiBusy(false);
    }
  };

  const runSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    const reqId = ++requestIdRef.current;
    setLoading(true);
    resetResults();
    try {
      const trimmed = value.trim();
      // Lovable: website input → coherent website profile review (known/AI), not directory-first.
      if (mode === "website" || looksLikeWebsite(trimmed)) {
        setSearched(true);
        try {
          const result = await searchOrganizations({ website: trimmed });
          if (reqId !== requestIdRef.current) return;
          setBusinessWarning(result.businessWarning);
          // Do NOT short-circuit on a thin directory hit — known profile / AI
          // has the coherent public details (Lovable website-review path).
        } catch {
          /* still try known/AI draft */
        }
        void tryAiDraft(trimmed);
        return;
      }

      const params =
        mode === "name"
          ? { q: trimmed }
          : mode === "ein"
            ? { ein: trimmed }
            : { location: trimmed };
      const result = await searchOrganizations(params);
      if (reqId !== requestIdRef.current) return;
      setCandidates(result.candidates);
      setBusinessWarning(result.businessWarning);
      setSearched(true);
      // Name miss → known profile / AI draft (production enhancement over Lovable sample-only).
      if (result.candidates.length === 0 && mode === "name") {
        void tryAiDraft(trimmed);
      }
    } catch (err) {
      if (reqId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : "Search failed");
      setSearched(true);
    } finally {
      if (reqId === requestIdRef.current) setLoading(false);
    }
  };

  const searchAgain = () => {
    requestIdRef.current += 1; // cancel in-flight responses
    resetResults();
    setLoading(false);
    setSearched(false);
    // Keep the query so the user can edit; force a fresh lookup next submit.
  };

  const selectMode = (m: SearchMode) => {
    if (m === mode) return;
    requestIdRef.current += 1;
    setMode(m);
    resetResults();
    setLoading(false);
    setSearched(false);
  };

  if (!searched) {
    return (
      <div>
        <p className="text-sm text-muted-foreground">
          Search the ForkUp directory by website or name. If we don&apos;t have a profile yet,
          ForkUp can draft one from the website (like Lovable) for you to review — nothing is saved
          until you confirm.
        </p>
        <div className="mt-5 flex flex-wrap gap-1 rounded-2xl border border-border p-1">
          {MODE_ORDER.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => selectMode(m)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                mode === m
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {MODE_CONFIG[m].toggle}
            </button>
          ))}
        </div>
        <form onSubmit={(e) => void runSearch(e)} className="mt-4 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">{MODE_CONFIG[mode].label}</span>
            <div className="relative">
              {mode === "name" ? (
                <Building2 className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              ) : mode === "website" ? (
                <Globe className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              ) : mode === "ein" ? (
                <Hash className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              ) : (
                <MapPin className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              )}
              <input
                required
                type={MODE_CONFIG[mode].inputType}
                placeholder={MODE_CONFIG[mode].placeholder}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className={`${field} pl-11`}
              />
            </div>
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Searching…
              </>
            ) : (
              <>
                <Search className="size-4" />
                Find organization
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => onManualEntry()}
            className="w-full text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Enter organization details manually
          </button>
        </form>
      </div>
    );
  }

  const createNew = () => onManualEntry(prefillFromSearch(mode, value));

  return (
    <div className="space-y-4">
      {businessWarning && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold">This looks like a business website</p>
            <p className="mt-1">
              That domain matches the business{" "}
              <span className="font-medium">{businessWarning.businessName}</span>. This step is for
              nonprofits — if you&apos;re a business, go back and choose the business path.
            </p>
          </div>
        </div>
      )}

      {candidates.length === 0 ? (
        <div className="space-y-4">
          {aiBusy && (
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-5 text-sm text-muted-foreground">
              <Loader2 className="size-5 animate-spin text-primary" />
              Looking up your organization…
            </div>
          )}

          {!aiBusy && aiError && (
            <p className="text-sm font-medium text-destructive">{aiError}</p>
          )}

          {/* Lovable: Review what ForkUp found */}
          {!aiBusy && aiDraft && (
            <>
              <div>
                <button
                  type="button"
                  onClick={searchAgain}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  ← Back to Find Organization
                </button>
                <h2 className="font-display mt-4 text-3xl font-bold tracking-tight">
                  Review what ForkUp found
                </h2>
                <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                  ForkUp found information from your website. Review and complete anything missing
                  before continuing.
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-start gap-3">
                  <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-secondary">
                    <Building2 className="size-7 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {aiDraft.generatedFields.organizationName || "Organization"}
                    </p>
                    {aiDraft.orgType && (
                      <p className="mt-0.5 text-xs font-medium text-emerald-700">
                        {aiDraft.orgType}
                      </p>
                    )}
                    {(aiDraft.generatedFields.website || value) && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <Globe className="size-3" />
                        {(aiDraft.generatedFields.website || value).replace(/^https?:\/\//, "")}
                      </p>
                    )}
                    {(aiDraft.generatedFields.location ||
                      [aiDraft.generatedFields.city, aiDraft.generatedFields.state]
                        .filter(Boolean)
                        .join(", ")) && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="size-3" />
                        {aiDraft.generatedFields.location ||
                          [aiDraft.generatedFields.city, aiDraft.generatedFields.state]
                            .filter(Boolean)
                            .join(", ")}
                      </p>
                    )}
                    {(aiDraft.generatedFields.missionStatement ||
                      aiDraft.generatedFields.about) && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {aiDraft.generatedFields.missionStatement ||
                          aiDraft.generatedFields.about}
                      </p>
                    )}
                    {(aiDraft.social?.length ?? 0) > 0 && (
                      <p className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {aiDraft.social!.includes("Facebook") && (
                          <span className="inline-flex items-center gap-1">
                            <Facebook className="size-3" /> Facebook
                          </span>
                        )}
                        {aiDraft.social!.includes("Instagram") && (
                          <span className="inline-flex items-center gap-1">
                            <Instagram className="size-3" /> Instagram
                          </span>
                        )}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      Source:{" "}
                      {aiDraft.provider === "known_profile"
                        ? (aiDraft.generatedFields.website || value).replace(/^https?:\/\//, "")
                        : "AI Draft — please verify"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Lovable review: Still needed is a checklist — edits happen on next screen. */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <AlertTriangle className="size-4 text-amber-500" /> Still needed
                </p>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {(aiDraft.missingFields && aiDraft.missingFields.length > 0
                    ? aiDraft.missingFields
                    : ["Primary contact name", "Primary contact email"]
                  ).map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <AlertTriangle className="size-4 shrink-0 text-amber-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => applyAiDraftToForm(aiDraft)}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
                >
                  Review &amp; Complete Profile
                </button>
                <button
                  type="button"
                  onClick={searchAgain}
                  className="inline-flex items-center justify-center rounded-full border border-border px-5 py-2.5 text-sm font-medium hover:bg-secondary/60"
                >
                  Search again
                </button>
              </div>
            </>
          )}

          {!aiBusy && !aiDraft && (
            <div className="flex flex-col items-center gap-2 pt-2 text-center">
              <p className="text-sm text-muted-foreground">
                No directory match for <span className="font-medium">{value}</span>.
              </p>
              {mode === "website" && (
                <button
                  type="button"
                  onClick={() => void tryAiDraft(value)}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
                >
                  <Sparkles className="size-4" />
                  Scan and Build Draft
                </button>
              )}
              <button
                type="button"
                onClick={createNew}
                className="text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
              >
                Enter details manually
              </button>
              <button
                type="button"
                onClick={searchAgain}
                className="text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
              >
                Search again
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            We found{" "}
            {candidates.length === 1
              ? "a possible match"
              : `${candidates.length} possible matches`}
            . Please confirm which organization is yours.
          </p>
          {STRENGTH_ORDER.map((strength) => {
            const group = candidates.filter((c) => c.matchStrength === strength);
            if (group.length === 0) return null;
            return group.map((candidate) => (
              <article
                key={candidate.id ?? candidate.slug}
                className="rounded-2xl border border-border bg-card p-5"
              >
                <div className="flex items-start gap-4">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-secondary">
                    <Building2 className="size-6 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{candidate.organizationName}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STRENGTH_META[candidate.matchStrength].cls}`}
                      >
                        {STRENGTH_META[candidate.matchStrength].label}
                      </span>
                    </div>
                    {candidate.website && (
                      <p className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground">
                        <Globe className="size-3.5" />
                        {candidate.website}
                      </p>
                    )}
                    {([candidate.city, candidate.state].filter(Boolean).join(", ") ||
                      candidate.causeCategory) && (
                      <p className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="size-3.5" />
                        {[candidate.city, candidate.state].filter(Boolean).join(", ") ||
                          candidate.causeCategory}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      Source: ForkUp directory
                      {candidate.claimStatus === "claimed" ? " · already claimed" : ""}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => onConfirm(candidate)}
                    className="flex-1 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
                  >
                    {candidate.claimStatus === "claimed"
                      ? "This is my organization — request access"
                      : "Yes, this is my organization"}
                  </button>
                  <button
                    type="button"
                    onClick={searchAgain}
                    className="flex-1 rounded-full border border-border px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-secondary/60"
                  >
                    No, search again
                  </button>
                </div>
              </article>
            ));
          })}
          <button
            type="button"
            onClick={createNew}
            className="w-full text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            None of these — create new organization
          </button>
        </>
      )}
    </div>
  );
}
