"use client";

/**
 * Pass D2 — Restaurant / Local Business 4-step giveback join (mockup).
 *
 * Steps: (1) Find by name or website → (2) Confirm found → (3) Giveback + cause → (4) Email.
 * Inputs: Join Us door hint (restaurant | local). Outputs: claim-request profile draft.
 * One field accepts business name or website URL; both stay in this flow.
 */
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  DollarSign,
  Gift,
  Loader2,
  Pencil,
  Percent,
  Sparkles,
  Store,
  Utensils,
} from "lucide-react";
import { useCampaign } from "@/lib/campaign-context";
import {
  findBusinessProfile,
  generateBusinessDraft,
  fetchBusinessVenueImages,
  type BusinessDraftApiResult,
  type FindBusinessProfileResult,
} from "@/lib/api-business-onboarding";
import { submitBusinessClaimRequest, linkUserOrganization } from "@/lib/api";
import { fetchCampaigns } from "@/lib/api";
import type { CampaignListItem } from "@/lib/campaign-types";
import { campaignHasEnded } from "@/components/campaign/CampaignDatePicker";
import { getAuthToken } from "@/lib/auth-storage";
import { loadUserSession, syncAuthSession } from "@/lib/auth-session";
import { stashRoleHint, prepareBusinessJoinAuth, prepareExistingBusinessPartnerJoinAuth, stashClaimLockEmail } from "@/lib/campaign-auth";
import { useClientMounted } from "@/lib/use-client-mounted";
import {
  businessDoorRoleLabel,
  readBusinessDoor,
  type BusinessDoor,
} from "@/lib/business-door";
import {
  looksLikeWebsiteQuery,
  normalizeWebsiteQuery,
  websiteOriginUrl,
} from "@/lib/business-join-query";
import {
  clearBusinessJoinDraft,
  clampJoinGivebackPercent,
  defaultBusinessJoinDraft,
  loadBusinessJoinDraft,
  saveBusinessJoinDraft,
  type BusinessJoinFourStepDraft,
  type CauseMode,
  type LocalGivebackMode,
} from "@/lib/business-join-four-step-draft";
import { Slider } from "@/components/ui/slider";
import {
  flushPendingPartnerJoinRequest,
  markPartnerJoinFindCompleted,
  readPartnerJoinIntent,
} from "@/lib/partner-join-intent";
import {
  looksLikeLogoImageUrl,
  looksLikeDecorativeImageUrl,
  classifyBusinessImages,
  venueGalleryPhotoUrls,
  isResyVenuePhotoUrl,
  countResyGalleryPhotos,
  resolveVenueImageSrc,
} from "@/lib/business-join-images";
import {
  isOpenVenueDay,
  normalizeVenueHours,
  saveVenueProfileSnapshot,
  VENUE_DAYS,
  venueSnapshotFromJoin,
  type VenueProfileSnapshot,
} from "@/lib/business-venue-profile";
import { BusinessVenueProfile } from "@/components/campaign/business-ai/BusinessVenueProfile";

type Phase = "find" | "confirm" | "profile" | "giveback" | "email" | "done";

/** Checklist shown while Find runs — matches real extract (no menu). */
const FIND_EXTRACT_CHECKLIST = [
  "Website",
  "Social links",
  "Logo",
  "Photos",
  "Nearby location",
] as const;

/**
 * Map website draft API result into the confirm-card shape used by name find.
 */
function mapWebsiteDraftToFindResult(
  draft: BusinessDraftApiResult,
  joinDoorType: BusinessDoor | null,
): FindBusinessProfileResult {
  const city = draft.city?.trim() || draft.locations[0]?.city?.trim() || "";
  const state = draft.state?.trim() || draft.locations[0]?.state?.trim() || "";
  const address = draft.locations[0]?.address?.trim() || "";
  const imageUrls = draft.imageUrls ?? [];
  const locationFound = Boolean(city || state || address);
  const logoUrl =
    imageUrls.find((u) => looksLikeLogoImageUrl(u)) ?? imageUrls[0] ?? null;
  return {
    businessName: draft.businessName?.trim() || "Your business",
    website: draft.website,
    businessType: draft.businessType || (joinDoorType === "local" ? "Local Business" : "Restaurant"),
    about: draft.about || "",
    contactEmail: draft.contactEmail || "",
    phone: draft.phone || "",
    city,
    state,
    address,
    zip: "",
    locations:
      draft.locations.length > 0
        ? draft.locations.map((loc) => ({
            locationName: loc.locationName || draft.businessName || "Main Location",
            city: loc.city || city,
            state: loc.state || state,
            ...(loc.address ? { address: loc.address } : address ? { address } : {}),
            ...(loc.reservationUrl || draft.reservationUrl
              ? { reservationUrl: loc.reservationUrl || draft.reservationUrl || undefined }
              : {}),
          }))
        : [
            {
              locationName: draft.businessName || "Main Location",
              city,
              state,
              ...(address ? { address } : {}),
              ...(draft.reservationUrl ? { reservationUrl: draft.reservationUrl } : {}),
            },
          ],
    logoUrl,
    imageUrls,
    facebookUrl: draft.facebookUrl ?? null,
    instagramUrl: draft.instagramUrl ?? null,
    linkedinUrl: draft.linkedinUrl ?? null,
    youtubeUrl: draft.youtubeUrl ?? null,
    tiktokUrl: draft.tiktokUrl ?? null,
    checks: {
      websiteFound: Boolean(draft.website),
      logoFound: Boolean(logoUrl),
      photosFound: imageUrls.some((u) => !looksLikeLogoImageUrl(u)),
      locationFound,
    },
    reservationUrl: draft.reservationUrl ?? draft.locations[0]?.reservationUrl ?? null,
    bookingPlatform: draft.bookingPlatform ?? null,
    discountHours: draft.discountHours ?? null,
    eligibleWindow: draft.eligibleWindow ?? "",
    locationSourceUrl: draft.website || null,
    joinDoorType,
    confirmationStatus: draft.confirmationStatus || "Website Draft",
    provider: draft.provider,
  };
}

/**
 * Four-step Restaurant / Local giveback onboarding matching product mockup.
 */
export function BusinessJoinFourStep() {
  const { goTo, setBusinessProfile, update, switchActiveRole, state } = useCampaign();
  const mounted = useClientMounted();
  const [door, setDoor] = useState<BusinessDoor | null>(null);
  const [phase, setPhase] = useState<Phase>("find");
  const [draft, setDraft] = useState<BusinessJoinFourStepDraft>(() =>
    loadBusinessJoinDraft() ?? defaultBusinessJoinDraft(),
  );
  const [error, setError] = useState<string | null>(null);
  const [finding, setFinding] = useState(false);
  /** Animated checklist index while Find / website extract runs. */
  const [findProgressIdx, setFindProgressIdx] = useState(0);
  /** Confirm card Edit/Done — inline correct AI-found fields. */
  const [editingConfirm, setEditingConfirm] = useState(false);
  /** Venue profile Edit/Done after "Yes, that's us". */
  const [editingProfile, setEditingProfile] = useState(false);
  /** Clear venue photos only (no logos / wordmark banners) for cover + picker. */
  const [clearPhotoUrls, setClearPhotoUrls] = useState<string[]>([]);
  /** Logo mark after client classify (never a food photo). */
  const [classifiedLogoUrl, setClassifiedLogoUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /** Done-screen variant when a second email hits a locked guest draft. */
  const [doneAccessRequested, setDoneAccessRequested] = useState(false);
  const [claimEmailSent, setClaimEmailSent] = useState(false);
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [partnerJoinSubmitted, setPartnerJoinSubmitted] = useState(false);
  /** Client-only: campaign slug from session intent (avoids SSR hydration mismatch). */
  const [partnerJoinCampaignSlug, setPartnerJoinCampaignSlug] = useState<string | null>(null);
  /** Guard: refresh stale session drafts that predate Resy gallery fetch (once). */
  const [resyGalleryRefreshAttempted, setResyGalleryRefreshAttempted] = useState(false);
  /** True while re-fetching venue photos before opening the profile gallery. */
  const [refreshingGallery, setRefreshingGallery] = useState(false);

  useEffect(() => {
    if (!mounted) return;
    const d = readBusinessDoor();
    const intent = readPartnerJoinIntent();
    setDoor(d ?? intent?.doorType ?? null);
    setPartnerJoinCampaignSlug(intent?.campaignSlug?.trim() || null);
    setDraft((prev) => {
      const next = {
        ...prev,
        door: d ?? intent?.doorType ?? prev.door,
        ...(intent?.campaignSlug
          ? {
              causeMode: "pick_now" as CauseMode,
              selectedCampaignSlug: intent.campaignSlug,
            }
          : {}),
      };
      saveBusinessJoinDraft(next);
      return next;
    });
  }, [mounted]);

  useEffect(() => {
    if (!mounted || !getAuthToken()) return;
    const intent = readPartnerJoinIntent();
    // Explicit “Find a different restaurant” — do not auto-skip Find.
    if (intent?.forceFind) return;
    const hasBusiness =
      state.businessMemberships.length > 0 || Boolean(state.businessProfile?.id);
    if (!hasBusiness) return;
    // Already signed in with a business + partner join intent → Send request UI.
    if (intent?.campaignSlug) {
      const biz = state.businessProfile ?? state.businessMemberships[0];
      if (biz?.id) {
        markPartnerJoinFindCompleted({
          businessId: biz.id,
          locationId: biz.locationId || undefined,
          ownerUserId: loadUserSession()?.userId,
        });
        goTo("partner-campaign-join", {
          query: { campaign: intent.campaignSlug },
        });
        return;
      }
    }
    if (!intent) goTo("business-dashboard");
  }, [mounted, state.businessMemberships.length, state.businessProfile?.id, goTo]);

  /** Advance extract checklist while Find API is in flight (mirrors NPO AiAnalyzing). */
  useEffect(() => {
    if (!finding) {
      setFindProgressIdx(0);
      return;
    }
    if (findProgressIdx >= FIND_EXTRACT_CHECKLIST.length) return;
    const tick = setTimeout(() => setFindProgressIdx((i) => i + 1), 700);
    return () => clearTimeout(tick);
  }, [finding, findProgressIdx]);

  /**
   * Classify scraped images: logo mark vs cover photos (never swap).
   * Never downgrade a Resy-first gallery once we have image.resy.com URLs.
   */
  useEffect(() => {
    const found = draft.found;
    if (!found || (phase !== "confirm" && phase !== "profile")) {
      if (phase !== "confirm" && phase !== "profile") {
        setClearPhotoUrls([]);
        setClassifiedLogoUrl(null);
      }
      return;
    }
    const seed = venueGalleryPhotoUrls(found.imageUrls);
    const seedResy = countResyGalleryPhotos(seed);
    if (seed.length > 0) {
      setClearPhotoUrls((prev) => {
        const prevResy = countResyGalleryPhotos(prev);
        if (prevResy > seedResy) return prev;
        return seed;
      });
    }
    let cancelled = false;
    void (async () => {
      const classified = await classifyBusinessImages(
        found.imageUrls,
        found.logoUrl,
      );
      if (cancelled) return;
      const nextPhotos =
        classified.photoUrls.length > 0 ? classified.photoUrls : seed;
      const resy = venueGalleryPhotoUrls(found.imageUrls).filter((u) =>
        isResyVenuePhotoUrl(u),
      );
      const merged = [
        ...new Set(
          resy.length > 0
            ? [...resy, ...nextPhotos.filter((u) => !isResyVenuePhotoUrl(u))]
            : nextPhotos,
        ),
      ].slice(0, 16);
      setClearPhotoUrls((prev) => {
        const prevResy = countResyGalleryPhotos(prev);
        const nextResy = countResyGalleryPhotos(merged);
        if (prevResy > nextResy) return prev;
        return merged;
      });
      setClassifiedLogoUrl(classified.logoUrl);
    })();
    return () => {
      cancelled = true;
    };
  }, [draft.found?.imageUrls.join("|"), draft.found?.logoUrl, phase]);

  const roleWord = businessDoorRoleLabel(door);
  const isRestaurant = door !== "local";

  const patchDraft = (patch: Partial<BusinessJoinFourStepDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      saveBusinessJoinDraft(next);
      return next;
    });
  };

  /**
   * Session drafts saved before Resy short-URL gallery support often lack
   * image.resy.com URLs. Re-run website draft / Find once when photos are stale.
   */
  useEffect(() => {
    if (!mounted || resyGalleryRefreshAttempted || finding || refreshingGallery) return;
    const found = draft.found;
    if (!found) return;
    const hasResyPhotos = countResyGalleryPhotos(found.imageUrls) > 0;
    if (hasResyPhotos) return;
    const website = (found.website || "").trim();
    const q = (draft.nameQuery || found.businessName || "").trim();
    if (!website && !q) return;
    setResyGalleryRefreshAttempted(true);
    const doorType = door ?? readBusinessDoor() ?? undefined;
    setFinding(true);
    void (async () => {
      try {
        let next: FindBusinessProfileResult;
        if (website) {
          const site = websiteOriginUrl(website);
          const venue = await fetchBusinessVenueImages({
            websiteUrl: site,
            reservationUrl:
              found.reservationUrl ||
              found.locations.find((l) => l.reservationUrl)?.reservationUrl ||
              null,
          });
          next = {
            ...found,
            website: site || found.website,
            imageUrls: venue.imageUrls?.length ? venue.imageUrls : found.imageUrls,
            reservationUrl: venue.reservationUrl ?? found.reservationUrl,
          };
        } else {
          next = await findBusinessProfile({
            businessName: q,
            joinDoorType: doorType,
          });
        }
        patchDraft({ found: next });
        setClearPhotoUrls(venueGalleryPhotoUrls(next.imageUrls));
      } catch {
        /* keep existing draft; Yes → profile will retry */
      } finally {
        setFinding(false);
      }
    })();
  }, [
    mounted,
    draft.found,
    draft.nameQuery,
    door,
    finding,
    refreshingGallery,
    resyGalleryRefreshAttempted,
  ]);

  const givebackPercent = clampJoinGivebackPercent(draft.givebackPercent ?? 15);
  const GIVEBACK_PRESETS = [10, 15, 20, 25] as const;

  const setGivebackPercent = (value: number) => {
    patchDraft({ givebackPercent: clampJoinGivebackPercent(value) });
  };

  /**
   * Patch the found profile on confirm Edit and refresh checklist flags.
   * Keeps primary location in sync with city/state/address edits.
   */
  const patchFound = (patch: Partial<FindBusinessProfileResult>) => {
    setDraft((prev) => {
      if (!prev.found) return prev;
      const merged: FindBusinessProfileResult = { ...prev.found, ...patch };
      const city = (merged.city ?? "").trim();
      const state = (merged.state ?? "").trim();
      const address = (merged.address ?? "").trim();
      const imageUrls = merged.imageUrls ?? [];
      const primary = merged.locations[0];
      const locations =
        merged.locations.length > 0
          ? [
              {
                locationName:
                  primary?.locationName?.trim() ||
                  merged.businessName.trim() ||
                  "Main Location",
                city: city || primary?.city || "",
                state: state || primary?.state || "",
                ...(address
                  ? { address }
                  : primary?.address
                    ? { address: primary.address }
                    : {}),
                ...(primary?.reservationUrl || merged.reservationUrl
                  ? {
                      reservationUrl:
                        primary?.reservationUrl || merged.reservationUrl || undefined,
                    }
                  : {}),
              },
              ...merged.locations.slice(1),
            ]
          : [
              {
                locationName: merged.businessName.trim() || "Main Location",
                city,
                state,
                ...(address ? { address } : {}),
                ...(merged.reservationUrl ? { reservationUrl: merged.reservationUrl } : {}),
              },
            ];
      const nextFound: FindBusinessProfileResult = {
        ...merged,
        city,
        state,
        address,
        locations,
        checks: {
          websiteFound: Boolean(merged.website?.trim()),
          logoFound: Boolean(merged.logoUrl) || imageUrls.length > 0,
          photosFound: imageUrls.length > 0 || Boolean(merged.logoUrl),
          locationFound: Boolean(city || state || address),
        },
      };
      const next = { ...prev, found: nextFound };
      saveBusinessJoinDraft(next);
      return next;
    });
  };

  const runFind = async () => {
    const q = draft.nameQuery.trim();
    if (!q) {
      setError(`Enter your ${roleWord} name or website to continue.`);
      return;
    }
    const nearZip = (draft.nearZip || "").replace(/\D/g, "").slice(0, 5);
    if (!looksLikeWebsiteQuery(q) && nearZip.length !== 5) {
      setError("Enter a 5-digit ZIP so we can find the exact nearby location.");
      return;
    }
    setError(null);
    setFinding(true);
    setEditingConfirm(false);
    setClearPhotoUrls([]);
    setResyGalleryRefreshAttempted(false);
    try {
      const doorType = door ?? readBusinessDoor() ?? undefined;
      const near =
        nearZip.length === 5 ? { nearZip } : undefined;
      let found: FindBusinessProfileResult;
      if (looksLikeWebsiteQuery(q)) {
        // Use site origin so /menus/ (etc.) still discovers Resy from the homepage.
        const website = websiteOriginUrl(q);
        const websiteDraft = await generateBusinessDraft(website, near);
        found = mapWebsiteDraftToFindResult(websiteDraft, doorType ?? null);
        if (nearZip.length === 5 && !found.zip) {
          found = { ...found, zip: nearZip };
        }
      } else {
        found = await findBusinessProfile({
          businessName: q,
          joinDoorType: doorType,
          nearZip: nearZip || undefined,
        });
      }

      // Always pull Resy + site gallery via the dedicated endpoint so Find
      // is not stuck on a thin AI/social image list.
      const website = (found.website || "").trim();
      if (website) {
        try {
          const site = websiteOriginUrl(website);
          const venue = await fetchBusinessVenueImages({
            websiteUrl: site,
            reservationUrl: found.reservationUrl,
          });
          if (venue.imageUrls?.length) {
            found = {
              ...found,
              website: site || found.website,
              imageUrls: venue.imageUrls,
              reservationUrl: venue.reservationUrl ?? found.reservationUrl,
              checks: {
                ...found.checks,
                photosFound: venue.imageUrls.length > 0,
              },
            };
          }
        } catch {
          /* keep Find imageUrls */
        }
      }

      const hours = normalizeVenueHours(found.discountHours);
      const hasListedDay = VENUE_DAYS.some((day) => isOpenVenueDay(hours[day]));
      patchDraft({
        found,
        nameQuery: q,
        ...(hasListedDay ? { discountHours: hours } : {}),
        ...(found.eligibleWindow?.trim()
          ? { eligibleWindow: found.eligibleWindow.trim() }
          : {}),
      });
      setClearPhotoUrls(venueGalleryPhotoUrls(found.imageUrls));
      setResyGalleryRefreshAttempted(true);
      setPhase("confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not find that ${roleWord}`);
    } finally {
      setFinding(false);
    }
  };

  const loadCauses = async () => {
    setLoadingCampaigns(true);
    try {
      const rows = await fetchCampaigns();
      setCampaigns(rows.filter((c) => !campaignHasEnded(c)));
    } catch {
      setCampaigns([]);
    } finally {
      setLoadingCampaigns(false);
    }
  };

  const goGiveback = () => {
    setError(null);
    setEditingConfirm(false);
    void loadCauses();
    setPhase("giveback");
  };

  const finishJoin = async () => {
    const found = draft.found;
    const email = draft.email.trim();
    if (!found) {
      setError("Find your business first.");
      setPhase("find");
      return;
    }
    if (!email.includes("@")) {
      setError("Enter a valid email for your dashboard.");
      setPhase("email");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const loc = found.locations[0];
      const supportsDine = isRestaurant || draft.localGivebackMode === "percent_of_purchase";
      const supportsShop = !isRestaurant && draft.localGivebackMode !== "percent_of_purchase";
      const joinGivebackMode = isRestaurant
        ? ("restaurant_dine_percent" as const)
        : draft.localGivebackMode;

      const result = await submitBusinessClaimRequest({
        businessName: found.businessName.trim(),
        contactName: found.businessName.trim(),
        contactEmail: email,
        businessType: found.businessType || undefined,
        website: found.website || undefined,
        locationName: loc?.locationName?.trim() || found.businessName.trim(),
        city: loc?.city?.trim() || found.city || undefined,
        state: loc?.state?.trim() || found.state || undefined,
        reservationUrl: loc?.reservationUrl || found.reservationUrl || undefined,
        supportsDineAndDonate: supportsDine,
        supportsShopAndDonate: supportsShop,
        supportsServiceGiveback: false,
        supportsGuestBartending: false,
        joinDoorType: door ?? readBusinessDoor() ?? undefined,
        joinGivebackMode,
        joinCauseMode: draft.causeMode,
        joinPreferredCampaignSlug:
          draft.causeMode === "pick_now" ? draft.selectedCampaignSlug : undefined,
      });

      const causeName =
        campaigns.find((c) => c.slug === draft.selectedCampaignSlug)?.nonprofit ?? null;
      const venueSnap = venueSnapshotFromJoin({
        found,
        hours: normalizeVenueHours(draft.discountHours),
        eligibleWindow: draft.eligibleWindow || "",
        coverUrl: clearPhotoUrls[0] ?? null,
        photoUrls: clearPhotoUrls,
        givebackPercent,
        causeName,
        isRestaurant,
        businessId: result.business?.id ?? null,
      });
      if (venueSnap?.businessId) saveVenueProfileSnapshot(venueSnap);

      if (result.action === "access_requested") {
        setDoneAccessRequested(true);
        setClaimEmailSent(false);
        setError(null);
        setPhase("done");
        setSubmitting(false);
        return;
      }

      const business = result.business;
      const primary = business.locations[0];
      if (!primary) throw new Error("No location on business profile");

      setDoneAccessRequested(false);
      setClaimEmailSent(Boolean(result.claimEmailSent));

      setBusinessProfile({
        id: business.id,
        businessName: business.businessName,
        contactName: business.contactName ?? found.businessName,
        contactEmail: business.contactEmail ?? email,
        locationId: primary.id,
        locationName: primary.locationName,
        capabilities: business.capabilities,
        claimStatus: business.claimStatus,
        businessStatus: business.businessStatus,
      });
      update({ accountIntent: "business" });
      switchActiveRole("business", business.id);
      stashRoleHint("business");

      markPartnerJoinFindCompleted({
        businessId: business.id,
        locationId: primary.id,
        ownerUserId: loadUserSession()?.userId,
      });

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
        const flush = await flushPendingPartnerJoinRequest({
          businessId: business.id,
          locationId: primary.id,
        });
        if (flush === "submitted") setPartnerJoinSubmitted(true);
      }

      if (draft.selectedCampaignSlug) {
        try {
          sessionStorage.setItem(
            "forkup-business-onboarding-campaign",
            draft.selectedCampaignSlug,
          );
        } catch {
          /* ignore */
        }
      }
      try {
        sessionStorage.setItem(
          "forkup-business-join-prefs",
          JSON.stringify({
            causeMode: draft.causeMode,
            localGivebackMode: draft.localGivebackMode,
            givebackPercent: draft.givebackPercent,
            door: door ?? null,
          }),
        );
      } catch {
        /* ignore */
      }

      clearBusinessJoinDraft();

      const joinIntent = readPartnerJoinIntent();
      if (joinIntent?.campaignSlug && getAuthToken()) {
        goTo("partner-campaign-join", {
          query: { campaign: joinIntent.campaignSlug },
        });
        return;
      }

      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join ForkUp");
    } finally {
      setSubmitting(false);
    }
  };

  const openProfile = async () => {
    setError(null);
    setEditingConfirm(false);
    setEditingProfile(false);
    const found = draft.found;
    if (!found) {
      setPhase("confirm");
      return;
    }

    const website = (found.website || "").trim();
    const reservationUrl =
      found.reservationUrl ||
      found.locations.find((l) => l.reservationUrl)?.reservationUrl ||
      null;

    // Always refresh gallery from the dedicated venue-images API when we have
    // a website — ignores stale session drafts that only have ~6 site photos.
    if (website) {
      setRefreshingGallery(true);
      try {
        const site = websiteOriginUrl(website);
        const venue = await fetchBusinessVenueImages({
          websiteUrl: site,
          reservationUrl,
        });
        const imageUrls =
          venue.imageUrls?.length > 0 ? venue.imageUrls : found.imageUrls;
        const merged: FindBusinessProfileResult = {
          ...found,
          website: site || found.website,
          imageUrls,
          reservationUrl: venue.reservationUrl ?? found.reservationUrl,
        };
        patchDraft({ found: merged });
        setClearPhotoUrls(venueGalleryPhotoUrls(imageUrls));
        setResyGalleryRefreshAttempted(true);
      } catch (err) {
        // Fallback: full website draft (also scrapes Resy when linked).
        try {
          const site = websiteOriginUrl(website);
          const websiteDraft = await generateBusinessDraft(site);
          const imageUrls =
            websiteDraft.imageUrls?.length > 0
              ? websiteDraft.imageUrls
              : found.imageUrls;
          patchDraft({
            found: {
              ...found,
              website: site || found.website,
              imageUrls,
              reservationUrl:
                websiteDraft.reservationUrl ?? found.reservationUrl,
              bookingPlatform:
                websiteDraft.bookingPlatform ?? found.bookingPlatform,
            },
          });
          setClearPhotoUrls(venueGalleryPhotoUrls(imageUrls));
        } catch {
          setClearPhotoUrls(venueGalleryPhotoUrls(found.imageUrls));
          setError(
            err instanceof Error
              ? err.message
              : "Could not refresh venue photos.",
          );
        }
      } finally {
        setRefreshingGallery(false);
      }
    } else {
      setClearPhotoUrls(venueGalleryPhotoUrls(found.imageUrls));
    }

    setPhase("profile");
  };

  const applyVenueChange = (patch: Partial<VenueProfileSnapshot>) => {
    const foundPatch: Partial<FindBusinessProfileResult> = {};
    if (patch.businessName != null) foundPatch.businessName = patch.businessName;
    if (patch.address != null) foundPatch.address = patch.address;
    if (patch.city != null) foundPatch.city = patch.city;
    if (patch.state != null) foundPatch.state = patch.state;
    if (patch.zip != null) foundPatch.zip = patch.zip;
    if (patch.about != null) foundPatch.about = patch.about;
    if (patch.websiteUrl !== undefined) {
      foundPatch.website = patch.websiteUrl?.trim() || "";
    }
    if (patch.facebookUrl !== undefined) {
      foundPatch.facebookUrl = patch.facebookUrl?.trim() || null;
    }
    if (patch.instagramUrl !== undefined) {
      foundPatch.instagramUrl = patch.instagramUrl?.trim() || null;
    }
    if (patch.phone !== undefined) {
      foundPatch.phone = patch.phone?.trim() || "";
    }
    if (patch.email !== undefined) {
      foundPatch.contactEmail = patch.email?.trim() || "";
    }
    if (patch.photoUrls) {
      foundPatch.imageUrls = patch.photoUrls;
      setClearPhotoUrls(patch.photoUrls);
    }
    if (patch.coverUrl && draft.found) {
      const url = patch.coverUrl;
      const base = patch.photoUrls ?? draft.found.imageUrls;
      const rest = base.filter((u) => u !== url);
      foundPatch.imageUrls = [url, ...rest];
      setClearPhotoUrls((prev) => {
        const from = patch.photoUrls ?? prev;
        return [url, ...from.filter((u) => u !== url)];
      });
    }
    if (Object.keys(foundPatch).length > 0) patchFound(foundPatch);
    if (patch.hours || patch.eligibleWindow != null) {
      patchDraft({
        ...(patch.hours ? { discountHours: patch.hours } : {}),
        ...(patch.eligibleWindow != null ? { eligibleWindow: patch.eligibleWindow } : {}),
      });
    }
  };

  const galleryPhotos = draft.found
    ? (() => {
        const fromFound = venueGalleryPhotoUrls(draft.found.imageUrls);
        const fromClear = clearPhotoUrls;
        if (
          countResyGalleryPhotos(fromFound) >= countResyGalleryPhotos(fromClear) &&
          fromFound.length > 0
        ) {
          return fromFound;
        }
        if (fromClear.length > 0) return fromClear;
        return fromFound;
      })()
    : [];

  const profileVenue = draft.found
    ? venueSnapshotFromJoin({
        found: draft.found,
        hours: normalizeVenueHours(draft.discountHours),
        eligibleWindow: draft.eligibleWindow || "",
        coverUrl: galleryPhotos[0] ?? null,
        photoUrls: galleryPhotos,
        givebackPercent,
        causeName:
          campaigns.find((c) => c.slug === draft.selectedCampaignSlug)?.nonprofit ?? null,
        isRestaurant,
        businessId: null,
      })
    : null;

  if (phase === "profile" && profileVenue) {
    return (
      <BusinessVenueProfile
        profile={profileVenue}
        editing={editingProfile}
        onToggleEdit={() => setEditingProfile((v) => !v)}
        onChange={applyVenueChange}
        onBack={() => {
          setEditingProfile(false);
          setPhase("confirm");
        }}
        onContinue={() => {
          setEditingProfile(false);
          goGiveback();
        }}
      />
    );
  }

  const locationLine = draft.found
    ? [
        draft.found.address,
        [draft.found.city, draft.found.state].filter(Boolean).join(", "),
        draft.found.zip,
      ]
        .filter(Boolean)
        .join(" · ") || "Add your street address with Edit"
    : "";

  const socialLinks = draft.found
    ? [
        draft.found.facebookUrl
          ? { label: "Facebook", href: draft.found.facebookUrl }
          : null,
        draft.found.instagramUrl
          ? { label: "Instagram", href: draft.found.instagramUrl }
          : null,
        draft.found.linkedinUrl
          ? { label: "LinkedIn", href: draft.found.linkedinUrl }
          : null,
        draft.found.youtubeUrl
          ? { label: "YouTube", href: draft.found.youtubeUrl }
          : null,
        draft.found.tiktokUrl
          ? { label: "TikTok", href: draft.found.tiktokUrl }
          : null,
      ].filter(Boolean) as { label: string; href: string }[]
    : [];

  const findExtractPct = Math.min(
    100,
    Math.round(((findProgressIdx + 0.5) / FIND_EXTRACT_CHECKLIST.length) * 100),
  );

  /**
   * Cover = first sharp photo (never logo). Logo thumb stays the brand mark.
   */
  const confirmLogoUrl =
    classifiedLogoUrl ||
    (draft.found?.logoUrl && looksLikeLogoImageUrl(draft.found.logoUrl)
      ? draft.found.logoUrl
      : null);
  const confirmCoverUrl = clearPhotoUrls[0] ?? null;

  return (
    <main
      className={`mx-auto px-5 py-10 sm:px-6 ${
        phase === "giveback" && !isRestaurant ? "max-w-2xl" : "max-w-lg"
      }`}
    >
      <button
        type="button"
        onClick={() => goTo("website-landing")}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to home
      </button>

      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-accent text-primary">
          <Store className="size-5" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            {isRestaurant ? "Restaurant" : "Local business"} — give back
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {phase === "find" && finding && "Analyzing your content..."}
            {phase === "find" && !finding && `Find your ${roleWord}`}
            {phase === "confirm" && "We found you"}
            {phase === "giveback" &&
              (isRestaurant ? `Give ${givebackPercent}% Back` : "How would you like to help?")}
            {phase === "email" &&
              (isRestaurant ? "You're ready to ForkUp!" : "You're ready to make an impact!")}
            {phase === "done" &&
              (doneAccessRequested ? "Request submitted" : "You're in")}
          </h1>
        </div>
      </div>

      {phase !== "done" && error && (
        <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {phase === "find" && finding && (
        <div className="mt-8 space-y-4">
          <p className="text-sm text-muted-foreground">
            ForkUp is extracting signals from your public pages.
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${Math.max(8, findExtractPct)}%` }}
            />
          </div>
          <p className="mt-2 text-sm font-semibold">AI is extracting:</p>
          <div className="space-y-2.5">
            {FIND_EXTRACT_CHECKLIST.map((label, i) => {
              const done = i < findProgressIdx;
              const current =
                i === findProgressIdx &&
                findProgressIdx < FIND_EXTRACT_CHECKLIST.length;
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
                    <Circle className="size-4 text-muted-foreground/50" />
                  )}
                  <span
                    className={
                      done || current ? "font-medium" : "text-muted-foreground"
                    }
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="inline-flex w-full items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            <Sparkles className="size-3.5 shrink-0 text-primary" />
            Almost done! Hang tight...
          </p>
        </div>
      )}

      {phase === "find" && !finding && (
        <div className="mt-8 space-y-4">
          {mounted && partnerJoinCampaignSlug ? (
            <p className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground">
              Joining a campaign — new {roleWord}s find below; existing ForkUp businesses can
              sign in and skip find.
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            Enter your {roleWord} name or website, plus your ZIP so we can pick the exact nearby location.
          </p>
          <label className="block text-sm font-medium">
            {isRestaurant ? "Restaurant name or website" : "Business name or website"}
            <input
              className="mt-1.5 w-full rounded-xl border border-border px-3 py-2.5 text-sm"
              value={draft.nameQuery}
              onChange={(e) => patchDraft({ nameQuery: e.target.value })}
              placeholder={
                isRestaurant
                  ? "e.g. Sovana Bistro or https://www.sovanabistro.com"
                  : "e.g. Main Street Salon or https://…"
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") void runFind();
              }}
            />
          </label>
          <label className="block text-sm font-medium">
            ZIP code (nearby location)
            <input
              className="mt-1.5 w-full rounded-xl border border-border px-3 py-2.5 text-sm"
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={5}
              value={draft.nearZip || ""}
              onChange={(e) =>
                patchDraft({ nearZip: e.target.value.replace(/\D/g, "").slice(0, 5) })
              }
              placeholder="e.g. 19348"
              onKeyDown={(e) => {
                if (e.key === "Enter") void runFind();
              }}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Our AI will find your website, social links, photos, and the exact nearby location —
            or use the URL you paste.
          </p>
          {mounted && state.businessProfile?.id && partnerJoinCampaignSlug ? (
            <button
              type="button"
              onClick={() => {
                markPartnerJoinFindCompleted({
                  businessId: state.businessProfile!.id,
                  locationId: state.businessProfile!.locationId || undefined,
                  ownerUserId: loadUserSession()?.userId,
                });
                switchActiveRole("business", state.businessProfile!.id);
                goTo("partner-campaign-join", {
                  query: { campaign: partnerJoinCampaignSlug },
                });
              }}
              className="w-full rounded-xl border border-border px-4 py-3 text-left text-sm transition-colors hover:bg-accent"
            >
              <span className="font-semibold">
                Use existing {state.businessProfile.businessName}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Skip find and send a join request for this profile
              </span>
            </button>
          ) : null}
          {mounted && partnerJoinCampaignSlug && !getAuthToken() ? (
            <button
              type="button"
              onClick={() => {
                prepareExistingBusinessPartnerJoinAuth();
                goTo("auth-login", {
                  query: { campaign: partnerJoinCampaignSlug, token: undefined },
                });
              }}
              className="w-full rounded-xl border border-border px-4 py-3 text-left text-sm transition-colors hover:bg-accent"
            >
              <span className="font-semibold">
                Already on ForkUp? Sign in
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Use your existing {roleWord} account — skip Find My {isRestaurant ? "Restaurant" : "Business"}
              </span>
            </button>
          ) : null}
          <button
            type="button"
            disabled={finding}
            onClick={() => void runFind()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            Find My {isRestaurant ? "Restaurant" : "Business"}
            <ArrowRight className="size-4" />
          </button>
        </div>
      )}

      {phase === "confirm" && draft.found && (
        <div className="mt-8 space-y-4">
          <p className="text-sm text-muted-foreground">
            Here&apos;s what we found. Let us know if this is you.
          </p>
          <p className="text-xs text-muted-foreground">
            Gallery photos: {clearPhotoUrls.length}
            {countResyGalleryPhotos(clearPhotoUrls) > 0
              ? ` · ${countResyGalleryPhotos(clearPhotoUrls)} from Resy`
              : ""}
          </p>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="relative flex h-44 w-full items-center justify-center overflow-hidden bg-muted/30">
              {confirmCoverUrl ? (
                <img
                  src={resolveVenueImageSrc(confirmCoverUrl)}
                  alt=""
                  className="h-44 w-full object-cover"
                />
              ) : (
                <p className="px-4 text-center text-xs text-muted-foreground">
                  No clear photo found — tap Edit to choose one if available
                </p>
              )}
              <button
                type="button"
                onClick={() => setEditingConfirm((v) => !v)}
                className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full border border-border bg-card/95 px-3 py-1 text-xs font-semibold text-foreground shadow-sm hover:bg-card"
              >
                <Pencil className="size-3" />
                {editingConfirm ? "Done" : "Edit"}
              </button>
            </div>
            <div className="space-y-2 border-t border-border p-4">
              {editingConfirm ? (
                <div className="space-y-3">
                  {clearPhotoUrls.length > 0 ? (
                    <div>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        Choose photo
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {clearPhotoUrls.map((url) => {
                          const selected = confirmCoverUrl === url;
                          return (
                            <button
                              key={url}
                              type="button"
                              onClick={() => {
                                const rest = draft.found!.imageUrls.filter(
                                  (u) => u !== url,
                                );
                                const logo =
                                  draft.found!.logoUrl &&
                                  draft.found!.logoUrl !== url
                                    ? draft.found!.logoUrl
                                    : draft.found!.imageUrls.find(
                                        (u) =>
                                          u !== url && looksLikeLogoImageUrl(u),
                                      ) || draft.found!.logoUrl;
                                patchFound({
                                  imageUrls: [url, ...rest],
                                  logoUrl: logo || draft.found!.logoUrl,
                                });
                                setClearPhotoUrls((prev) => [
                                  url,
                                  ...prev.filter((u) => u !== url),
                                ]);
                              }}
                              className={`size-14 overflow-hidden rounded-lg border-2 bg-muted/20 ${
                                selected ? "border-primary" : "border-border"
                              }`}
                            >
                              <img
                                src={resolveVenueImageSrc(url)}
                                alt=""
                                className="size-full object-cover"
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No clear photos available to use as cover.
                    </p>
                  )}
                  <label className="block text-sm font-medium">
                    {isRestaurant ? "Restaurant name" : "Business name"}
                    <input
                      className="mt-1.5 w-full rounded-xl border border-border px-3 py-2.5 text-sm"
                      value={draft.found.businessName}
                      onChange={(e) =>
                        patchFound({ businessName: e.target.value })
                      }
                    />
                  </label>
                  <label className="block text-sm font-medium">
                    Website
                    <input
                      className="mt-1.5 w-full rounded-xl border border-border px-3 py-2.5 text-sm"
                      value={draft.found.website}
                      onChange={(e) => patchFound({ website: e.target.value })}
                      placeholder="https://"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block text-sm font-medium">
                      City
                      <input
                        className="mt-1.5 w-full rounded-xl border border-border px-3 py-2.5 text-sm"
                        value={draft.found.city}
                        onChange={(e) => patchFound({ city: e.target.value })}
                      />
                    </label>
                    <label className="block text-sm font-medium">
                      State
                      <input
                        className="mt-1.5 w-full rounded-xl border border-border px-3 py-2.5 text-sm"
                        value={draft.found.state}
                        onChange={(e) => patchFound({ state: e.target.value })}
                      />
                    </label>
                  </div>
                  <label className="block text-sm font-medium">
                    Address
                    <input
                      className="mt-1.5 w-full rounded-xl border border-border px-3 py-2.5 text-sm"
                      value={draft.found.address}
                      onChange={(e) => patchFound({ address: e.target.value })}
                      placeholder="Street address (optional)"
                    />
                  </label>
                </div>
              ) : (
                <>
                  <div className="flex flex-row items-center gap-3">
                    {confirmLogoUrl ? (
                      <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-white">
                        <img
                          src={resolveVenueImageSrc(confirmLogoUrl)}
                          alt=""
                          className="max-h-full max-w-full object-contain p-0.5"
                        />
                      </div>
                    ) : null}
                    <div className="min-w-0 flex-1 text-left">
                      <p className="truncate text-lg font-bold">
                        {draft.found.businessName}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {locationLine}
                      </p>
                      {socialLinks.length > 0 ? (
                        <p className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 text-xs text-primary">
                          {socialLinks.map((s) => (
                            <a
                              key={s.href}
                              href={s.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {s.label}
                            </a>
                          ))}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void openProfile()}
            disabled={refreshingGallery || finding}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {refreshingGallery ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Loading venue photos…
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
            onClick={() => {
              setEditingConfirm(false);
              patchDraft({ found: null });
              setPhase("find");
            }}
            className="w-full text-center text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            Not correct? Search again
          </button>
        </div>
      )}

      {phase === "giveback" && (
        <div className="mt-8 flex w-full flex-col gap-5">
          {isRestaurant ? (
            <div className="flex w-full flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                ForkUp donates {givebackPercent}% of eligible dining proceeds from
                supporters who dine with you.
              </p>
              {/* Refer: single row — utensils | % + caption | green check */}
              <div className="flex w-full flex-row items-center gap-3 rounded-2xl border border-primary/40 bg-accent/80 px-4 py-4 sm:gap-4 sm:px-5">
                <Utensils
                  className="size-7 shrink-0 text-primary sm:size-8"
                  strokeWidth={1.75}
                />
                <div className="flex min-w-0 flex-1 flex-col items-start text-left">
                  <p className="text-2xl font-extrabold leading-none tracking-tight text-foreground sm:text-3xl">
                    {givebackPercent}%
                  </p>
                  <p className="mt-1 text-sm leading-snug text-muted-foreground">
                    of eligible dining proceeds
                  </p>
                </div>
                <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
                  <Check className="size-3.5" strokeWidth={3} />
                </div>
              </div>

              {/* Percentage adjustment toolbar */}
              <div className="space-y-3 rounded-2xl border border-border bg-card px-4 py-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    Adjust giveback percentage
                  </p>
                  <p className="text-sm font-bold text-primary">{givebackPercent}%</p>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {GIVEBACK_PRESETS.map((g) => {
                    const active = givebackPercent === g;
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setGivebackPercent(g)}
                        className={`flex h-10 items-center justify-center rounded-xl text-sm font-semibold transition-all ${
                          active
                            ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                            : "border border-border bg-card hover:bg-secondary"
                        }`}
                      >
                        {g}%
                      </button>
                    );
                  })}
                </div>
                <div className="space-y-2 pt-1">
                  <Slider
                    min={5}
                    max={50}
                    step={1}
                    value={[givebackPercent]}
                    onValueChange={(vals) => setGivebackPercent(vals[0] ?? 15)}
                    aria-label="Giveback percentage"
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>5%</span>
                    <span>Typical 10%–20%</span>
                    <span>50%</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex w-full flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Choose the option that works best for your business.
              </p>
              {/* Mockup: three giveback options side-by-side (not stacked one-by-one). */}
              <div className="grid w-full grid-cols-3 gap-2 sm:gap-3">
                {(
                  [
                    {
                      id: "percent_of_purchase" as LocalGivebackMode,
                      title: "% of Purchase",
                      note: "Give a percentage when a ForkUp supporter shops with you.",
                      recommended: true,
                      Icon: Percent,
                    },
                    {
                      id: "dollar_per_visit" as LocalGivebackMode,
                      title: "$ Per Visit",
                      note: "Give a set amount for each qualifying customer.",
                      recommended: false,
                      Icon: DollarSign,
                    },
                    {
                      id: "special_offer" as LocalGivebackMode,
                      title: "Special Offer",
                      note: "Create your own ForkUp give-back offer.",
                      recommended: false,
                      Icon: Gift,
                    },
                  ] as const
                ).map((opt) => {
                  const selected = draft.localGivebackMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => patchDraft({ localGivebackMode: opt.id })}
                      className={`relative flex min-h-[9.5rem] w-full flex-col items-center gap-2 rounded-2xl border-2 px-2 py-3 text-center transition-colors sm:min-h-[10.5rem] sm:px-3 sm:py-4 ${
                        selected
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card hover:bg-accent"
                      }`}
                    >
                      {selected ? (
                        <CheckCircle2 className="absolute right-1.5 top-1.5 size-4 text-emerald-600 sm:size-5" />
                      ) : (
                        <Circle className="absolute right-1.5 top-1.5 size-4 text-muted-foreground/40 sm:size-5" />
                      )}
                      <div
                        className={`flex size-10 shrink-0 items-center justify-center rounded-full sm:size-11 ${
                          selected
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-foreground"
                        }`}
                      >
                        <opt.Icon className="size-5" />
                      </div>
                      <span className="text-xs font-bold leading-tight text-foreground sm:text-sm">
                        {opt.title}
                      </span>
                      {opt.recommended ? (
                        <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white sm:px-2 sm:text-[10px]">
                          Recommended
                        </span>
                      ) : null}
                      <span className="text-[10px] leading-snug text-muted-foreground sm:text-xs">
                        {opt.note}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex w-full flex-col gap-2">
            <p className="text-sm font-semibold text-foreground">
              Choose a cause to support
            </p>
            <div className="flex w-full flex-col gap-2">
              {(
                [
                  { id: "pick_now" as CauseMode, label: "Select a local cause now" },
                  {
                    id: "forkup_match" as CauseMode,
                    label: "Let ForkUp match me with local causes",
                  },
                ] as const
              ).map((opt) => (
                <label
                  key={opt.id}
                  className={`flex w-full cursor-pointer flex-row items-center gap-2.5 rounded-2xl border px-4 py-3 text-sm ${
                    draft.causeMode === opt.id
                      ? "border-primary bg-primary/5 font-medium"
                      : "border-border bg-card"
                  }`}
                >
                  <input
                    type="radio"
                    name="causeMode"
                    checked={draft.causeMode === opt.id}
                    onChange={() => patchDraft({ causeMode: opt.id })}
                    className="size-4 accent-primary"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {draft.causeMode === "pick_now" && (
            <div className="flex w-full flex-col gap-2">
              <p className="text-xs text-muted-foreground">
                Optional — pick a live campaign now or skip.
              </p>
              {loadingCampaigns && (
                <div className="flex justify-center py-4">
                  <Loader2 className="size-5 animate-spin text-primary" />
                </div>
              )}
              {!loadingCampaigns && campaigns.length === 0 && (
                <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  No live campaigns right now — you can still join and match later.
                </p>
              )}
              <div className="flex max-h-48 w-full flex-col gap-2 overflow-y-auto pr-1">
                {campaigns.map((c) => (
                  <button
                    key={c.slug}
                    type="button"
                    onClick={() => patchDraft({ selectedCampaignSlug: c.slug })}
                    className={`block w-full rounded-2xl border px-4 py-3 text-left text-sm ${
                      draft.selectedCampaignSlug === c.slug
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:bg-accent"
                    }`}
                  >
                    <span className="font-semibold">{c.name}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {c.nonprofit} · {c.dateRange}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setError(null);
              setPhase("email");
            }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground"
          >
            Count Us In
            <ArrowRight className="size-4" />
          </button>
        </div>
      )}

      {phase === "email" && (
        <div className="mt-8 space-y-4">
          <p className="text-sm text-muted-foreground">
            Where should we send your {roleWord} dashboard?
          </p>
          <label className="block text-sm font-medium">
            Email
            <input
              type="email"
              className="mt-1.5 w-full rounded-xl border border-border px-3 py-2.5 text-sm"
              value={draft.email}
              onChange={(e) => patchDraft({ email: e.target.value })}
              placeholder={isRestaurant ? "you@restaurant.com" : "you@yourbusiness.com"}
            />
          </label>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void finishJoin()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            Join ForkUp
            {!submitting && <ArrowRight className="size-4" />}
          </button>
          <p className="text-center text-xs text-muted-foreground">
            No password needed. You can always add more details later.
          </p>
        </div>
      )}

      {phase === "done" && (
        <div className="mt-10 rounded-2xl border border-border bg-card p-6 text-center">
          <CheckCircle2 className="mx-auto size-10 text-primary" />
          <h2 className="mt-4 text-xl font-bold">
            {doneAccessRequested ? "Access requested" : "Welcome to ForkUp"}
          </h2>
          {doneAccessRequested ? (
            <p className="mt-2 text-sm text-muted-foreground">
              This {roleWord} draft is already saved under another email. ForkUp will review your
              access request
              {draft.email ? (
                <>
                  {" "}
                  for <span className="font-medium text-foreground">{draft.email}</span>
                </>
              ) : null}
              .
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Your {roleWord} profile draft is saved
              {draft.email ? (
                <>
                  {" "}
                  for <span className="font-medium text-foreground">{draft.email}</span>
                </>
              ) : null}
              .
              {partnerJoinSubmitted ? (
                <>
                  {" "}
                  Your request to join the campaign was sent to the nonprofit — they&apos;ll
                  review and invite you if approved.
                </>
              ) : claimEmailSent || !getAuthToken() ? (
                <>
                  {" "}
                  Check your inbox for a claim link so you can manage it on any device.
                </>
              ) : (
                <> Finish verification and campaign details anytime.</>
              )}
            </p>
          )}
          <div className="mt-6 flex flex-col gap-2">
            {!doneAccessRequested && mounted && getAuthToken() ? (
              <button
                type="button"
                onClick={() => {
                  if (partnerJoinCampaignSlug) {
                    goTo("partner-campaign-join", {
                      query: { campaign: partnerJoinCampaignSlug },
                    });
                    return;
                  }
                  goTo("business-dashboard");
                }}
                className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
              >
                {partnerJoinCampaignSlug
                  ? "Continue to join campaign"
                  : "Go to business dashboard"}
              </button>
            ) : !doneAccessRequested ? (
              <button
                type="button"
                onClick={() => {
                  prepareBusinessJoinAuth();
                  if (draft.email) stashClaimLockEmail(draft.email);
                  goTo("auth-login", {
                    query: { email: draft.email || undefined, token: undefined },
                  });
                }}
                className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
              >
                Create account (optional)
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => goTo("website-landing")}
              className="text-sm font-semibold text-primary"
            >
              Back to ForkUp home
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
