"use client";

/**
 * AI flow — Find & select nonprofit (create-via-NPO / fundraisers / guests).
 *
 * Pass A — restaurant-parity quick profile (no campaign config in signup):
 * - find → confirm → hydrating (website/social/photos only) → profile
 * - nonprofit Continue → email → claim → done → nonprofit-dashboard
 * - fundraiser Continue → ai-connect-social (campaign path unchanged)
 * - Claimed in ForkUp → claimed-npo-chooser (unchanged)
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
  linkUserOrganization,
  submitNonprofitClaimRequest,
  mergeUsNonprofitEnrichment,
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
  loadAiFlowPendingOrg,
  clearAiFlowStore,
  clearAiFlowPendingOrg,
} from "@/lib/ai-campaign-flow-storage";
import {
  readNpoQuickJoinPhase,
  writeNpoQuickJoinPhase,
  clearNpoQuickJoinPhase,
} from "@/lib/npo-quick-join-session";
import {
  stashAccountIntent,
  stashAuthReturnStep,
  stashClaimLockEmail,
  stashRoleHint,
} from "@/lib/campaign-auth";
import { getAuthToken } from "@/lib/auth-storage";
import { syncAuthSession } from "@/lib/auth-session";
import {
  nearbyQueryParams,
  useBrowserLocation,
} from "@/hooks/use-browser-location";
import { SearchRadiusControl } from "@/components/campaign/SearchRadiusControl";
import {
  saveNonprofitOrgProfileSnapshot,
  persistNonprofitOrgProfileFromSnapshot,
  type NonprofitOrgProfileSnapshot,
} from "@/lib/nonprofit-org-profile";
import { resolveAiCampaignSources } from "@/lib/api-ai-campaign-flow";
import { resolveAiFlowImages } from "./resolve-ai-flow-images";
import { AiFlowShell } from "./AiFlowShell";

/** Local UI phases — restaurant join parity (no campaign steps in signup). */
type FindOrgPhase =
  | "find"
  | "confirm"
  | "hydrating"
  | "profile"
  | "email"
  | "done";

/** Profile hydrate checklist (not full campaign-idea analyze). */
const ORG_EXTRACT_CHECKLIST = [
  "Official website",
  "Social links",
  "Photos & cover images",
  "Mission & contact",
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
  const {
    update,
    goTo,
    state,
    startNewCampaign,
    setNonprofitProfile,
    switchActiveRole,
  } = useCampaign();
  /** Always start find; resume effect restores mid-join only when session phase is set. */
  const [phase, setPhase] = useState<FindOrgPhase>("find");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<OrganizationSearchCandidate | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [claimEmail, setClaimEmail] = useState("");
  const [doneAccessRequested, setDoneAccessRequested] = useState(false);
  /** Guest Join: claim manage link emailed (mirrors business Join). */
  const [claimEmailSent, setClaimEmailSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Additive: IRS pick enrich (website/social) in progress on confirm. */
  const [enriching, setEnriching] = useState(false);
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
    clearNpoQuickJoinPhase();
    clearAiFlowStore();
    clearAiFlowPendingOrg();
    setPhase("find");
    setSelected(null);
    setOrgProfile(null);
    setEditingOrgProfile(false);
    setHydrateProgressIdx(0);
    setError(null);
    setEnriching(false);
  };

  // Persist join phase for reload (never bounce into campaign ideas).
  useEffect(() => {
    writeNpoQuickJoinPhase(phase);
  }, [phase]);

  useEffect(() => {
    // Own-org organizers on Find only — never during quick-profile join.
    if (state.accountIntent === "fundraiser") return;
    if (phase !== "find") return;
    if (readNpoQuickJoinPhase()) return;
    if (state.nonprofitMemberships.length > 0) {
      startNewCampaign();
    }
  }, [
    phase,
    state.accountIntent,
    state.nonprofitMemberships.length,
    startNewCampaign,
  ]);

  /**
   * Resume mid-join after reload only when a phase was persisted.
   * Fresh "I am nonprofit" clears session first — never lands on stale done.
   */
  useEffect(() => {
    if (selected || orgProfile) return;
    const savedPhase = readNpoQuickJoinPhase();
    // Require saved phase — pending email alone must not revive a finished join.
    if (!savedPhase) return;
    const pending = loadAiFlowPendingOrg();
    if (!pending?.organizationName?.trim()) {
      clearNpoQuickJoinPhase();
      return;
    }
    const hasClaimEmail = Boolean(pending.contactEmail?.includes("@"));

    const restored: OrganizationSearchCandidate = {
      id: pending.nonprofitId && pending.nonprofitId > 0 ? pending.nonprofitId : 0,
      organizationName: pending.organizationName,
      slug: "",
      mission: pending.mission ?? null,
      website: pending.website ?? null,
      contactName: pending.contactName ?? null,
      contactEmail: pending.contactEmail ?? null,
      contactPhone: null,
      causeCategory: pending.causeCategory ?? null,
      ein: pending.ein ?? null,
      city: pending.city ?? null,
      state: pending.state ?? null,
      zip: null,
      verificationStatus: pending.verificationStatus || "unverified",
      claimStatus: pending.claimStatus || "unclaimed",
      profileStatus: "draft",
      verified: false,
      logoUrl: pending.logoUrl ?? null,
      matchStrength: "strong",
    };
    const snap: NonprofitOrgProfileSnapshot = {
      nonprofitId: restored.id > 0 ? restored.id : null,
      organizationName: pending.organizationName,
      city: pending.city?.trim() || "",
      state: pending.state?.trim() || "",
      zip: "",
      about: pending.mission?.trim() || "",
      coverUrl: pending.logoUrl ?? null,
      photoUrls: pending.logoUrl ? [pending.logoUrl] : [],
      websiteUrl: pending.website ?? null,
      facebookUrl: pending.facebookUrl ?? null,
      instagramUrl: pending.instagramUrl ?? null,
      linkedinUrl: pending.linkedinUrl ?? null,
      youtubeUrl: pending.youtubeUrl ?? null,
      phone: null,
      email: pending.contactEmail ?? null,
      causeCategory: pending.causeCategory ?? null,
      logoUrl: pending.logoUrl ?? null,
    };
    setSelected(restored);
    setOrgProfile(snap);
    if (hasClaimEmail && pending.contactEmail) {
      setClaimEmail(pending.contactEmail);
    }
    if (savedPhase === "done") {
      setPhase("done");
    } else if (savedPhase === "email" || savedPhase === "profile") {
      setPhase(savedPhase);
    } else if (savedPhase === "confirm" || savedPhase === "hydrating") {
      setPhase(savedPhase);
    }
  }, [selected, orgProfile]);

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
   * Yes → hydrating: resolve website/social (+ AI guess if needed) + gallery only.
   * Does not run campaign-idea analyze (Pass A — quick profile like restaurant).
   */
  useEffect(() => {
    if (phase !== "hydrating" || !selected || !orgProfile) return;

    const gen = ++profileHydrateGen.current;
    const seed = orgProfile;
    const website = seed.websiteUrl?.trim() || selected.website?.trim() || "";

    void (async () => {
      try {
        clearAiFlowStore();
        const sources = await resolveAiCampaignSources({
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

        const nextWebsite = sources.website?.trim() || website || null;
        const nextFacebook =
          sources.facebookUrl?.trim() || seed.facebookUrl || null;
        const nextInstagram =
          sources.instagramUrl?.trim() || seed.instagramUrl || null;
        const nextLinkedin =
          sources.linkedinUrl?.trim() || seed.linkedinUrl || null;
        const nextYoutube =
          sources.youtubeUrl?.trim() || seed.youtubeUrl || null;
        const nextTiktok =
          sources.tiktokUrl?.trim() || seed.tiktokUrl || null;
        const nextPhone = sources.phone?.trim() || seed.phone || null;
        const nextEmail = sources.email?.trim() || seed.email || null;
        const nextAbout =
          seed.about.trim() ||
          sources.mission?.trim() ||
          selected.mission?.trim() ||
          "";

        let photoUrls = seed.photoUrls;
        let coverUrl = seed.coverUrl;
        try {
          const media = await resolveAiFlowImages({
            mode: "scratch",
            limit: 10,
            websiteUrl: nextWebsite || undefined,
            facebookUrl: nextFacebook || undefined,
            instagramHandle: nextInstagram || undefined,
            linkedinUrl: nextLinkedin || undefined,
            youtubeUrl: nextYoutube || undefined,
          });
          if (gen !== profileHydrateGen.current) return;
          const urls = media.images
            .map((g) => g.url || g.storedUrl || "")
            .filter((u) => u.trim().length > 0);
          if (urls.length > 0) {
            photoUrls = urls;
            coverUrl =
              media.cover?.url?.trim() ||
              media.cover?.storedUrl?.trim() ||
              urls[0] ||
              coverUrl;
          }
        } catch {
          /* keep logo seed */
        }

        if (gen !== profileHydrateGen.current) return;

        const nextProfile: NonprofitOrgProfileSnapshot = {
          ...seed,
          organizationName:
            sources.organizationName?.trim() || seed.organizationName,
          websiteUrl: nextWebsite || seed.websiteUrl,
          facebookUrl: nextFacebook,
          instagramUrl: nextInstagram,
          linkedinUrl: nextLinkedin,
          youtubeUrl: nextYoutube,
          tiktokUrl: nextTiktok,
          phone: nextPhone,
          email: nextEmail,
          about: nextAbout || seed.about,
          city: seed.city || sources.city?.trim() || "",
          state: seed.state || sources.state?.trim() || "",
          causeCategory:
            seed.causeCategory || sources.causeCategory?.trim() || null,
          photoUrls,
          coverUrl,
        };

        saveAiFlowPendingOrg({
          organizationName: nextProfile.organizationName,
          ein: selected.ein,
          nonprofitId: selected.id > 0 ? selected.id : null,
          website: nextProfile.websiteUrl,
          facebookUrl: nextProfile.facebookUrl,
          instagramUrl: nextProfile.instagramUrl,
          linkedinUrl: nextProfile.linkedinUrl,
          youtubeUrl: nextProfile.youtubeUrl,
          mission: nextProfile.about || null,
          causeCategory: nextProfile.causeCategory,
          city: nextProfile.city || selected.city,
          state: nextProfile.state || selected.state,
          contactName: selected.contactName,
          contactEmail: nextProfile.email || selected.contactEmail,
          verificationStatus: selected.verificationStatus,
          claimStatus: selected.claimStatus,
          logoUrl: nextProfile.logoUrl || selected.logoUrl,
        });

        if (nextEmail?.includes("@")) setClaimEmail(nextEmail);

        setOrgProfile(nextProfile);
        setHydrateProgressIdx(ORG_EXTRACT_CHECKLIST.length);
        setPhase("profile");
      } catch {
        if (gen !== profileHydrateGen.current) return;
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

    // US IRS picks: verified website + social/contact (even when Every.org already has a URL).
    if (candidate.source === "irs_us" && candidate.ein) {
      setEnriching(true);
      try {
        const enriched = await enrichUsNonprofit({
          ein: candidate.ein,
          organizationName: candidate.organizationName,
          city: candidate.city ?? undefined,
          state: candidate.state ?? undefined,
        });
        if (enriched) {
          setSelected(mergeUsNonprofitEnrichment(candidate, enriched));
        }
      } catch {
        /* keep original candidate */
      } finally {
        setEnriching(false);
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
   * After profile Continue:
   * - fundraiser → existing AI campaign path (connect social)
   * - nonprofit → email → claim → dashboard (restaurant parity; no campaign config)
   */
  const continueFromOrgProfile = (
    candidate: OrganizationSearchCandidate,
    profile: NonprofitOrgProfileSnapshot,
  ) => {
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

    if (intent === "fundraiser") {
      goTo("ai-connect-social");
      return;
    }

    const seedEmail =
      profile.email?.trim() ||
      candidate.contactEmail?.trim() ||
      claimEmail.trim() ||
      "";
    if (seedEmail.includes("@")) setClaimEmail(seedEmail);
    setError(null);
    setPhase("email");
  };

  /**
   * Restaurant-parity: claim-request does NOT require login (same as business join).
   * Auth is optional after — link org if already signed in; else done → signup.
   */
  const finishNonprofitJoin = async () => {
    if (!selected || !orgProfile) {
      setError("Find your organization first.");
      setPhase("find");
      return;
    }
    const email = claimEmail.trim();
    if (!email.includes("@")) {
      setError("Enter a valid email for your dashboard.");
      setPhase("email");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      saveAiFlowPendingOrg({
        organizationName: orgProfile.organizationName,
        ein: selected.ein,
        nonprofitId: selected.id > 0 ? selected.id : null,
        website: orgProfile.websiteUrl,
        facebookUrl: orgProfile.facebookUrl,
        instagramUrl: orgProfile.instagramUrl,
        linkedinUrl: orgProfile.linkedinUrl,
        youtubeUrl: orgProfile.youtubeUrl,
        mission: orgProfile.about,
        causeCategory: orgProfile.causeCategory,
        city: orgProfile.city,
        state: orgProfile.state,
        contactName: selected.contactName || orgProfile.organizationName,
        contactEmail: email,
        verificationStatus: selected.verificationStatus,
        claimStatus: selected.claimStatus,
        logoUrl: orgProfile.logoUrl,
      });

      const result = await submitNonprofitClaimRequest({
        organizationName: orgProfile.organizationName.trim(),
        contactName:
          selected.contactName?.trim() || orgProfile.organizationName.trim(),
        contactEmail: email,
        mission: orgProfile.about.trim() || undefined,
        causeCategory: orgProfile.causeCategory || undefined,
        website: orgProfile.websiteUrl?.trim() || undefined,
        ein: selected.ein?.trim() || undefined,
        city: orgProfile.city.trim() || undefined,
        state: orgProfile.state.trim() || undefined,
        zip: orgProfile.zip.trim() || undefined,
        existingSlug: selected.slug?.trim() || undefined,
        facebookUrl: orgProfile.facebookUrl?.trim() || undefined,
        instagramUrl: orgProfile.instagramUrl?.trim() || undefined,
        linkedinUrl: orgProfile.linkedinUrl?.trim() || undefined,
        youtubeUrl: orgProfile.youtubeUrl?.trim() || undefined,
        logoUrl: orgProfile.logoUrl?.trim() || undefined,
        galleryImageUrls:
          orgProfile.photoUrls.length > 0 ? orgProfile.photoUrls : undefined,
        coverUrl: orgProfile.coverUrl?.trim() || undefined,
      });

      if (result.action === "access_requested") {
        setDoneAccessRequested(true);
        setClaimEmailSent(false);
        writeNpoQuickJoinPhase("done");
        setPhase("done");
        return;
      }

      setDoneAccessRequested(false);
      setClaimEmailSent(Boolean(result.claimEmailSent));
      const np = result.nonprofit;
      const profilePatch = {
        id: np.id,
        organizationName: np.organizationName,
        contactName: np.contactName ?? orgProfile.organizationName,
        contactEmail: np.contactEmail ?? email,
        mission: np.mission ?? orgProfile.about ?? undefined,
        causeCategory: np.causeCategory ?? orgProfile.causeCategory ?? undefined,
        verificationStatus: np.verificationStatus,
        claimStatus: np.claimStatus,
      };

      // Guest claim: set profile only — do NOT add nonprofitMemberships
      // (setNonprofitProfile would trigger startNewCampaign → campaign ideas).
      if (getAuthToken()) {
        setNonprofitProfile(profilePatch);
        update({ accountIntent: "nonprofit" });
        switchActiveRole("nonprofit", np.id);
      } else {
        update({
          accountIntent: "nonprofit",
          nonprofitProfile: profilePatch,
        });
        switchActiveRole("nonprofit", np.id);
      }
      stashRoleHint("nonprofit");

      const claimedSnapshot: NonprofitOrgProfileSnapshot = {
        ...orgProfile,
        nonprofitId: np.id,
        email,
      };
      saveNonprofitOrgProfileSnapshot(claimedSnapshot);

      // Keep pending with claimed id so post-signup link can attach ownership.
      saveAiFlowPendingOrg({
        organizationName: np.organizationName,
        ein: selected.ein,
        nonprofitId: np.id,
        website: orgProfile.websiteUrl,
        facebookUrl: orgProfile.facebookUrl,
        instagramUrl: orgProfile.instagramUrl,
        linkedinUrl: orgProfile.linkedinUrl,
        youtubeUrl: orgProfile.youtubeUrl,
        mission: orgProfile.about,
        causeCategory: orgProfile.causeCategory,
        city: orgProfile.city,
        state: orgProfile.state,
        contactName: selected.contactName || orgProfile.organizationName,
        contactEmail: email,
        verificationStatus: np.verificationStatus,
        claimStatus: np.claimStatus,
        logoUrl: orgProfile.logoUrl,
      });

      if (getAuthToken()) {
        try {
          await linkUserOrganization({
            organizationType: "nonprofit",
            organizationId: np.id,
            role: "admin",
          });
          await syncAuthSession("nonprofit");
          // Persist hydrate photos/links so View profile is not logo-only.
          await persistNonprofitOrgProfileFromSnapshot(claimedSnapshot);
        } catch {
          /* optional until they finish signup */
        }
      }

      writeNpoQuickJoinPhase("done");
      setPhase("done");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save organization profile",
      );
    } finally {
      setSubmitting(false);
    }
  };

  /** From done screen when guest: optional signup (claim mail is primary). */
  const goAuthToClaimAccount = () => {
    const email = claimEmail.trim();
    if (email.includes("@")) stashClaimLockEmail(email);
    stashRoleHint("nonprofit");
    stashAuthReturnStep("nonprofit-dashboard");
    writeNpoQuickJoinPhase("done");
    if (typeof window !== "undefined") {
      sessionStorage.setItem("forkup-auth-initial-mode", "register");
    }
    goTo("auth-login", {
      query: { email: email || undefined, token: undefined },
    });
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
  const socialFound = Boolean(
    selected?.facebookUrl?.trim() ||
      selected?.instagramUrl?.trim() ||
      selected?.linkedinUrl?.trim() ||
      selected?.youtubeUrl?.trim(),
  );
  const contactFound = Boolean(
    selected?.contactEmail?.trim() || selected?.contactPhone?.trim(),
  );

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
          setError(null);
          try {
            continueFromOrgProfile(selected, orgProfile);
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : "Could not continue with this organization.",
            );
          }
        }}
        continueLabel="Continue"
      />
    );
  }

  const shellTitle =
    phase === "done"
      ? doneAccessRequested
        ? "Access requested"
        : "You're in"
      : phase === "email"
        ? "You're ready to ForkUp!"
        : isHydrating
          ? "Analyzing your content..."
          : isConfirm
            ? "We found you!"
            : "Search and select a nonprofit";

  const shellSubtitle =
    phase === "done"
      ? doneAccessRequested
        ? "ForkUp will review your access request."
        : "Your organization profile is saved. Add campaigns anytime from your dashboard."
      : phase === "email"
        ? "Where should we send your organization dashboard?"
        : isHydrating
          ? "ForkUp is extracting signals from your public pages."
          : isConfirm
            ? "Here's what we found. Confirm to build your profile."
            : "Find the organization this campaign is for. If it’s already on ForkUp, you’ll choose how to continue.";

  return (
    <AiFlowShell
      title={shellTitle}
      subtitle={shellSubtitle}
      backStep={
        isConfirm || isHydrating || phase === "email" || phase === "done"
          ? undefined
          : backStep
      }
      onBack={
        isHydrating
          ? () => {
              profileHydrateGen.current += 1;
              setPhase("confirm");
            }
          : phase === "email"
            ? () => setPhase("profile")
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
          <p className="mt-2 text-xs text-muted-foreground">
            Tip: for common names, add a city, ZIP, or EIN (for example:{" "}
            <span className="font-medium">YMCA - 23220</span>) so we match the exact
            organization.
          </p>

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
          {enriching ? (
            <div className="flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-4 text-sm text-muted-foreground">
              <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-primary" />
              <div>
                <p className="font-medium text-foreground">
                  Verifying website and public details…
                </p>
                <p className="mt-1 text-xs">
                  This may take a minute when we research the official site from the web.
                </p>
              </div>
            </div>
          ) : null}
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
                <ConfirmCheckRow ok={socialFound} label="Social profiles found" />
                <ConfirmCheckRow ok={contactFound} label="Contact found" />
              </ul>
            </div>
          </div>

          <button
            type="button"
            disabled={busy || enriching}
            onClick={() => confirmOrganization()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-dark disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Continuing…
              </>
            ) : enriching ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Verifying…
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
            disabled={busy || enriching}
            onClick={returnToSearch}
            className="w-full text-center text-sm font-semibold text-muted-foreground hover:text-foreground disabled:opacity-60"
          >
            Not correct? Search again
          </button>
        </div>
      )}

      {phase === "email" && (
        <div className="space-y-4">
          <label className="block text-sm font-medium">
            Email
            <input
              type="email"
              className="mt-1.5 w-full rounded-xl border border-border px-3 py-2.5 text-sm"
              value={claimEmail}
              onChange={(e) => setClaimEmail(e.target.value)}
              placeholder="you@nonprofit.org"
              disabled={submitting}
            />
          </label>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void finishNonprofitJoin()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            Join ForkUp
            {!submitting && <ArrowRight className="size-4" />}
          </button>
          <p className="text-center text-xs text-muted-foreground">
            No campaign setup now — add fundraising details anytime from your
            dashboard.
          </p>
        </div>
      )}

      {phase === "done" && (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-6 text-center">
          <CheckCircle2 className="mx-auto size-10 text-primary" />
          <p className="text-sm text-muted-foreground">
            {doneAccessRequested
              ? "This organization is already claimed. ForkUp will review your access request."
              : getAuthToken()
                ? "Your organization profile is ready. Create campaigns anytime from your dashboard."
                : (
                  <>
                    Your organization profile draft is saved
                    {claimEmail.trim() ? (
                      <>
                        {" "}
                        for{" "}
                        <span className="font-medium text-foreground">
                          {claimEmail.trim()}
                        </span>
                      </>
                    ) : null}
                    .
                    {claimEmailSent || !getAuthToken() ? (
                      <>
                        {" "}
                        Check your inbox for a claim link so you can manage it on
                        any device.
                      </>
                    ) : null}
                  </>
                )}
          </p>
          {getAuthToken() ? (
            <button
              type="button"
              onClick={() => {
                clearNpoQuickJoinPhase();
                goTo("nonprofit-dashboard");
              }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
            >
              Go to dashboard
              <ArrowRight className="size-4" />
            </button>
          ) : !doneAccessRequested ? (
            <button
              type="button"
              onClick={goAuthToClaimAccount}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
            >
              Create account (optional)
              <ArrowRight className="size-4" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              clearNpoQuickJoinPhase();
              clearAiFlowPendingOrg();
              goTo("website-landing");
            }}
            className="w-full text-center text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            Back to home
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
