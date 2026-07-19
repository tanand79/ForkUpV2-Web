"use client";

import { AlertTriangle, Building2, Globe, Hash, Loader2, MapPin, Search } from "lucide-react";
import { useState } from "react";
import {
  searchOrganizations,
  type OrganizationBusinessWarning,
  type OrganizationMatchStrength,
  type OrganizationSearchCandidate,
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

interface OrganizationLookupConfirmProps {
  onConfirm: (candidate: OrganizationSearchCandidate) => void;
  onManualEntry: () => void;
}

export function OrganizationLookupConfirm({
  onConfirm,
  onManualEntry,
}: OrganizationLookupConfirmProps) {
  const [mode, setMode] = useState<SearchMode>("name");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<OrganizationSearchCandidate[]>([]);
  const [businessWarning, setBusinessWarning] =
    useState<OrganizationBusinessWarning | null>(null);
  const [searched, setSearched] = useState(false);

  const runSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    setLoading(true);
    setError(null);
    setCandidates([]);
    setBusinessWarning(null);
    try {
      const trimmed = value.trim();
      const params =
        mode === "name"
          ? { q: trimmed }
          : mode === "website"
            ? { website: trimmed }
            : mode === "ein"
              ? { ein: trimmed }
              : { location: trimmed };
      const result = await searchOrganizations(params);
      setCandidates(result.candidates);
      setBusinessWarning(result.businessWarning);
      setSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const searchAgain = () => {
    setCandidates([]);
    setBusinessWarning(null);
    setSearched(false);
    setError(null);
  };

  if (!searched) {
    return (
      <div>
        <p className="text-sm text-muted-foreground">
          Search for your organization by name or website so we can find your profile. We&apos;ll
          ask you to confirm before anything is saved — we never auto-match your identity.
        </p>
        <div className="mt-5 flex flex-wrap gap-1 rounded-2xl border border-border p-1">
          {MODE_ORDER.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
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
            onClick={onManualEntry}
            className="w-full text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Enter organization details manually
          </button>
        </form>
      </div>
    );
  }

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
        <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
          <Building2 className="mx-auto size-10 text-muted-foreground" />
          <p className="mt-4 font-semibold">No matching organization found</p>
          <p className="mt-2 text-sm text-muted-foreground">
            We couldn&apos;t find a profile for <span className="font-medium">{value}</span>. Try a
            different search or enter your details manually.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <button type="button" onClick={searchAgain} className="btn-primary w-full">
              Search again
            </button>
            <button
              type="button"
              onClick={onManualEntry}
              className="w-full text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Enter manually
            </button>
          </div>
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
            onClick={onManualEntry}
            className="w-full text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Enter manually instead
          </button>
        </>
      )}
    </div>
  );
}
