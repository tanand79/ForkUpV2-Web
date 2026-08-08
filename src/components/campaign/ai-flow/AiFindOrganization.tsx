"use client";

/**
 * AI flow Step 2 — Find & select nonprofit (guest allowed).
 * On confirm: persist pending org → Step 3 connect-social (analyze runs on Step 4).
 */
import { useState } from "react";
import { CheckCircle2, Globe, Hash, Loader2, MapPin, ShieldCheck } from "lucide-react";
import { useCampaign } from "@/lib/campaign-context";
import {
  enrichUsNonprofit,
  type OrganizationSearchCandidate,
} from "@/lib/api";
import { OrganizationNameSuggest } from "@/components/campaign/OrganizationNameSuggest";
import { OrganizationAvatar } from "@/components/campaign/OrganizationAvatar";
import { saveAiFlowPendingOrg } from "@/lib/ai-campaign-flow-storage";
import { stashAccountIntent } from "@/lib/campaign-auth";
import { AiFlowShell } from "./AiFlowShell";

export function AiFindOrganization() {
  const { update, goTo, state } = useCampaign();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<OrganizationSearchCandidate | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSelect = async (candidate: OrganizationSearchCandidate) => {
    setSelected(candidate);
    setQuery(candidate.organizationName);
    setError(null);

    // Best-effort website enrichment for IRS rows (silently improves analyze).
    if (candidate.source === "irs_us" && candidate.ein && !candidate.website) {
      try {
        const enriched = await enrichUsNonprofit({
          ein: candidate.ein,
          organizationName: candidate.organizationName,
          city: candidate.city ?? undefined,
          state: candidate.state ?? undefined,
        });
        if (enriched?.website) {
          setSelected({ ...candidate, website: enriched.website });
        }
      } catch {
        /* keep original candidate */
      }
    }
  };

  const confirmOrganization = () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    stashAccountIntent("nonprofit");

    try {
      saveAiFlowPendingOrg({
        organizationName: selected.organizationName,
        ein: selected.ein,
        nonprofitId: selected.id > 0 ? selected.id : null,
        website: selected.website,
        facebookUrl: state.promotion.facebookUrl || null,
        instagramUrl: state.promotion.instagramHandle || null,
        linkedinUrl: null,
        mission: selected.mission,
        causeCategory: selected.causeCategory,
        city: selected.city,
        state: selected.state,
        contactName: selected.contactName,
        contactEmail: selected.contactEmail,
        verificationStatus: selected.verificationStatus,
        claimStatus: selected.claimStatus,
        logoUrl: selected.logoUrl,
      });

      update({
        accountIntent: "nonprofit",
        nonprofitProfile: {
          id: selected.id > 0 ? selected.id : undefined,
          organizationName: selected.organizationName,
          contactName: selected.contactName || "",
          contactEmail: selected.contactEmail || "",
          mission: selected.mission || undefined,
          causeCategory: selected.causeCategory || undefined,
          verificationStatus: selected.verificationStatus,
          claimStatus: selected.claimStatus,
        },
        promotion: {
          ...state.promotion,
          websiteUrl: selected.website || state.promotion.websiteUrl,
        },
        organizerMode: "guided",
        methods: {
          giveback: false,
          donations: true,
          guestBartending: false,
          ambassador: true,
        },
      });

      goTo("ai-connect-social");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not continue with this organization.");
    } finally {
      setBusy(false);
    }
  };

  const locationLabel = [selected?.city, selected?.state].filter(Boolean).join(", ");

  return (
    <AiFlowShell
      title="Search and select your nonprofit"
      subtitle="Pick your organization — next you can add social links so ForkUp can prepare campaign ideas."
      backStep="website-landing"
    >
      <div className="relative">
        <label className="mb-2 block text-sm font-semibold">Organization name</label>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(null);
          }}
          placeholder="Helping Paws Rescue"
          className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none ring-primary/30 focus:ring-2"
          disabled={busy}
        />
        <OrganizationNameSuggest
          query={query}
          enabled={!busy && !selected}
          onSelect={(c) => void onSelect(c)}
        />
      </div>

      {selected && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <OrganizationAvatar
              organizationName={selected.organizationName}
              logoUrl={selected.logoUrl}
              website={selected.website}
              className="size-12"
            />
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">{selected.organizationName}</h2>
              {locationLabel ? (
                <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="size-3.5" />
                  {locationLabel}
                </p>
              ) : null}
              {(selected.verified || selected.verificationStatus === "verified") && (
                <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                  <ShieldCheck className="size-3.5" />
                  Verified Nonprofit
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 space-y-2 text-sm text-muted-foreground">
            {selected.website ? (
              <p className="inline-flex items-center gap-2 break-all">
                <Globe className="size-3.5 shrink-0" />
                {selected.website}
              </p>
            ) : null}
            {selected.ein ? (
              <p className="inline-flex items-center gap-2">
                <Hash className="size-3.5 shrink-0" />
                EIN {selected.ein}
              </p>
            ) : null}
            {selected.mission ? (
              <p className="pt-1 text-foreground/90">
                <span className="font-semibold text-foreground">Mission · </span>
                {selected.mission}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => confirmOrganization()}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-dark disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Continuing…
              </>
            ) : (
              <>
                <CheckCircle2 className="size-4" />
                This is my organization
              </>
            )}
          </button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Next you can add social or website links. We never post without permission.
          </p>
        </div>
      )}

      {error ? (
        <p className="mt-4 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      ) : null}
    </AiFlowShell>
  );
}
