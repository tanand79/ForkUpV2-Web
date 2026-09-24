"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  Handshake,
  Loader2,
  Plus,
  Send,
  Settings2,
  Store,
  ShieldCheck,
  Clock,
  XCircle,
  Landmark,
} from "lucide-react";
import { useCampaign } from "@/lib/campaign-context";
import { campaignPublicPath } from "@/lib/campaign-paths";
import { syncAuthSession } from "@/lib/auth-session";
import { getAuthToken } from "@/lib/auth-storage";
import { formatDateUs, formatDateTimeUs, looksLikeIsoDateTime } from "@/lib/date-only";
import {
  fetchBusinessCollaborations,
  fetchCurrentUser,
  searchBusinesses,
  type BusinessCollaboration,
} from "@/lib/api";
import { formatRespondByLabel } from "@/lib/business-status";
import { RequestAgainButton } from "@/components/campaign/RequestAgainButton";
import { BusinessPostStartChecklistPanel } from "@/components/campaign/BusinessPostStartChecklist";
import { EmailTemplatesPanel } from "@/components/campaign/EmailTemplatesPanel";
import { flushPendingPartnerJoinRequest } from "@/lib/partner-join-intent";
import { BusinessVenueProfile } from "@/components/campaign/business-ai/BusinessVenueProfile";
import {
  fetchBusinessVenueImages,
  findBusinessProfile,
  saveBusinessVenueGallery,
  saveBusinessVenueLinks,
} from "@/lib/api-business-onboarding";
import { websiteOriginUrl } from "@/lib/business-join-query";
import { loadBusinessJoinDraft } from "@/lib/business-join-four-step-draft";
import {
  isOpenVenueDay,
  loadCachedVenuePhotos,
  loadContactLookupTried,
  loadVenueProfileSnapshot,
  markContactLookupTried,
  mergeVenueSnapshotKeepExisting,
  normalizeVenueHours,
  saveCachedVenuePhotos,
  saveVenueProfileSnapshot,
  venueFromDashboardBusiness,
  VENUE_DAYS,
  type VenueProfileSnapshot,
} from "@/lib/business-venue-profile";

type CollabTab = "pending" | "active" | "completed";

type StatusTone = "pending" | "active" | "completed";

function hasEligibleHours(hours: VenueProfileSnapshot["hours"]): boolean {
  return VENUE_DAYS.some((day) => isOpenVenueDay(hours[day]));
}

const STATUS_TONE: Record<StatusTone, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  active: "bg-primary/15 text-primary",
  completed: "bg-secondary text-secondary-foreground",
};

function formatDateRange(start: string | null, end: string | null): string | undefined {
  const fmt = (d: string) =>
    looksLikeIsoDateTime(d) ? formatDateTimeUs(d) : formatDateUs(d);
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return `From ${fmt(start)}`;
  return undefined;
}

function collabTab(c: BusinessCollaboration): CollabTab {
  if (
    c.direction === "outgoing" &&
    c.nonprofitInviteStatus === "pending"
  ) {
    return "pending";
  }
  if (
    ["invited", "pending", "opened", "changes_requested", "needs_info"].includes(
      c.acceptanceStatus,
    )
  ) {
    return "pending";
  }
  if (
    c.campaign.status === "closed" ||
    c.campaign.status === "settlement" ||
    c.acceptanceStatus === "completed"
  ) {
    return "completed";
  }
  return "active";
}

function statusLabel(c: BusinessCollaboration): string {
  if (c.direction === "outgoing" && c.nonprofitInviteStatus === "pending") {
    return "Awaiting nonprofit";
  }
  if (c.acceptanceStatus === "changes_requested" || c.acceptanceStatus === "needs_info") {
    return "Needs info";
  }
  if (c.acceptanceStatus === "opened") return "Opened — respond soon";
  if (c.acceptanceStatus === "expired") return "Expired";
  if (["invited", "pending"].includes(c.acceptanceStatus)) return "Action needed";
  if (c.campaign.status === "live") return "Live";
  if (c.campaign.status === "ready_to_launch") return "Scheduled";
  if (c.campaign.status === "invitation_phase") return "In setup";
  if (c.campaign.status === "closed" || c.campaign.status === "settlement") return "Completed";
  if (c.acceptanceStatus === "accepted" || c.acceptanceStatus === "live") return "Partnership active";
  return c.acceptanceStatus;
}

function statusTone(c: BusinessCollaboration): StatusTone {
  return collabTab(c);
}

function StatusPill({ label, tone }: { label: string; tone: StatusTone }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_TONE[tone]}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

export function BusinessDashboard() {
  const { goTo, state, setBusinessProfile } = useCampaign();
  const biz = state.businessProfile;
  const [accountName, setAccountName] = useState<string | null>(null);
  const [tab, setTab] = useState<CollabTab>("active");
  const [collaborations, setCollaborations] = useState<BusinessCollaboration[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const collaborationsRef = useRef<HTMLElement | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState(false);
  const [venue, setVenue] = useState<VenueProfileSnapshot | null>(null);
  const [photosLoading, setPhotosLoading] = useState(false);
  const venueHydrateGen = useRef(0);

  // Warm photo cache as soon as the dashboard loads so "View profile" is instant.
  useEffect(() => {
    if (!biz?.id || !biz.businessName) return;
    const saved = loadVenueProfileSnapshot(biz.id);
    if (saved?.photoUrls && saved.photoUrls.length > 0) {
      saveCachedVenuePhotos(biz.id, saved.photoUrls);
      return;
    }
    if (loadCachedVenuePhotos(biz.id)?.length) return;

    const draft = loadBusinessJoinDraft();
    const draftMatches =
      draft?.found &&
      draft.found.businessName.trim().toLowerCase() ===
        biz.businessName.trim().toLowerCase();
    let website = draftMatches ? draft.found?.website?.trim() || "" : "";
    let reservationUrl = draftMatches
      ? draft.found?.reservationUrl || null
      : null;

    let cancelled = false;
    void (async () => {
      try {
        if (!website) {
          const listed = await searchBusinesses(biz.businessName);
          if (cancelled) return;
          const match =
            listed.find((b) => b.id === biz.id) ||
            listed.find(
              (b) =>
                b.businessName.trim().toLowerCase() ===
                biz.businessName.trim().toLowerCase(),
            );
          website = match?.website?.trim() || "";
        }
        if (!website) return;
        const venueImages = await fetchBusinessVenueImages({
          websiteUrl: websiteOriginUrl(website),
          reservationUrl,
          businessId: biz.id,
        });
        if (cancelled || !venueImages.imageUrls?.length) return;
        saveCachedVenuePhotos(biz.id, venueImages.imageUrls);
        const prev = loadVenueProfileSnapshot(biz.id);
        if (prev) {
          saveVenueProfileSnapshot({
            ...prev,
            coverUrl:
              prev.coverUrl ||
              venueImages.coverUrl ||
              venueImages.imageUrls[0] ||
              null,
            photoUrls:
              prev.photoUrls.length > 0 ? prev.photoUrls : venueImages.imageUrls,
          });
        }
      } catch {
        /* prefetch is best-effort */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [biz?.id, biz?.businessName]);

  // Refresh claim / access-request status from the server on each visit.
  useEffect(() => {
    if (!getAuthToken()) return;
    void syncAuthSession(undefined, { force: true }).then((session) => {
      if (!session?.businessProfile) return;
      setBusinessProfile(session.businessProfile);
    });
  }, [setBusinessProfile]);

  const loadCollaborations = useCallback(() => {
    if (!biz?.id) return;
    setLoading(true);
    setError(null);
    void fetchBusinessCollaborations(biz.id)
      .then(setCollaborations)
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load collaborations");
        setCollaborations([]);
      })
      .finally(() => setLoading(false));
  }, [biz?.id]);

  useEffect(() => {
    void fetchCurrentUser()
      .then((user) => setAccountName(user.fullName?.trim() || user.email.split("@")[0]))
      .catch(() => setAccountName(null));
  }, []);

  useEffect(() => {
    loadCollaborations();
  }, [loadCollaborations]);

  // After public-campaign join intent + signup/claim — submit pending request.
  useEffect(() => {
    if (!getAuthToken() || !biz?.id) return;
    void flushPendingPartnerJoinRequest({
      businessId: biz.id,
      locationId: biz.locationId || undefined,
    }).then((status) => {
      if (status === "submitted") loadCollaborations();
    });
  }, [biz?.id, biz?.locationId, loadCollaborations]);

  const grouped = useMemo(() => {
    const pending: BusinessCollaboration[] = [];
    const active: BusinessCollaboration[] = [];
    const completed: BusinessCollaboration[] = [];
    for (const c of collaborations) {
      const bucket = collabTab(c);
      if (bucket === "pending") pending.push(c);
      else if (bucket === "completed") completed.push(c);
      else active.push(c);
    }
    return { pending, active, completed };
  }, [collaborations]);

  /**
   * Nick V2 Layer 6 — invitations that still need a business response.
   * Do not include already-accepted rows with setup/invite needs_info: Review only
   * opens the acceptance confirmation ("You're in"), so they would stay stuck here.
   */
  const needsBusinessAction = useMemo(() => {
    return collaborations.filter((c) =>
      ["invited", "pending", "opened", "changes_requested", "needs_info"].includes(
        c.acceptanceStatus,
      ),
    );
  }, [collaborations]);

  const summary = useMemo(
    () => [
      {
        tabId: "active" as const,
        label: "Active partnerships",
        value: String(grouped.active.length),
        icon: Handshake,
      },
      {
        tabId: "pending" as const,
        label: "Pending",
        value: String(grouped.pending.length),
        icon: Send,
      },
      {
        tabId: "completed" as const,
        label: "Completed",
        value: String(grouped.completed.length),
        icon: Store,
      },
    ],
    [grouped],
  );

  function openCollabTab(tabId: CollabTab) {
    setTab(tabId);
    collaborationsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const cards = grouped[tab];

  function openVenueProfile() {
    if (!biz) return;
    const gen = ++venueHydrateGen.current;
    const saved = loadVenueProfileSnapshot(biz.id);
    const draft = loadBusinessJoinDraft();
    const draftMatches =
      draft?.found &&
      draft.found.businessName.trim().toLowerCase() ===
        biz.businessName.trim().toLowerCase();
    const found = draftMatches ? draft.found : null;
    const draftHours = draft ? normalizeVenueHours(draft.discountHours) : null;
    const cachedPhotos = loadCachedVenuePhotos(biz.id) ?? [];

    const fallback = venueFromDashboardBusiness({
      id: biz.id,
      businessName: biz.businessName,
      locationName: biz.locationName,
      dineAndDonate: biz.capabilities.dineAndDonate,
    });

    const photoUrls =
      (saved?.photoUrls && saved.photoUrls.length > 0
        ? saved.photoUrls
        : null) ??
      (cachedPhotos.length > 0 ? cachedPhotos : null) ??
      (found?.imageUrls && found.imageUrls.length > 0
        ? found.imageUrls.filter(Boolean)
        : null) ??
      [];

    const savedHours = normalizeVenueHours(saved?.hours ?? null);
    const hours = hasEligibleHours(savedHours)
      ? savedHours
      : draftHours && hasEligibleHours(draftHours)
        ? draftHours
        : normalizeVenueHours(found?.discountHours ?? null);

    const base: VenueProfileSnapshot = {
      ...(saved ?? fallback),
      businessId: biz.id,
      businessName: saved?.businessName || biz.businessName,
      address: saved?.address || found?.address || fallback.address,
      city: saved?.city || found?.city || "",
      state: saved?.state || found?.state || "",
      zip: saved?.zip || found?.zip || "",
      about: saved?.about || found?.about || "",
      coverUrl: saved?.coverUrl || photoUrls[0] || found?.logoUrl || null,
      photoUrls,
      hours: hasEligibleHours(hours) ? hours : savedHours,
      eligibleWindow:
        saved?.eligibleWindow?.trim() ||
        draft?.eligibleWindow?.trim() ||
        found?.eligibleWindow?.trim() ||
        "",
      isRestaurant:
        saved?.isRestaurant !== undefined
          ? saved.isRestaurant
          : biz.capabilities.dineAndDonate,
      websiteUrl:
        saved?.websiteUrl?.trim() || found?.website?.trim() || null,
      facebookUrl:
        saved?.facebookUrl?.trim() || found?.facebookUrl?.trim() || null,
      instagramUrl:
        saved?.instagramUrl?.trim() || found?.instagramUrl?.trim() || null,
      linkedinUrl:
        saved?.linkedinUrl?.trim() || found?.linkedinUrl?.trim() || null,
      youtubeUrl: saved?.youtubeUrl?.trim() || found?.youtubeUrl?.trim() || null,
      tiktokUrl: saved?.tiktokUrl?.trim() || found?.tiktokUrl?.trim() || null,
      phone: saved?.phone?.trim() || found?.phone?.trim() || null,
      email: saved?.email?.trim() || found?.contactEmail?.trim() || null,
    };

    setVenue(base);
    setEditingVenue(false);
    setProfileOpen(true);

    const needsPhotos = base.photoUrls.length === 0 && !base.coverUrl;
    const needsAbout = !base.about.trim();
    const needsAddress = !base.address.trim() && !base.city.trim();
    const needsHours = !hasEligibleHours(base.hours);
    /** Scrape social when both FB and IG missing. */
    const needsSocial =
      !base.facebookUrl?.trim() && !base.instagramUrl?.trim();
    /** Contact once per session — do not re-find forever when a site has no email. */
    const needsContact =
      (!base.phone?.trim() || !base.email?.trim()) &&
      !loadContactLookupTried(biz.id);
    if (
      !needsPhotos &&
      !needsAbout &&
      !needsAddress &&
      !needsHours &&
      !needsSocial &&
      !needsContact
    ) {
      setPhotosLoading(false);
      if (base.photoUrls.length > 0) saveCachedVenuePhotos(biz.id, base.photoUrls);
      return;
    }

    // Show spinner only when we have no gallery yet — details hydrate silently.
    setPhotosLoading(needsPhotos);

    void (async () => {
      try {
        let website = found?.website?.trim() || base.websiteUrl?.trim() || "";
        let reservationUrl = found?.reservationUrl?.trim() || null;
        let nextPhotos: string[] = [...base.photoUrls];
        let about = base.about;
        let address = base.address;
        let city = base.city;
        let state = base.state;
        let zip = base.zip;
        let businessName = base.businessName;
        let nextHours = base.hours;
        let eligibleWindow = base.eligibleWindow;
        let facebookUrl = base.facebookUrl?.trim() || null;
        let instagramUrl = base.instagramUrl?.trim() || null;
        let linkedinUrl = base.linkedinUrl?.trim() || null;
        let youtubeUrl = base.youtubeUrl?.trim() || null;
        let tiktokUrl = base.tiktokUrl?.trim() || null;
        let phone = base.phone?.trim() || null;
        let email = base.email?.trim() || null;

        // Fast path: known website → Resy/site scrape only (skip slow find-business).
        if (needsPhotos && !website) {
          try {
            const listed = await searchBusinesses(biz.businessName);
            if (gen !== venueHydrateGen.current) return;
            const match =
              listed.find((b) => b.id === biz.id) ||
              listed.find(
                (b) =>
                  b.businessName.trim().toLowerCase() ===
                  biz.businessName.trim().toLowerCase(),
              );
            website = match?.website?.trim() || "";
            const loc = match?.locations?.[0];
            if (loc) {
              address = address || loc.address || "";
              city = city || loc.city || "";
              state = state || loc.state || "";
            }
          } catch {
            /* continue */
          }
        }

        if (needsPhotos && website) {
          try {
            const venueImages = await fetchBusinessVenueImages({
              websiteUrl: websiteOriginUrl(website),
              reservationUrl,
              businessId: biz.id,
            });
            if (gen !== venueHydrateGen.current) return;
            if (venueImages.imageUrls?.length) {
              nextPhotos = venueImages.imageUrls;
              saveCachedVenuePhotos(biz.id, nextPhotos);
              setVenue((prev) => {
                if (!prev || prev.businessId !== biz.id) return prev;
                const next: VenueProfileSnapshot = {
                  ...prev,
                  address: address || prev.address,
                  city: city || prev.city,
                  state: state || prev.state,
                  coverUrl:
                    prev.coverUrl ||
                    venueImages.coverUrl ||
                    nextPhotos[0] ||
                    null,
                  photoUrls: nextPhotos,
                };
                saveVenueProfileSnapshot(next);
                return next;
              });
              setPhotosLoading(false);
            }
          } catch {
            /* fall through to find */
          }
        }

        const stillNeedsPhotos = nextPhotos.length === 0 && !base.coverUrl;
        const stillNeedsDetails =
          needsAbout ||
          needsAddress ||
          needsHours ||
          needsSocial ||
          needsContact ||
          !website ||
          stillNeedsPhotos;
        if (!stillNeedsDetails) return;

        const discovered = await findBusinessProfile({
          businessName: biz.businessName,
          joinDoorType: biz.capabilities.dineAndDonate ? "restaurant" : "local",
          ...(website ? { website } : {}),
          businessId: biz.id,
        });
        if (gen !== venueHydrateGen.current) return;

        website = website || discovered.website?.trim() || "";
        reservationUrl =
          reservationUrl || discovered.reservationUrl?.trim() || null;
        about = about || discovered.about || "";
        address = address || discovered.address || "";
        city = city || discovered.city || "";
        state = state || discovered.state || "";
        zip = zip || discovered.zip || "";
        businessName = businessName || discovered.businessName || biz.businessName;
        eligibleWindow =
          eligibleWindow || discovered.eligibleWindow?.trim() || "";
        facebookUrl = facebookUrl || discovered.facebookUrl?.trim() || null;
        instagramUrl = instagramUrl || discovered.instagramUrl?.trim() || null;
        linkedinUrl = linkedinUrl || discovered.linkedinUrl?.trim() || null;
        youtubeUrl = youtubeUrl || discovered.youtubeUrl?.trim() || null;
        tiktokUrl = tiktokUrl || discovered.tiktokUrl?.trim() || null;
        phone = phone || discovered.phone?.trim() || null;
        email = email || discovered.contactEmail?.trim() || null;
        if (needsContact) markContactLookupTried(biz.id);
        const foundHours = normalizeVenueHours(discovered.discountHours);
        if (!hasEligibleHours(nextHours) && hasEligibleHours(foundHours)) {
          nextHours = foundHours;
        }
        if (
          stillNeedsPhotos &&
          Array.isArray(discovered.imageUrls) &&
          discovered.imageUrls.length > 0
        ) {
          nextPhotos = discovered.imageUrls.filter(Boolean);
        }

        if (stillNeedsPhotos && website) {
          try {
            const venueImages = await fetchBusinessVenueImages({
              websiteUrl: websiteOriginUrl(website),
              reservationUrl,
              businessId: biz.id,
            });
            if (gen !== venueHydrateGen.current) return;
            if (venueImages.imageUrls?.length) nextPhotos = venueImages.imageUrls;
          } catch {
            /* keep find photos */
          }
        }

        if (nextPhotos.length > 0) saveCachedVenuePhotos(biz.id, nextPhotos);

        setVenue((prev) => {
          if (!prev || prev.businessId !== biz.id) return prev;
          const next = mergeVenueSnapshotKeepExisting(prev, {
            businessName,
            address,
            city,
            state,
            zip,
            about,
            coverUrl: nextPhotos[0] || prev.coverUrl || discovered.logoUrl || null,
            photoUrls: nextPhotos.length > 0 ? nextPhotos : prev.photoUrls,
            hours: hasEligibleHours(nextHours) ? nextHours : prev.hours,
            eligibleWindow,
            websiteUrl: website || null,
            facebookUrl,
            instagramUrl,
            linkedinUrl,
            youtubeUrl,
            tiktokUrl,
            phone,
            email,
          });
          saveVenueProfileSnapshot(next);
          return next;
        });
      } catch {
        if (needsContact) markContactLookupTried(biz.id);
        /* keep whatever we already show */
      } finally {
        if (gen === venueHydrateGen.current) setPhotosLoading(false);
      }
    })();
  }

  function changeVenue(patch: Partial<VenueProfileSnapshot>) {
    setVenue((prev) => {
      if (!prev) return prev;
      const next: VenueProfileSnapshot = {
        ...prev,
        ...patch,
        hours: normalizeVenueHours(patch.hours ?? prev.hours),
        businessId: biz?.id ?? prev.businessId,
      };
      saveVenueProfileSnapshot(next);
      if (next.photoUrls.length > 0 && next.businessId) {
        saveCachedVenuePhotos(next.businessId, next.photoUrls);
      }

      const businessId = next.businessId;
      const token = getAuthToken();
      const shouldPersistGallery =
        businessId != null &&
        (patch.photoUrls != null || patch.coverUrl !== undefined);
      if (shouldPersistGallery && token) {
        void saveBusinessVenueGallery({
          businessId,
          ...(patch.photoUrls != null ? { imageUrls: patch.photoUrls } : {}),
          ...(patch.coverUrl !== undefined ? { coverUrl: patch.coverUrl } : {}),
        }).catch(() => {
          /* local snapshot already saved; durable sync is best-effort */
        });
      }
      // Social/contact fields: local snapshot only here; durable flush on Done.
      return next;
    });
  }

  function flushVenueLinks(snapshot: VenueProfileSnapshot) {
    const businessId = snapshot.businessId ?? biz?.id ?? null;
    if (!businessId || !getAuthToken()) return;
    void saveBusinessVenueLinks({
      businessId,
      website: snapshot.websiteUrl?.trim() || null,
      facebookUrl: snapshot.facebookUrl?.trim() || null,
      instagramUrl: snapshot.instagramUrl?.trim() || null,
      phone: snapshot.phone?.trim() || null,
      venueEmail: snapshot.email?.trim() || null,
    }).catch(() => {
      /* best-effort durable sync */
    });
  }

  if (profileOpen && venue) {
    return (
      <BusinessVenueProfile
        profile={venue}
        editing={editingVenue}
        photosLoading={photosLoading}
        onToggleEdit={() => {
          setEditingVenue((wasEditing) => {
            if (wasEditing) flushVenueLinks(venue);
            return !wasEditing;
          });
        }}
        onChange={changeVenue}
        onBack={() => {
          if (editingVenue) flushVenueLinks(venue);
          setEditingVenue(false);
          setPhotosLoading(false);
          setProfileOpen(false);
        }}
        backLabel="Back to dashboard"
      />
    );
  }

  if (!biz) {
    return (
      <main className="mx-auto max-w-lg px-5 py-12 text-center">
        <Store className="mx-auto size-10 text-primary" />
        <h1 className="mt-4 text-2xl font-bold">Set up your business</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Claim your business profile to accept campaign invitations and partner with nonprofits.
        </p>
        <button
          type="button"
          onClick={() => goTo("business-ai-onboarding")}
          className="btn-primary mt-6 rounded-full px-6 py-3 text-sm font-semibold"
        >
          Set up business profile
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 pb-24 sm:px-6 sm:py-12">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Business partner home
          </p>
          <h1 className="font-display mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Welcome back{accountName ? `, ${accountName}` : ""}
          </h1>
          <p className="mt-1 text-base font-medium">{biz.businessName}</p>
          {biz.claimStatus === "verified" ? (
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <ShieldCheck className="size-3.5" />
              Verified business
            </span>
          ) : biz.accessRequestStatus === "denied" ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                <XCircle className="size-3.5" />
                Verification denied
              </span>
              <RequestAgainButton
                kind="organization"
                organizationType="business"
                organizationId={biz.id}
                onSuccess={async () => {
                  const session = await syncAuthSession(undefined, { force: true });
                  if (session?.businessProfile) setBusinessProfile(session.businessProfile);
                }}
              />
            </div>
          ) : biz.claimStatus === "needs_review" || biz.accessRequestStatus === "pending" ? (
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              <Clock className="size-3.5" />
              Verification pending
            </span>
          ) : null}
          <p className="mt-2 max-w-xl text-muted-foreground">
            Manage your business profile, respond to campaign invitations, and invite nonprofits to
            partner with you.
          </p>
          <button
            type="button"
            onClick={openVenueProfile}
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary-dark"
          >
            <Store className="size-4" />
            View profile
          </button>
          <button
            type="button"
            onClick={() => goTo("business-claim")}
            className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary-dark"
          >
            <Settings2 className="size-4" />
            Edit business profile
          </button>
          <button
            type="button"
            onClick={() => goTo("ach-settings")}
            className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary-dark"
          >
            <Landmark className="size-4" />
            ACH settings
          </button>
        </div>
        <button
          type="button"
          onClick={() => goTo("business-invites-nonprofit")}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-dark"
        >
          <Plus className="size-4" />
          Invite a nonprofit
        </button>
      </div>

      <BusinessPostStartChecklistPanel businessId={biz.id} />

      <div className="mt-8">
        <EmailTemplatesPanel
          scopeType="business"
          scopeId={biz.id}
          title="Email templates"
          description="Edit nonprofit invite copy, set the From name, preview, and send."
        />
      </div>

      <section className="mt-8 grid gap-3 sm:grid-cols-3">
        {summary.map(({ tabId, label, value, icon: Icon }) => (
          <button
            key={label}
            type="button"
            onClick={() => openCollabTab(tabId)}
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary/40"
          >
            <Icon className="size-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-lg font-bold leading-tight">{value}</p>
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
            </div>
          </button>
        ))}
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => goTo("business-invites-nonprofit")}
          className="rounded-2xl border border-border bg-card p-6 text-left transition-colors hover:border-primary/40"
        >
          <Send className="size-6 text-primary" />
          <p className="mt-3 font-semibold">Start a campaign invitation</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Invite a nonprofit to run a Dine &amp; Donate, Shop &amp; Donate, or other method at your
            location.
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
            Get started <ArrowRight className="size-4" />
          </span>
        </button>
        <div className="rounded-2xl border border-border bg-card p-6">
          <Handshake className="size-6 text-primary" />
          <p className="mt-3 font-semibold">How collaborations work</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Nonprofits invite you to campaigns, or you invite them. Accepted partnerships appear below
            with campaign dates, giveback terms, and status.
          </p>
        </div>
      </section>

      {needsBusinessAction.length > 0 && (
        <section className="animate-rise mt-8 rounded-3xl border border-amber-300/60 bg-amber-50/70 p-5 dark:border-amber-900 dark:bg-amber-950/30">
          <h2 className="flex items-center gap-2 text-base font-bold text-amber-950 dark:text-amber-100">
            <Clock className="size-4" />
            Needs your action
          </h2>
          <p className="mt-1 text-sm text-amber-900/90 dark:text-amber-100/80">
            Respond to invitations so your business can appear as a participating partner.
          </p>
          <ul className="mt-3 space-y-2">
            {needsBusinessAction.slice(0, 5).map((c) => (
              <li
                key={`action-${c.id}-${c.campaign.slug}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-200/70 bg-card px-3 py-2 text-sm dark:border-amber-900"
              >
                <span>
                  <span className="font-semibold">{c.campaign.name}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {statusLabel(c)}
                    {c.respondByDate
                      ? ` · respond by ${formatRespondByLabel(c.respondByDate)}`
                      : ""}
                  </span>
                </span>
                {c.reviewPath && (
                  <a
                    href={c.reviewPath}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
                  >
                    Review <ArrowRight className="size-3.5" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section ref={collaborationsRef} className="animate-rise mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-extrabold tracking-tight">
            Campaign collaborations
          </h2>
          <div className="inline-flex rounded-full border border-border bg-card p-1">
            {(
              [
                { id: "pending" as const, label: "Pending" },
                { id: "active" as const, label: "Active" },
                { id: "completed" as const, label: "Completed" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                  tab === t.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="mt-8 flex justify-center py-8">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        )}

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

        {!loading && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {cards.map((c) => {
              const tone = statusTone(c);
              const dates = formatDateRange(c.campaign.startDate, c.campaign.endDate);
              const needsReview =
                tab === "pending" &&
                c.reviewPath &&
                ["invited", "pending", "opened", "changes_requested", "needs_info"].includes(
                  c.acceptanceStatus,
                );
              return (
                <div
                  key={`${c.id}-${c.campaign.slug}`}
                  className="flex flex-col rounded-2xl border border-border bg-card p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-display text-base font-bold leading-snug">
                        {c.campaign.name}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">{c.campaign.nonprofit}</p>
                    </div>
                    <StatusPill label={statusLabel(c)} tone={tone} />
                  </div>

                  <p className="mt-3 text-sm text-muted-foreground">
                    {c.method.name} · {c.givebackPercentage}% giveback · {c.location.name},{" "}
                    {c.location.city}
                  </p>

                  {c.participationHours && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Hours: {c.participationHours}
                    </p>
                  )}

                  {dates && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarClock className="size-3.5" />
                      {dates}
                    </p>
                  )}

                  {c.direction === "outgoing" && c.nonprofitInviteStatus === "pending" && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      You invited this nonprofit — waiting for them to accept and complete setup.
                    </p>
                  )}

                  {needsReview && (
                    <div className="mt-4">
                      <a
                        href={c.reviewPath!}
                        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-dark active:scale-95"
                      >
                        Review invitation <ArrowRight className="size-4" />
                      </a>
                    </div>
                  )}

                  {tab === "active" && c.campaign.slug && (
                    <div className="mt-4">
                      <a
                        href={campaignPublicPath(c.campaign.slug)}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:text-primary-dark"
                      >
                        View public campaign <ArrowRight className="size-3.5" />
                      </a>
                    </div>
                  )}
                </div>
              );
            })}

            {cards.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground sm:col-span-2">
                {tab === "pending"
                  ? "No pending invitations or outreach right now."
                  : tab === "active"
                    ? "No active partnerships yet. Accept a campaign invitation or invite a nonprofit to get started."
                    : "No completed collaborations yet."}{" "}
                <button
                  type="button"
                  onClick={() => goTo("business-invites-nonprofit")}
                  className="font-semibold text-primary"
                >
                  Invite a nonprofit
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
