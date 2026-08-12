"use client";

/**
 * GoFundMe-style predictive NPO suggestions while typing.
 *
 * Purpose: Debounced lookup under a single search field — local ForkUp directory
 * first, then national US IRS matches (ProPublica). User picks one candidate;
 * parent handles confirm/claim (nothing is saved here).
 *
 * Inputs:
 * - query: current search text
 * - enabled: when false, clears suggestions (e.g. form submitting / results view)
 * - onSelect: called with the chosen OrganizationSearchCandidate
 *
 * Outputs: Renders an absolute dropdown; returns null when there is nothing to show.
 */

import { Loader2, MapPin, Globe, Hash } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  searchOrganizations,
  suggestUsNonprofits,
  type OrganizationSearchCandidate,
} from "@/lib/api";
import { OrganizationAvatar } from "@/components/campaign/OrganizationAvatar";

const MIN_CHARS = 2;
const DEBOUNCE_MS = 280;
const MAX_SUGGESTIONS = 8;

function looksLikeWebsite(raw: string) {
  return /^https?:\/\//i.test(raw) || /^www\./i.test(raw) || /\.[a-z]{2,}(\/|$)/i.test(raw);
}

function looksLikeEin(raw: string) {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 2 && digits.length <= 9 && /^[\d\-\s]+$/.test(raw.trim());
}

function looksLikeLocation(raw: string) {
  const t = raw.trim();
  if (/^\d{5}(-\d{4})?$/.test(t)) return true;
  return /^[A-Za-z][A-Za-z\s.'-]+,\s*[A-Za-z]{2}\s*$/.test(t);
}

/**
 * Split a single search box into org name + optional trailing US ZIP.
 * Examples: "YMCA - 23220", "YMCA 23220", "helping paws, 23220-1234"
 */
export function parseOrgNameAndZip(raw: string): { name: string; zip: string | null } {
  const trimmed = raw.trim();
  if (!trimmed) return { name: "", zip: null };
  const m = trimmed.match(/^(.*?)(?:\s*[-–,]\s*|\s+)(\d{5})(?:-\d{4})?\s*$/);
  if (!m?.[1]?.trim() || !m[2]) return { name: trimmed, zip: null };
  return { name: m[1].trim(), zip: m[2] };
}

/** Map free text to the existing unified search params (one list, not four modes). */
export function detectOrganizationSearchParams(raw: string): {
  q?: string;
  website?: string;
  ein?: string;
  location?: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  if (looksLikeWebsite(trimmed)) return { website: trimmed };
  if (looksLikeEin(trimmed)) return { ein: trimmed };

  const { name, zip } = parseOrgNameAndZip(trimmed);
  if (zip && name) {
    return { q: name, location: zip };
  }
  if (looksLikeLocation(trimmed)) return { location: trimmed };
  return { q: trimmed };
}

function normalizeEin(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "");
}

function normalizeName(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Merge local ForkUp hits with US IRS suggestions into one list.
 * Local rows win on EIN / name collision.
 */
export function mergeOrganizationSuggestions(
  local: OrganizationSearchCandidate[],
  us: OrganizationSearchCandidate[],
  limit = MAX_SUGGESTIONS,
): OrganizationSearchCandidate[] {
  const out: OrganizationSearchCandidate[] = [];
  const seenEin = new Set<string>();
  const seenName = new Set<string>();

  const push = (c: OrganizationSearchCandidate, source: "forkup" | "irs_us") => {
    const ein = normalizeEin(c.ein);
    const name = normalizeName(c.organizationName);
    if (ein && seenEin.has(ein)) return;
    if (name && seenName.has(name)) return;
    if (ein) seenEin.add(ein);
    if (name) seenName.add(name);
    out.push({ ...c, source: c.source ?? source });
  };

  for (const c of local) push(c, "forkup");
  for (const c of us) push(c, "irs_us");
  return out.slice(0, limit);
}

/** Extract "City, ST" → state for ProPublica state filter. */
function stateFromQuery(raw: string): string | undefined {
  const m = raw.trim().match(/,\s*([A-Za-z]{2})\s*$/);
  return m?.[1]?.toUpperCase();
}

interface OrganizationNameSuggestProps {
  query: string;
  enabled?: boolean;
  onSelect: (candidate: OrganizationSearchCandidate) => void;
  /** Optional browser GPS for ~8 mile nearby bias on local + IRS suggest. */
  nearby?: {
    lat: number;
    lng: number;
    radiusMiles?: number;
    state?: string;
    city?: string;
  } | null;
}

export function OrganizationNameSuggest({
  query,
  enabled = true,
  onSelect,
  nearby = null,
}: OrganizationNameSuggestProps) {
  const [suggestions, setSuggestions] = useState<OrganizationSearchCandidate[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const requestIdRef = useRef(0);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!enabled) {
      requestIdRef.current += 1;
      setSuggestions([]);
      setBusy(false);
      setOpen(false);
      return;
    }

    const trimmed = query.trim();
    // Website lookups use the AI/review path on submit — skip typeahead noise.
    if (trimmed.length < MIN_CHARS || looksLikeWebsite(trimmed)) {
      requestIdRef.current += 1;
      setSuggestions([]);
      setBusy(false);
      setOpen(false);
      return;
    }

    const reqId = ++requestIdRef.current;
    setBusy(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const params = detectOrganizationSearchParams(trimmed);
          const usQuery = params.q || params.ein || params.location || trimmed;
          const zipForSuggest =
            params.location && /^\d{5}$/.test(params.location)
              ? params.location
              : undefined;
          const state = stateFromQuery(params.q || trimmed) || nearby?.state;
          const geo =
            nearby != null
              ? {
                  lat: nearby.lat,
                  lng: nearby.lng,
                  radiusMiles: nearby.radiusMiles,
                }
              : {};

          const [localResult, usResult] = await Promise.all([
            searchOrganizations({ ...params, ...geo }).catch(() => null),
            suggestUsNonprofits({
              q: usQuery,
              state,
              city: nearby?.city,
              limit: MAX_SUGGESTIONS,
              zip: zipForSuggest,
              ...(nearby != null
                ? {
                    lat: nearby.lat,
                    lng: nearby.lng,
                    radiusMiles: nearby.radiusMiles,
                  }
                : {}),
            }).catch(() => null),
          ]);
          if (reqId !== requestIdRef.current) return;

          const next = mergeOrganizationSuggestions(
            localResult?.candidates ?? [],
            usResult?.candidates ?? [],
            MAX_SUGGESTIONS,
          );
          setSuggestions(next);
          setOpen(next.length > 0);
          setActiveIndex(-1);
        } catch {
          if (reqId !== requestIdRef.current) return;
          setSuggestions([]);
          setOpen(false);
        } finally {
          if (reqId === requestIdRef.current) setBusy(false);
        }
      })();
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [query, enabled, nearby?.lat, nearby?.lng, nearby?.radiusMiles, nearby?.state, nearby?.city]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!open || suggestions.length === 0) return;
      if (e.key === "Escape") {
        setOpen(false);
        setActiveIndex(-1);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
        return;
      }
      if (e.key === "Enter" && activeIndex >= 0) {
        e.preventDefault();
        e.stopPropagation();
        const pick = suggestions[activeIndex];
        if (pick) {
          setOpen(false);
          onSelect(pick);
        }
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, suggestions, activeIndex, onSelect]);

  if (!enabled) return null;
  if (!busy && suggestions.length === 0) return null;

  return (
    <div
      className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
      role="listbox"
      aria-label="Organization suggestions"
    >
      {busy && suggestions.length === 0 ? (
        <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Searching US nonprofits…
        </div>
      ) : (
        <ul ref={listRef} className="max-h-72 overflow-y-auto py-1">
          {suggestions.map((candidate, index) => {
            const locationBase =
              [candidate.city, candidate.state].filter(Boolean).join(", ") ||
              candidate.causeCategory;
            const miles =
              candidate.distanceMiles != null && Number.isFinite(candidate.distanceMiles)
                ? `${candidate.distanceMiles} mi`
                : null;
            const location = [locationBase, miles].filter(Boolean).join(" · ");
            const selected = index === activeIndex;
            const fromIrs = candidate.source === "irs_us";
            return (
              <li key={`${candidate.source ?? "forkup"}-${candidate.id || candidate.ein || candidate.slug}-${index}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onMouseDown={(e) => {
                    // Prevent input blur before click registers.
                    e.preventDefault();
                  }}
                  onClick={() => {
                    setOpen(false);
                    onSelect(candidate);
                  }}
                  className={`flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors ${
                    selected ? "bg-secondary" : "hover:bg-secondary/70"
                  }`}
                >
                  <OrganizationAvatar
                    organizationName={candidate.organizationName}
                    logoUrl={candidate.logoUrl}
                    website={candidate.website}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {candidate.organizationName}
                      </p>
                      {fromIrs && (
                        <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          US
                        </span>
                      )}
                    </div>
                    {location && (
                      <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <MapPin className="size-3 shrink-0" />
                        {location}
                      </p>
                    )}
                    {candidate.ein && (
                      <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <Hash className="size-3 shrink-0" />
                        EIN {candidate.ein}
                      </p>
                    )}
                    {candidate.website && (
                      <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <Globe className="size-3 shrink-0" />
                        {candidate.website.replace(/^https?:\/\//, "")}
                      </p>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
