"use client";

import { Building2, Globe, Loader2, MapPin, Search } from "lucide-react";
import { useState } from "react";
import { lookupOrganizationByWebsite, type OrganizationLookupCandidate } from "@/lib/api";

const field =
  "w-full rounded-xl border border-border bg-background px-4 py-3 text-sm";

interface OrganizationLookupConfirmProps {
  onConfirm: (candidate: OrganizationLookupCandidate) => void;
  onManualEntry: () => void;
}

export function OrganizationLookupConfirm({
  onConfirm,
  onManualEntry,
}: OrganizationLookupConfirmProps) {
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<OrganizationLookupCandidate[]>([]);
  const [searched, setSearched] = useState(false);

  const runLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!website.trim()) return;
    setLoading(true);
    setError(null);
    setCandidates([]);
    try {
      const result = await lookupOrganizationByWebsite(website.trim());
      setCandidates(result.candidates);
      setSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  };

  const searchAgain = () => {
    setCandidates([]);
    setSearched(false);
    setError(null);
  };

  if (!searched) {
    return (
      <div>
        <p className="text-sm text-muted-foreground">
          Enter your organization&apos;s website so we can find your profile. We&apos;ll ask you to
          confirm before anything is saved — we never auto-match your identity.
        </p>
        <form onSubmit={(e) => void runLookup(e)} className="mt-6 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Organization website</span>
            <div className="relative">
              <Globe className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                required
                type="url"
                placeholder="https://yourorganization.org"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
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
                Looking up…
              </>
            ) : (
              <>
                <Search className="size-4" />
                Look up organization
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

  if (candidates.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
        <Building2 className="mx-auto size-10 text-muted-foreground" />
        <p className="mt-4 font-semibold">No matching organization found</p>
        <p className="mt-2 text-sm text-muted-foreground">
          We couldn&apos;t find a profile for <span className="font-medium">{website}</span>.
          Try a different URL or enter your details manually.
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
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        We found {candidates.length === 1 ? "a possible match" : `${candidates.length} possible matches`}.
        Please confirm which organization is yours.
      </p>
      {candidates.map((candidate) => (
        <article
          key={candidate.id ?? candidate.slug}
          className="rounded-2xl border border-border bg-card p-5"
        >
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-secondary">
              {candidate.logoUrl ? (
                <img
                  src={candidate.logoUrl}
                  alt=""
                  className="size-full rounded-xl object-cover"
                />
              ) : (
                <Building2 className="size-6 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{candidate.organizationName}</p>
              {candidate.website && (
                <p className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground">
                  <Globe className="size-3.5" />
                  {candidate.website}
                </p>
              )}
              {candidate.location && (
                <p className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="size-3.5" />
                  {candidate.location}
                </p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Data source: {candidate.dataSource === "forkup_database" ? "ForkUp directory" : candidate.dataSource}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => onConfirm(candidate)}
              className="flex-1 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Yes, this is my organization
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
      ))}
      <button
        type="button"
        onClick={onManualEntry}
        className="w-full text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        Enter manually instead
      </button>
    </div>
  );
}
