"use client";

/**
 * Businesses near Live Campaigns (Pass B).
 * Unclaimed hidden by API. Pending → blurred + Awaiting verification on profile.
 * View profile → original BusinessVenueProfile (gallery + details), not a text modal.
 * Invite: signed out → Start Campaign; signed in → pick a specific campaign.
 */
import { useEffect, useRef, useState } from "react";
import { Clock, Loader2, Send } from "lucide-react";
import {
  appendCampaignBusinessInvitations,
  fetchBusinessDirectory,
  fetchBuilderCampaign,
  fetchManageCampaigns,
  type BusinessDirectoryItem,
  type ManageCampaignSummary,
} from "@/lib/api";
import {
  fetchBusinessVenueImages,
  findBusinessProfile,
} from "@/lib/api-business-onboarding";
import { websiteOriginUrl } from "@/lib/business-join-query";
import type { ApiMethodType } from "@/lib/builder-submit";
import { getAuthToken } from "@/lib/auth-storage";
import { prepareDirectoryInviteAuth } from "@/lib/campaign-auth";
import {
  businessFromDirectoryInviteIntent,
  consumeDirectoryInviteIntent,
  stashDirectoryInviteIntent,
} from "@/lib/directory-invite-intent";
import { useCampaign } from "@/lib/campaign-context";
import { useClientMounted } from "@/lib/use-client-mounted";
import {
  loadVenueProfileSnapshot,
  saveVenueProfileSnapshot,
  normalizeVenueHours,
  isOpenVenueDay,
  loadContactLookupTried,
  markContactLookupTried,
  mergeVenueSnapshotKeepExisting,
  VENUE_DAYS,
  type VenueProfileSnapshot,
} from "@/lib/business-venue-profile";
import { HomepageBusinessCard } from "@/components/campaign/HomepageBusinessCard";
import { BusinessVenueProfile } from "@/components/campaign/business-ai/BusinessVenueProfile";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type NearbyOpts = {
  locationReady: boolean;
  allLocations: boolean;
  nearby: { lat: number; lng: number; radiusMiles?: number } | null;
};

type Props = {
  nearby: NearbyOpts;
  onStartCampaign: () => void;
  /** When true, omit standalone heading — parent owns Live Campaigns / Business switch. */
  embedded?: boolean;
};

const BUSINESS_METHOD_ORDER: ApiMethodType[] = [
  "dine_and_donate",
  "shop_and_donate",
  "service_giveback",
  "guest_bartending_event",
];

const VENUE_PHOTO_CACHE_PREFIX = "forkup-venue-photos:";

function venuePhotoCacheKey(businessId: number): string {
  return `${VENUE_PHOTO_CACHE_PREFIX}${businessId}`;
}

function loadCachedVenuePhotos(businessId: number): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(venuePhotoCacheKey(businessId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const urls = parsed.filter(
      (u): u is string => typeof u === "string" && u.trim().length > 0,
    );
    return urls.length > 0 ? urls : null;
  } catch {
    return null;
  }
}

function saveCachedVenuePhotos(businessId: number, urls: string[]) {
  if (typeof window === "undefined" || urls.length === 0) return;
  try {
    sessionStorage.setItem(venuePhotoCacheKey(businessId), JSON.stringify(urls));
  } catch {
    /* ignore quota */
  }
}

function hasEligibleHours(hours: VenueProfileSnapshot["hours"]): boolean {
  return VENUE_DAYS.some((day) => isOpenVenueDay(hours[day]));
}

function pickInviteMethod(
  campaignMethods: string[],
  caps: BusinessDirectoryItem["capabilities"],
): ApiMethodType | null {
  const onCampaign = new Set(campaignMethods);
  const supported: ApiMethodType[] = [];
  if (caps.dineAndDonate) supported.push("dine_and_donate");
  if (caps.shopAndDonate) supported.push("shop_and_donate");
  if (caps.serviceGiveback) supported.push("service_giveback");
  if (caps.guestBartending) supported.push("guest_bartending_event");

  for (const m of supported) {
    if (onCampaign.has(m)) return m;
  }
  for (const m of BUSINESS_METHOD_ORDER) {
    if (onCampaign.has(m)) return m;
  }
  return null;
}

export function HomepageBusinessDirectory({ nearby, onStartCampaign, embedded }: Props) {
  const { state } = useCampaign();
  const mounted = useClientMounted();
  const isLoggedIn = mounted && Boolean(getAuthToken());

  const [rows, setRows] = useState<BusinessDirectoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [coverById, setCoverById] = useState<Record<number, string>>({});
  const inviteResumeDone = useRef(false);

  const [venueProfile, setVenueProfile] = useState<VenueProfileSnapshot | null>(null);
  const [profileSource, setProfileSource] = useState<BusinessDirectoryItem | null>(null);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [venueReservationUrl, setVenueReservationUrl] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteBusiness, setInviteBusiness] = useState<BusinessDirectoryItem | null>(null);
  const [campaigns, setCampaigns] = useState<ManageCampaignSummary[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [campaignsError, setCampaignsError] = useState<string | null>(null);
  const [invitingSlug, setInvitingSlug] = useState<string | null>(null);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    if (!nearby.locationReady) return;
    let cancelled = false;
    setLoading(true);
    const request = nearby.allLocations
      ? fetchBusinessDirectory({ limit: 24 })
      : fetchBusinessDirectory({ nearby: nearby.nearby, limit: 24 });
    void request
      .then((list) => {
        if (cancelled) return;
        setRows(list);
        const covers: Record<number, string> = {};
        for (const b of list) {
          const cached = loadCachedVenuePhotos(b.id)?.[0];
          const saved = loadVenueProfileSnapshot(b.id);
          const dbCover =
            Array.isArray(b.galleryImageUrls) && b.galleryImageUrls[0]
              ? b.galleryImageUrls[0]
              : null;
          const url =
            saved?.coverUrl || saved?.photoUrls?.[0] || cached || dbCover;
          if (url) covers[b.id] = url;
        }
        setCoverById(covers);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    nearby.locationReady,
    nearby.allLocations,
    nearby.nearby?.lat,
    nearby.nearby?.lng,
    nearby.nearby?.radiusMiles,
  ]);

  function openProfile(business: BusinessDirectoryItem) {
    const loc = business.locations[0];
    const saved = loadVenueProfileSnapshot(business.id);
    const cachedPhotos = loadCachedVenuePhotos(business.id) ?? [];
    const dbGallery = Array.isArray(business.galleryImageUrls)
      ? business.galleryImageUrls.filter((u) => typeof u === "string" && u.trim())
      : [];
    const photoUrls =
      (saved?.photoUrls && saved.photoUrls.length > 0
        ? saved.photoUrls
        : null) ??
      (cachedPhotos.length > 0 ? cachedPhotos : null) ??
      (dbGallery.length > 0 ? dbGallery : null) ??
      [];

    const savedHours = normalizeVenueHours(saved?.hours ?? null);
    const base: VenueProfileSnapshot = {
      businessId: business.id,
      businessName: saved?.businessName || business.businessName,
      address: saved?.address || "",
      city: saved?.city || loc?.city || "",
      state: saved?.state || loc?.state || "",
      zip: saved?.zip || "",
      about: saved?.about || "",
      coverUrl: saved?.coverUrl || photoUrls[0] || null,
      photoUrls,
      hours: savedHours,
      eligibleWindow: saved?.eligibleWindow?.trim() || "",
      givebackPercent: saved?.givebackPercent ?? 15,
      causeName: saved?.causeName ?? null,
      isRestaurant:
        saved?.isRestaurant !== undefined
          ? saved.isRestaurant
          : business.capabilities.dineAndDonate,
      websiteUrl: saved?.websiteUrl?.trim() || business.website?.trim() || null,
      facebookUrl:
        saved?.facebookUrl?.trim() || business.facebookUrl?.trim() || null,
      instagramUrl:
        saved?.instagramUrl?.trim() || business.instagramUrl?.trim() || null,
      linkedinUrl:
        saved?.linkedinUrl?.trim() || business.linkedinUrl?.trim() || null,
      youtubeUrl: saved?.youtubeUrl?.trim() || null,
      tiktokUrl: saved?.tiktokUrl?.trim() || business.tiktokUrl?.trim() || null,
      phone: saved?.phone?.trim() || business.contactPhone?.trim() || null,
      email: saved?.email?.trim() || business.venueEmail?.trim() || null,
    };

    setProfileSource(business);
    setVenueProfile(base);
    setVenueReservationUrl(null);

    const hasRealGallery = photoUrls.length > 0;
    if (hasRealGallery) {
      saveCachedVenuePhotos(business.id, photoUrls);
      setPhotosLoading(false);
      setCoverById((prev) => ({
        ...prev,
        [business.id]: photoUrls[0]!,
      }));
      saveVenueProfileSnapshot(base);
    }

    const needsAbout = !base.about.trim();
    const needsHours = !hasEligibleHours(base.hours);
    const needsSocial =
      !base.facebookUrl?.trim() && !base.instagramUrl?.trim();
    const needsContact =
      (!base.phone?.trim() || !base.email?.trim()) &&
      !loadContactLookupTried(business.id);
    const needsDetails = needsAbout || needsHours || needsSocial || needsContact;
    const needsPhotos = !hasRealGallery;
    if (!needsPhotos && !needsDetails) return;

    if (needsPhotos) setPhotosLoading(true);
    const isRestaurant = business.capabilities.dineAndDonate;

    void (async () => {
      let website = business.website?.trim() || base.websiteUrl?.trim() || "";
      let about = base.about;
      let address = base.address;
      let city = base.city;
      let state = base.state;
      let zip = base.zip;
      let businessName = base.businessName;
      let nextPhotos: string[] = hasRealGallery ? [...photoUrls] : [];
      let nextHours = base.hours;
      let eligibleWindow = base.eligibleWindow;
      let facebookUrl = base.facebookUrl?.trim() || null;
      let instagramUrl = base.instagramUrl?.trim() || null;
      let linkedinUrl = base.linkedinUrl?.trim() || null;
      let youtubeUrl = base.youtubeUrl?.trim() || null;
      let tiktokUrl = base.tiktokUrl?.trim() || null;
      let phone = base.phone?.trim() || null;
      let email = base.email?.trim() || null;

      try {
        // Fast path: gallery from website — never wait on full find-business.
        const origin = websiteOriginUrl(website);
        if (needsPhotos && origin) {
          try {
            const venue = await fetchBusinessVenueImages({
              websiteUrl: origin,
              reservationUrl: null,
              businessId: business.id,
            });
            if (venue.imageUrls?.length) {
              nextPhotos = venue.imageUrls;
              saveCachedVenuePhotos(business.id, nextPhotos);
              setCoverById((prev) => ({
                ...prev,
                [business.id]: nextPhotos[0]!,
              }));
              setVenueProfile((prev) => {
                if (!prev || prev.businessId !== business.id) return prev;
                const next = mergeVenueSnapshotKeepExisting(prev, {
                  coverUrl: nextPhotos[0]!,
                  photoUrls: nextPhotos,
                });
                saveVenueProfileSnapshot(next);
                return next;
              });
              setPhotosLoading(false);
            }
            const scrapedBook = venue.reservationUrl?.trim();
            if (scrapedBook) {
              setVenueReservationUrl((prev) => prev || scrapedBook);
            }
          } catch {
            /* fall through to find for photos */
          }
        }

        if (!needsDetails && nextPhotos.length > 0) {
          setPhotosLoading(false);
          return;
        }

        if (needsDetails || nextPhotos.length === 0) {
          try {
            const found = await findBusinessProfile({
              businessName: business.businessName,
              joinDoorType: isRestaurant ? "restaurant" : "local",
              ...(website ? { website } : {}),
              businessId: business.id,
            });
            website = website || found.website?.trim() || "";
            about = about || found.about || "";
            address = address || found.address || "";
            city = city || found.city || "";
            state = state || found.state || "";
            zip = zip || found.zip || "";
            businessName =
              businessName || found.businessName?.trim() || businessName;
            facebookUrl = facebookUrl || found.facebookUrl?.trim() || null;
            instagramUrl = instagramUrl || found.instagramUrl?.trim() || null;
            linkedinUrl = linkedinUrl || found.linkedinUrl?.trim() || null;
            youtubeUrl = youtubeUrl || found.youtubeUrl?.trim() || null;
            tiktokUrl = tiktokUrl || found.tiktokUrl?.trim() || null;
            phone = phone || found.phone?.trim() || null;
            email = email || found.contactEmail?.trim() || null;
            if (needsContact) markContactLookupTried(business.id);
            if (
              nextPhotos.length === 0 &&
              Array.isArray(found.imageUrls) &&
              found.imageUrls.length > 0
            ) {
              nextPhotos = found.imageUrls.filter(Boolean);
            }
            const foundHours = normalizeVenueHours(found.discountHours);
            if (needsHours && hasEligibleHours(foundHours)) {
              nextHours = foundHours;
            }
            eligibleWindow =
              eligibleWindow || found.eligibleWindow?.trim() || "";
            const foundBook = found.reservationUrl?.trim();
            if (foundBook) setVenueReservationUrl((prev) => prev || foundBook);
          } catch {
            if (needsContact) markContactLookupTried(business.id);
          }
        }

        if (nextPhotos.length === 0 && websiteOriginUrl(website)) {
          try {
            const venue = await fetchBusinessVenueImages({
              websiteUrl: websiteOriginUrl(website),
              reservationUrl: null,
              businessId: business.id,
            });
            if (venue.imageUrls?.length) nextPhotos = venue.imageUrls;
          } catch {
            /* keep empty */
          }
        }

        if (nextPhotos.length > 0) {
          saveCachedVenuePhotos(business.id, nextPhotos);
          setCoverById((prev) => ({ ...prev, [business.id]: nextPhotos[0]! }));
        }

        setVenueProfile((prev) => {
          if (!prev || prev.businessId !== business.id) return prev;
          const next = mergeVenueSnapshotKeepExisting(prev, {
            businessName,
            address,
            city,
            state,
            zip,
            about,
            coverUrl: nextPhotos.length > 0 ? nextPhotos[0]! : prev.coverUrl,
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
        if (needsContact) markContactLookupTried(business.id);
      } finally {
        setPhotosLoading(false);
      }
    })();
  }

  function closeVenueProfile() {
    setVenueProfile(null);
    setProfileSource(null);
    setPhotosLoading(false);
    setVenueReservationUrl(null);
  }

  function openInvitePicker(business: BusinessDirectoryItem) {
    setInviteBusiness(business);
    setInviteOpen(true);
    setInviteMessage(null);
    setInviteError(null);
    setCampaigns([]);
    setCampaignsError(null);
    setCampaignsLoading(true);
    const nonprofitId = state.nonprofitProfile?.id;
    void fetchManageCampaigns(nonprofitId)
      .then((list) => setCampaigns(list))
      .catch((err) => {
        setCampaignsError(err instanceof Error ? err.message : "Could not load campaigns");
      })
      .finally(() => setCampaignsLoading(false));
  }

  function beginInvite(business: BusinessDirectoryItem) {
    if (!business.inviteable) return;
    if (!isLoggedIn) {
      // Keep search/create screen first; Sign in (header) returns here with campaign picker.
      stashDirectoryInviteIntent(business);
      prepareDirectoryInviteAuth();
      onStartCampaign();
      return;
    }
    openInvitePicker(business);
  }

  // After sign-in from Business → Invite, reopen campaign picker (not dashboard).
  useEffect(() => {
    if (!mounted || !isLoggedIn || inviteResumeDone.current) return;
    const intent = consumeDirectoryInviteIntent();
    if (!intent) return;
    inviteResumeDone.current = true;
    openInvitePicker(businessFromDirectoryInviteIntent(intent));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot resume after auth
  }, [mounted, isLoggedIn]);

  async function inviteToCampaign(campaign: ManageCampaignSummary) {
    if (!inviteBusiness) return;
    const locationId = inviteBusiness.locations[0]?.id;
    if (!locationId) {
      setInviteError("This business has no location to invite.");
      return;
    }

    setInvitingSlug(campaign.slug);
    setInviteError(null);
    setInviteMessage(null);
    try {
      const builder = await fetchBuilderCampaign(campaign.slug);
      const methodType = pickInviteMethod(builder.methods, inviteBusiness.capabilities);
      if (!methodType) {
        setInviteError(
          "This campaign has no business giveback methods. Add Dine & Donate or similar first.",
        );
        return;
      }

      const result = await appendCampaignBusinessInvitations(campaign.slug, {
        invitations: [
          {
            businessId: inviteBusiness.id,
            locationId,
            methodType,
          },
        ],
      });
      setInviteMessage(
        result.message ||
          `Invited ${inviteBusiness.businessName} to “${campaign.name}”.`,
      );
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setInvitingSlug(null);
    }
  }

  const awaiting = profileSource?.awaitingVerification ?? false;
  const profileInviteable = profileSource?.inviteable ?? false;

  const body = (
    <>
      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      )}

      {!loading && rows.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No claimed businesses match your location.{" "}
          {!nearby.allLocations && <>Try widening the search, or </>}
          check back soon.
        </p>
      )}

      {!loading && rows.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map((b) => (
            <HomepageBusinessCard
              key={b.id}
              business={b}
              coverUrl={coverById[b.id] ?? null}
              onViewProfile={openProfile}
              onInvite={beginInvite}
            />
          ))}
        </div>
      )}

      {venueProfile && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-venue-canvas">
          {awaiting && (
            <div className="sticky top-0 z-20 flex items-center justify-center gap-1.5 border-b border-amber-200/80 bg-amber-100 px-4 py-2.5 text-xs font-semibold text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              <Clock className="size-3.5" />
              Awaiting verification
            </div>
          )}
          <BusinessVenueProfile
            profile={venueProfile}
            editing={false}
            readOnly
            photosLoading={photosLoading}
            reservationUrl={venueReservationUrl}
            onToggleEdit={() => {}}
            onChange={() => {}}
            onBack={closeVenueProfile}
            backLabel="Back to Business"
            onContinue={
              profileInviteable && profileSource
                ? () => {
                    closeVenueProfile();
                    beginInvite(profileSource);
                  }
                : undefined
            }
            continueLabel="Invite to campaign"
          />
        </div>
      )}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite to which campaign?</DialogTitle>
            <DialogDescription>
              {inviteBusiness
                ? `Choose a campaign to invite ${inviteBusiness.businessName}.`
                : "Choose a campaign."}
            </DialogDescription>
          </DialogHeader>

          {campaignsLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          )}

          {campaignsError && (
            <p className="text-sm text-destructive">{campaignsError}</p>
          )}

          {!campaignsLoading && !campaignsError && campaigns.length === 0 && (
            <div className="space-y-3 py-2 text-sm text-muted-foreground">
              <p>You don&apos;t have a campaign yet.</p>
              <button
                type="button"
                onClick={() => {
                  setInviteOpen(false);
                  onStartCampaign();
                }}
                className="inline-flex w-full items-center justify-center rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-dark"
              >
                Start a Campaign
              </button>
            </div>
          )}

          {!campaignsLoading && campaigns.length > 0 && (
            <ul className="max-h-64 space-y-2 overflow-y-auto">
              {campaigns.map((c) => (
                <li key={c.slug}>
                  <button
                    type="button"
                    disabled={invitingSlug !== null}
                    onClick={() => void inviteToCampaign(c)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-border px-3 py-3 text-left transition-colors hover:bg-accent disabled:opacity-60"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-foreground">{c.name}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {c.status}
                        {c.nonprofit ? ` · ${c.nonprofit}` : ""}
                      </span>
                    </span>
                    {invitingSlug === c.slug ? (
                      <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
                    ) : (
                      <Send className="size-4 shrink-0 text-muted-foreground" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {inviteMessage && (
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
              {inviteMessage}
            </p>
          )}
          {inviteError && <p className="text-sm text-destructive">{inviteError}</p>}

          <DialogFooter>
            <button
              type="button"
              onClick={() => setInviteOpen(false)}
              className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-accent"
            >
              {inviteMessage ? "Done" : "Cancel"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  if (embedded) {
    return <div id="forkup-businesses">{body}</div>;
  }

  return (
    <section id="forkup-businesses" className="mt-14 scroll-mt-24 md:mt-16">
      <div className="mb-8">
        <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Businesses on ForkUp
        </h2>
        <p className="mt-1 text-muted-foreground">
          Invite a local partner to your campaign — or browse profiles. Pending claims stay visible
          but can&apos;t be invited yet.
        </p>
      </div>
      {body}
    </section>
  );
}
