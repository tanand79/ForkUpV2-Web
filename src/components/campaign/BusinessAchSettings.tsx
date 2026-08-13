/**
 * BusinessAchSettings — standalone ACH settings page for a signed-in business.
 *
 * Purpose: let the business view masked ACH-on-file status and update bank details
 * per location, without needing the invite-accept screen.
 *
 * Inputs: active businessProfile from campaign context; locations discovered from
 * business collaborations (unique location.id) with fallback to profile.locationId.
 * Outputs: reuses BusinessLocationAchForm → existing GET/POST location ACH APIs.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Landmark, Loader2 } from "lucide-react";
import { useCampaign } from "@/lib/campaign-context";
import { getAuthToken } from "@/lib/auth-storage";
import {
  fetchBusinessCollaborations,
  type BusinessCollaboration,
} from "@/lib/api";
import { BusinessLocationAchForm } from "@/components/campaign/BusinessLocationAchForm";
import { AuthLogin } from "@/components/campaign/AuthLogin";

type AchLocationRow = {
  id: number;
  name: string;
  city: string;
  state: string;
};

function uniqueLocationsFromCollabs(collabs: BusinessCollaboration[]): AchLocationRow[] {
  const byId = new Map<number, AchLocationRow>();
  for (const c of collabs) {
    const id = c.location.id;
    if (id == null || !Number.isFinite(id) || id <= 0) continue;
    if (byId.has(id)) continue;
    byId.set(id, {
      id,
      name: c.location.name || "Location",
      city: c.location.city || "",
      state: c.location.state || "",
    });
  }
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function BusinessAchSettings() {
  const { goTo, state } = useCampaign();
  const biz = state.businessProfile;
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collabLocations, setCollabLocations] = useState<AchLocationRow[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isSignedIn = mounted && Boolean(getAuthToken());

  useEffect(() => {
    if (!mounted || !biz?.id || !getAuthToken()) {
      setLoading(false);
      setCollabLocations([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchBusinessCollaborations(biz.id)
      .then((rows) => {
        if (cancelled) return;
        setCollabLocations(uniqueLocationsFromCollabs(rows));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load locations");
        setCollabLocations([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [biz?.id, mounted]);

  const locations = useMemo(() => {
    if (collabLocations.length > 0) return collabLocations;
    if (biz?.locationId) {
      return [
        {
          id: biz.locationId,
          name: biz.locationName || "Primary location",
          city: "",
          state: "",
        },
      ];
    }
    return [];
  }, [collabLocations, biz?.locationId, biz?.locationName]);

  if (!mounted) {
    return (
      <main className="mx-auto max-w-xl px-5 py-10 sm:px-6">
        <div className="mb-6 h-5 w-40 animate-pulse rounded bg-muted" />
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-3 h-4 w-full max-w-md animate-pulse rounded bg-muted" />
        <div className="mt-10 flex justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      </main>
    );
  }

  if (!isSignedIn) {
    return (
      <main className="mx-auto max-w-xl px-5 py-10 sm:px-6">
        <button
          type="button"
          onClick={() => goTo("business-dashboard")}
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to business dashboard
        </button>
        <h1 className="text-2xl font-extrabold tracking-tight">ACH settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in with your business account to view or update settlement bank details.
        </p>
        <div className="mt-6">
          <AuthLogin intent="business" onSuccess={() => goTo("ach-settings")} />
        </div>
      </main>
    );
  }

  if (!biz) {
    return (
      <main className="mx-auto max-w-xl px-5 py-10 sm:px-6">
        <button
          type="button"
          onClick={() => goTo("business-dashboard")}
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to business dashboard
        </button>
        <h1 className="text-2xl font-extrabold tracking-tight">ACH settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Claim or select a business profile first, then manage ACH for its locations.
        </p>
        <button type="button" onClick={() => goTo("business-claim")} className="btn-primary mt-6">
          Go to business claim
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-5 py-10 sm:px-6">
      <button
        type="button"
        onClick={() => goTo("business-dashboard")}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to business dashboard
      </button>

      <div className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
        <Landmark className="size-4" />
        Settlement
      </div>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight">ACH settings</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Bank details for <span className="font-medium text-foreground">{biz.businessName}</span>.
        Routing and account numbers are encrypted before storage. ForkUp does not debit from this
        screen.
      </p>

      {loading && (
        <div className="mt-10 flex justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      )}

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      {!loading && locations.length === 0 && (
        <p className="mt-8 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No locations found yet. Accept a campaign invite or finish setting up your business
          location, then return here.
        </p>
      )}

      {!loading &&
        locations.map((loc) => (
          <section key={loc.id} className="mt-6">
            <h2 className="text-sm font-semibold">
              {loc.name}
              {(loc.city || loc.state) && (
                <span className="font-normal text-muted-foreground">
                  {" "}
                  · {[loc.city, loc.state].filter(Boolean).join(", ")}
                </span>
              )}
            </h2>
            <BusinessLocationAchForm
              locationId={loc.id}
              defaultAuthorizedBy={biz.contactName || biz.businessName}
              defaultAuthorizedEmail={biz.contactEmail}
            />
          </section>
        ))}
    </main>
  );
}
