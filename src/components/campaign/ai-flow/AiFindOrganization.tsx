"use client";

/**
 * AI flow — Find & select nonprofit (create-via-NPO / fundraisers / guests).
 *
 * Phases (same screen, no new ?step=):
 * - find — search + nearby radius
 * - confirm — "We found you" card (Step 2 reference)
 * - hydrating — full analyze once (social + photos + ideas) before profile
 * - profile — org profile Edit/Continue; Continue → ai-campaign-ideas (no 2nd AI)
 *
 * On confirm (Yes, that's us):
 * - Claimed in ForkUp → claimed-npo-chooser (unchanged; skips profile)
 * - Otherwise → hydrating (analyze once) → profile → Continue → ai-campaign-ideas
 *
 * Nonprofit organizers with a membership never use this screen — they are
 * diverted into own-org AI create.
 */
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Loader2,
  MapPin,
  Pencil,
} from "lucide-react";
import { useCampaign } from "@/lib/campaign-context";
import {
  enrichUsNonprofit,
  type OrganizationSearchCandidate,
} from "@/lib/api";
import {
  OrganizationNameSuggest,
  parseOrgNameAndZip,
} from "@/components/campaign/OrganizationNameSuggest";
import { OrganizationAvatar } from "@/components/campaign/OrganizationAvatar";
import { NonprofitOrgProfile } from "@/components/campaign/NonprofitOrgProfile";
import {
  saveAiFlowPendingOrg,
  saveAiFlowStore,
  clearAiFlowStore,
} from "@/lib/ai-campaign-flow-storage";
import { stashAccountIntent } from "@/lib/campaign-auth";
import {
  nearbyQueryParams,
  useBrowserLocation,
} from "@/hooks/use-browser-location";
import { SearchRadiusControl } from "@/components/campaign/SearchRadiusControl";
import {
  saveNonprofitOrgProfileSnapshot,
  type NonprofitOrgProfileSnapshot,
} from "@/lib/nonprofit-org-profile";
import { analyzeAiCampaignFlow } from "@/lib/api-ai-campaign-flow";
import { AiFlowShell } from "./AiFlowShell";

/** Local UI phase for find → confirm → hydrating → profile (mirrors business join). */
type FindOrgPhase = "find" | "confirm" | "hydrating" | "profile";

/** Same checklist as AiAnalyzing — one full analyze run before profile. */
const ORG_EXTRACT_CHECKLIST = [
  "Organization logo",
  "Photos & cover images",
  "Mission & story",
  "Recent posts & events",
  "Past campaigns",
  "Popular themes",
];

/**
 * Geocode a US ZIP via Zippopotam (no key) so nearby search can center on it.
 * Returns null when the ZIP is invalid or the lookup fails.
 */
async function geocodeUsZipClient(
  zip: string,
): Promise<{ latitude: number; longitude: number } | null> {
  const z = zip.replace(/\D/g, "").slice(0, 5);
  if (z.length !== 5) return null;
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${z}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      places?: Array<{ latitude?: string; longitude?: string }>;
    };
    const place = data.places?.[0];
    const latitude = Number(place?.latitude);
    const longitude = Number(place?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { latitude, longitude };
  } catch {
    return null;
  }
}

function snapshotFromCandidate(
  candidate: OrganizationSearchCandidate,
  promotion: {
    facebookUrl?: string;
    instagramHandle?: string;
    websiteUrl?: string;
  },
): NonprofitOrgProfileSnapshot {
  const gallery = Array.isArray(candidate.galleryImageUrls)
    ? candidate.galleryImageUrls.filter(
        (u): u is string => typeof u === "string" && u.trim().length > 0,
      )
    : [];
  const cover =
    candidate.coverUrl?.trim() ||
    gallery[0] ||
    candidate.logoUrl?.trim() ||
    null;
  return {
    nonprofitId: candidate.id > 0 ? candidate.id : null,
    organizationName: candidate.organizationName,
    city: candidate.city?.trim() || "",
    state: candidate.state?.trim() || "",
    zip: candidate.zip?.trim() || "",
    about:
      candidate.description?.trim() ||
      candidate.mission?.trim() ||
      "",
    coverUrl: cover,
    photoUrls: gallery.length > 0 ? gallery : cover ? [cover] : [],
    websiteUrl:
      candidate.website?.trim() || promotion.websiteUrl?.trim() || null,
    facebookUrl:
      candidate.facebookUrl?.trim() || promotion.facebookUrl?.trim() || null,
    instagramUrl:
      candidate.instagramUrl?.trim() ||
      promotion.instagramHandle?.trim() ||
      null,
    linkedinUrl: candidate.linkedinUrl?.trim() || null,
    youtubeUrl: candidate.youtubeUrl?.trim() || null,
    tiktokUrl: candidate.tiktokUrl?.trim() || null,
    phone: candidate.contactPhone?.trim() || null,
    email: candidate.contactEmail?.trim() || null,
    causeCategory: candidate.causeCategory?.trim() || null,
    logoUrl: candidate.logoUrl?.trim() || null,
  };
}

export function AiFindOrganization() {
  const { update, goTo, state, startNewCampaign } = useCampaign();
  const [phase, setPhase] = useState<FindOrgPhase>("find");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<OrganizationSearchCandidate | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** On by default — nearby. Uncheck for normal national search. */
  const [useNearbyFilter, setUseNearbyFilter] = useState(true);
  const [radiusMiles, setRadiusMiles] = useState(50);
  const browserLocation = useBrowserLocation(useNearbyFilter);
  const nearby = useNearbyFilter
    ? nearbyQueryParams(browserLocation, radiusMiles)
    : undefined;
  const parsedZip = parseOrgNameAndZip(query).zip;

  /** Additive: org profile after Yes (unclaimed path only). */
  const [orgProfile, setOrgProfile] =
    useState<NonprofitOrgProfileSnapshot | null>(null);
  const [editingOrgProfile, setEditingOrgProfile] = useState(false);
  /** Animated checklist index while hydrating (AI running screen). */
  const [hydrateProgressIdx, setHydrateProgressIdx] = useState(0);
  const profileHydrateGen = useRef(0);

  /** Return to search (Edit / Search again / Back from confirm). */
  const returnToSearch = () => {
    profileHydrateGen.current += 1;
    setPhase("find");
    setSelected(null);
    setOrgProfile(null);
    setEditingOrgProfile(false);
    setHydrateProgressIdx(0);
    setError(null);
  };

  useEffect(() => {
    // Nonprofit organizers (membership) only create for their own org.
    if (state.accountIntent === "fundraiser") return;
    if (state.nonprofitMemberships.length > 0) {
      startNewCampaign();
    }
  }, [state.accountIntent, state.nonprofitMemberships.length, startNewCampaign]);

  // When query includes a ZIP (e.g. "YMCA - 23220"), center nearby on that ZIP.
  useEffect(() => {
    if (!useNearbyFilter) return;
    if (!parsedZip || parsedZip.length !== 5) return;
    let cancelled = false;
    void geocodeUsZipClient(parsedZip).then((coords) => {
      if (cancelled || !coords) return;
      browserLocation.setLocationOverride(coords);
    });
    return () => {
      cancelled = true;
    };
  }, [parsedZip, useNearbyFilter, browserLocation.setLocationOverride]);

  /** Advance checklist ticks while the AI running screen is visible. */
  useEffect(() => {
    if (phase !== "hydrating") {
      setHydrateProgressIdx(0);
      return;
    }
    if (hydrateProgressIdx >= ORG_EXTRACT_CHECKLIST.length) return;
    const tick = setTimeout(
      () => setHydrateProgressIdx((i) => i + 1),
      700,
    );
    return () => clearTimeout(tick);
  }, [phase, hydrateProgressIdx]);

  /**
   * Yes → hydrating: run full analyze ONCE (social + photos + ideas), then profile.
   * Continue skips ai-analyzing and opens campaign ideas from this session.
   */
  useEffect(() => {
    if (phase !== "hydrating" || !selected || !orgProfile) return;

    const gen = ++profileHydrateGen.current;
    const seed = orgProfile;
    const website = seed.websiteUrl?.trim() || selected.website?.trim() || "";

    void (async () => {
      try {
        clearAiFlowStore();
        const session = await analyzeAiCampaignFlow({
          organizationName:
            seed.organizationName || selected.organizationName,
          ein: selected.ein,
          nonprofitId: selected.id > 0 ? selected.id : null,
          website: website || null,
          facebookUrl: seed.facebookUrl || null,
          instagramUrl: seed.instagramUrl || null,
          linkedinUrl: seed.linkedinUrl || null,
          youtubeUrl: seed.youtubeUrl || null,
          mission: seed.about || selected.mission || null,
          causeCategory: seed.causeCategory || selected.causeCategory || null,
          city: seed.city || selected.city || null,
          state: seed.state || selected.state || null,
        });
        if (gen !== profileHydrateGen.current) return;

        const analysis = session.analysis;
        const nextWebsite =
          session.website?.trim() ||
          analysis?.website?.trim() ||
          website ||
          null;
        const nextFacebook =
          session.facebookUrl?.trim() ||
          analysis?.facebookUrl?.trim() ||
          seed.facebookUrl ||
          null;
        const nextInstagram =
          session.instagramUrl?.trim() ||
          analysis?.instagramUrl?.trim() ||
          seed.instagramUrl ||
          null;
        const nextLinkedin =
          session.linkedinUrl?.trim() ||
          analysis?.linkedinUrl?.trim() ||
          seed.linkedinUrl ||
          null;
        const nextYoutube =
          analysis?.youtubeUrl?.trim() || seed.youtubeUrl || null;
        const nextAbout =
          seed.about.trim() ||
          analysis?.mission?.trim() ||
          selected.mission?.trim() ||
          "";

        const photoUrls = (analysis?.images || [])
          .map((img) => (typeof img.url === "string" ? img.url.trim() : ""))
          .filter(Boolean);
        const coverUrl = photoUrls[0] || seed.coverUrl;

        saveAiFlowStore({
          sessionToken: session.sessionToken,
          organizationName:
            session.organizationName || seed.organizationName,
          nonprofitId:
            selected.id > 0
              ? selected.id
              : session.nonprofitId && session.nonprofitId > 0
                ? session.nonprofitId
                : null,
          selectedIdeaId: null,
          guestContinued: false,
        });

        saveAiFlowPendingOrg({
          organizationName:
            session.organizationName || seed.organizationName,
          ein: session.ein || selected.ein,
          nonprofitId: selected.id > 0 ? selected.id : null,
          website: nextWebsite,
          facebookUrl: nextFacebook,
          instagramUrl: nextInstagram,
          linkedinUrl: nextLinkedin,
          youtubeUrl: nextYoutube,
          mission: nextAbout || null,
          causeCategory: seed.causeCategory || selected.causeCategory,
          city: seed.city || selected.city,
          state: seed.state || selected.state,
          contactName: selected.contactName,
          contactEmail: seed.email || selected.contactEmail,
          verificationStatus: selected.verificationStatus,
          claimStatus: selected.claimStatus,
          logoUrl: seed.logoUrl || selected.logoUrl,
        });

        setOrgProfile({
          ...seed,
          organizationName:
            session.organizationName?.trim() || seed.organizationName,
          websiteUrl: nextWebsite || seed.websiteUrl,
          facebookUrl: nextFacebook,
          instagramUrl: nextInstagram,
          linkedinUrl: nextLinkedin,
          youtubeUrl: nextYoutube,
          about: nextAbout || seed.about,
          city: seed.city || analysis?.city?.trim() || "",
          state: seed.state || analysis?.state?.trim() || "",
          causeCategory:
            seed.causeCategory || analysis?.causeCategory?.trim() || null,
          photoUrls: photoUrls.length > 0 ? photoUrls : seed.photoUrls,
          coverUrl,
        });
        setHydrateProgressIdx(ORG_EXTRACT_CHECKLIST.length);
        setPhase("profile");
      } catch {
        if (gen !== profileHydrateGen.current) return;
        // Still open profile with IRS/logo seed so the flow never stalls.
        setPhase("profile");
      }
    })();

    return () => {
      profileHydrateGen.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per Yes → hydrating
  }, [phase, selected?.id, selected?.organizationName, selected?.website]);

  const onSelect = async (candidate: OrganizationSearchCandidate) => {
    setSelected(candidate);
    setQuery(candidate.organizationName);
    setError(null);
    setPhase("confirm");

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

  /** Existing claimed-org path — unchanged (chooser, no profile screen). */
  const continueAsClaimedOrg = (candidate: OrganizationSearchCandidate) => {
    clearAiFlowStore();
    saveAiFlowPendingOrg({
      organizationName: candidate.organizationName,
      ein: candidate.ein,
      nonprofitId: candidate.id > 0 ? candidate.id : null,
      website: candidate.website,
      facebookUrl: state.promotion.facebookUrl || null,
      instagramUrl: state.promotion.instagramHandle || null,
      linkedinUrl: null,
      mission: candidate.mission,
      causeCategory: candidate.causeCategory,
      city: candidate.city,
      state: candidate.state,
      contactName: candidate.contactName,
      contactEmail: candidate.contactEmail,
      verificationStatus: candidate.verificationStatus,
      claimStatus: candidate.claimStatus,
      logoUrl: candidate.logoUrl,
    });
    update({
      nonprofitProfile: {
        id: candidate.id,
        organizationName: candidate.organizationName,
        contactName: candidate.contactName || "",
        contactEmail: candidate.contactEmail || "",
        mission: candidate.mission || undefined,
        causeCategory: candidate.causeCategory || undefined,
        verificationStatus: candidate.verificationStatus,
        claimStatus: candidate.claimStatus,
      },
      promotion: {
        ...state.promotion,
        websiteUrl: candidate.website || state.promotion.websiteUrl,
      },
    });
    goTo("claimed-npo-chooser");
  };

  /**
   * Unclaimed path after profile: keep the hydrate session (do not re-analyze).
   * Continue → campaign ideas list.
   */
  const continueFromOrgProfile = (
    candidate: OrganizationSearchCandidate,
    profile: NonprofitOrgProfileSnapshot,
  ) => {
    // Refresh pending with any Edit/Done profile tweaks — keep sessionToken.
    saveAiFlowPendingOrg({
      organizationName: profile.organizationName || candidate.organizationName,
      ein: candidate.ein,
      nonprofitId: candidate.id > 0 ? candidate.id : null,
      website: profile.websiteUrl || candidate.website,
      facebookUrl: profile.facebookUrl || null,
      instagramUrl: profile.instagramUrl || null,
      linkedinUrl: profile.linkedinUrl || null,
      youtubeUrl: profile.youtubeUrl || null,
      mission: profile.about || candidate.mission,
      causeCategory: profile.causeCategory || candidate.causeCategory,
      city: profile.city || candidate.city,
      state: profile.state || candidate.state,
      contactName: candidate.contactName,
      contactEmail: profile.email || candidate.contactEmail,
      verificationStatus: candidate.verificationStatus,
      claimStatus: candidate.claimStatus,
      logoUrl: profile.logoUrl || candidate.logoUrl,
    });

    const intent =
      state.accountIntent === "fundraiser" ? "fundraiser" : "nonprofit";
    stashAccountIntent(intent);

    update({
      accountIntent: intent,
      nonprofitProfile: {
        id: candidate.id > 0 ? candidate.id : undefined,
        organizationName:
          profile.organizationName || candidate.organizationName,
        contactName: candidate.contactName || "",
        contactEmail: profile.email || candidate.contactEmail || "",
        mission: profile.about || candidate.mission || undefined,
        causeCategory:
          profile.causeCategory || candidate.causeCategory || undefined,
        verificationStatus: candidate.verificationStatus,
        claimStatus: candidate.claimStatus,
      },
      promotion: {
        ...state.promotion,
        websiteUrl:
          profile.websiteUrl ||
          candidate.website ||
          state.promotion.websiteUrl,
        facebookUrl:
          profile.facebookUrl || state.promotion.facebookUrl || "",
        instagramHandle:
          profile.instagramUrl || state.promotion.instagramHandle || "",
      },
      organizerMode: "guided",
      methods: {
        giveback: false,
        donations: true,
        guestBartending: false,
        ambassador: true,
      },
    });

    if (profile.nonprofitId != null && profile.nonprofitId > 0) {
      saveNonprofitOrgProfileSnapshot(profile);
    }

    // Session already created in hydrating — skip second AI run.
    goTo("ai-campaign-ideas");
  };

  const confirmOrganization = () => {
    if (!selected) return;
    setBusy(true);
    setError(null);

    try {
      const claimedInForkUp =
        selected.id > 0 &&
        String(selected.claimStatus || "")
          .trim()
          .toLowerCase() === "claimed";

      // Pass 1: claimed orgs never auto-own — chooser (unchanged).
      if (claimedInForkUp) {
        continueAsClaimedOrg(selected);
        return;
      }

      // Additive: AI running screen, then org profile (business analyzing parity).
      const snapshot = snapshotFromCandidate(selected, state.promotion);
      setOrgProfile(snapshot);
      setEditingOrgProfile(false);
      setHydrateProgressIdx(0);
      setPhase("hydrating");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not continue with this organization.",
      );
    } finally {
      setBusy(false);
    }
  };

  const locationLabel = [selected?.city, selected?.state]
    .filter(Boolean)
    .join(", ");
  const websiteFound = Boolean(selected?.website?.trim());
  const locationFound = Boolean(selected?.city || selected?.state);
  const logoFound = Boolean(selected?.logoUrl?.trim());

  // Nonprofit Create Campaign: Back returns to dashboard (not public landing).
  const backStep =
    state.accountIntent !== "fundraiser" &&
    state.nonprofitMemberships.length > 0
      ? "nonprofit-dashboard"
      : "website-landing";

  const isConfirm = phase === "confirm" && selected;
  const isHydrating = phase === "hydrating";
  const hydratePct = Math.min(
    100,
    Math.round(
      ((hydrateProgressIdx + 0.5) / ORG_EXTRACT_CHECKLIST.length) * 100,
    ),
  );

  if (phase === "profile" && orgProfile && selected) {
    return (
      <NonprofitOrgProfile
        profile={orgProfile}
        editing={editingOrgProfile}
        onToggleEdit={() => setEditingOrgProfile((v) => !v)}
        onChange={(patch) => {
          setOrgProfile((prev) => (prev ? { ...prev, ...patch } : prev));
        }}
        onBack={() => {
          setEditingOrgProfile(false);
          setPhase("confirm");
        }}
        backLabel="Back"
        onContinue={() => {
          setEditingOrgProfile(false);
          setBusy(true);
          setError(null);
          try {
            continueFromOrgProfile(selected, orgProfile);
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : "Could not continue with this organization.",
            );
            setBusy(false);
          }
        }}
        continueLabel="Continue"
      />
    );
  }

  return (
    <AiFlowShell
      title={
        isHydrating
          ? "Analyzing your content..."
          : isConfirm
            ? "We found you!"
            : "Search and select a nonprofit"
      }
      subtitle={
        isHydrating
          ? "ForkUp is extracting signals from your public pages."
          : isConfirm
            ? "Here's what we found. We'll use this to build your campaign."
            : "Find the organization this campaign is for. If it’s already on ForkUp, you’ll choose how to continue."
      }
      backStep={isConfirm || isHydrating ? undefined : backStep}
      onBack={
        isHydrating
          ? () => {
              profileHydrateGen.current += 1;
              setPhase("confirm");
            }
          : isConfirm
            ? returnToSearch
            : undefined
      }
    >
      {isHydrating ? (
        <div className="space-y-4">
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${Math.max(8, hydratePct)}%` }}
            />
          </div>
          <p className="mt-2 text-sm font-semibold">AI is extracting:</p>
          <div className="space-y-2.5">
            {ORG_EXTRACT_CHECKLIST.map((label, i) => {
              const done = i < hydrateProgressIdx;
              const current =
                i === hydrateProgressIdx &&
                hydrateProgressIdx < ORG_EXTRACT_CHECKLIST.length;
              return (
                <div
                  key={label}
                  className={`flex items-center gap-2.5 rounded-xl border p-3 text-sm transition-colors ${
                    done
                      ? "border-emerald-300/60 bg-emerald-50/60"
                      : current
                        ? "border-primary/40 bg-primary/5"
                        : "border-border bg-secondary/30 opacity-60"
                  }`}
                >
                  {done ? (
                    <CheckCircle2 className="size-4 text-emerald-600" />
                  ) : current ? (
                    <Loader2 className="size-4 animate-spin text-primary" />
                  ) : (
                    <Circle className="size-4 text-muted-foreground" />
                  )}
                  <span>{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      {phase === "find" && (
        <>
          <div className="relative">
            <label className="mb-2 block text-sm font-semibold">
              Organization name
            </label>
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelected(null);
              }}
              placeholder="YMCA - 23220"
              className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none ring-primary/30 focus:ring-2"
              disabled={busy}
            />
            <OrganizationNameSuggest
              query={query}
              enabled={!busy}
              onSelect={(c) => void onSelect(c)}
              nearby={nearby ?? null}
            />
          </div>

          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={useNearbyFilter}
              onChange={(e) => {
                const on = e.target.checked;
                setUseNearbyFilter(on);
                setSelected(null);
                if (!on) browserLocation.setLocationOverride(null);
              }}
              className="size-4 rounded border-border accent-primary text-primary"
              style={{ accentColor: "var(--color-primary, #A65A3A)" }}
            />
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-3.5 text-muted-foreground" />
              Search near my location
            </span>
          </label>

          <SearchRadiusControl
            enabled={useNearbyFilter}
            valueMiles={radiusMiles}
            onChange={(miles) => {
              setRadiusMiles(miles);
              setSelected(null);
            }}
            latitude={browserLocation.latitude}
            longitude={browserLocation.longitude}
          />
        </>
      )}

      {isConfirm && selected && (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="relative flex h-40 items-center justify-center bg-muted/40">
              {selected.logoUrl ? (
                <img
                  src={selected.logoUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <OrganizationAvatar
                  organizationName={selected.organizationName}
                  logoUrl={selected.logoUrl}
                  website={selected.website}
                  className="size-20"
                />
              )}
              <button
                type="button"
                onClick={returnToSearch}
                className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-border bg-card/95 px-3 py-1 text-xs font-semibold text-foreground shadow-sm hover:bg-card"
              >
                <Pencil className="size-3" />
                Edit
              </button>
            </div>
            <div className="space-y-2 p-5">
              <h2 className="text-lg font-bold tracking-tight">
                {selected.organizationName}
              </h2>
              {locationLabel ? (
                <p className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="size-3.5" />
                  {locationLabel}
                </p>
              ) : null}
              <ul className="mt-3 space-y-1.5 text-sm">
                <ConfirmCheckRow ok={websiteFound} label="Website found" />
                <ConfirmCheckRow ok={locationFound} label="Location found" />
                <ConfirmCheckRow ok={logoFound} label="Logo found" />
              </ul>
            </div>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => confirmOrganization()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-dark disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Continuing…
              </>
            ) : (
              <>
                Yes, that&apos;s us
                <ArrowRight className="size-4" />
              </>
            )}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={returnToSearch}
            className="w-full text-center text-sm font-semibold text-muted-foreground hover:text-foreground disabled:opacity-60"
          >
            Not correct? Search again
          </button>
        </div>
      )}

      {error ? (
        <p className="mt-4 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </AiFlowShell>
  );
}

/**
 * Checklist row for the confirm ("We found you") card.
 * Inputs: ok (whether the signal was found), label.
 * Output: list item with check icon styling.
 */
function ConfirmCheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <CheckCircle2
        className={`size-4 ${ok ? "text-emerald-600" : "text-muted-foreground/40"}`}
      />
      <span className={ok ? "text-foreground" : "text-muted-foreground"}>
        {label}
      </span>
    </li>
  );
}
