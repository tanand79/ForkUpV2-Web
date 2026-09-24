"use client";

/**
 * Public live campaign — "Choose where to participate" carousel.
 * Layout matches Ui LocationsSection; data from ParticipatingLocation + submitParticipation.
 */

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Heart,
  Loader2,
  MapPin,
  Receipt,
  Scissors,
  ShoppingBag,
  Sparkles,
  Users,
  Utensils,
} from "lucide-react";
import { bookingCtaLabel } from "@/lib/booking-platform";
import { assetSrc } from "@/lib/utils";
import { submitParticipation } from "@/lib/api";
import {
  fetchBusinessVenueImages,
  findBusinessProfile,
} from "@/lib/api-business-onboarding";
import { websiteOriginUrl } from "@/lib/business-join-query";
import {
  isOpenVenueDay,
  loadCachedVenuePhotos,
  loadContactLookupTried,
  loadVenueProfileSnapshot,
  markContactLookupTried,
  mergeVenueSnapshotKeepExisting,
  normalizeVenueHours,
  saveCachedVenuePhotos,
  VENUE_DAYS,
  type VenueProfileSnapshot,
} from "@/lib/business-venue-profile";
import { loadBusinessJoinDraft } from "@/lib/business-join-four-step-draft";
import { buildReceiptUploadHref } from "@/lib/receipt-upload-href";
import type { ParticipatingLocation } from "@/lib/campaign-types";
import { ScrollReveal } from "@/components/ScrollReveal";
import { BusinessVenueProfile } from "@/components/campaign/business-ai/BusinessVenueProfile";
import forkupLogo from "@/assets/forkup-logo-header.png";
import bizFallback from "@/assets/biz-restaurant.jpg";
import coffeeImg from "@/assets/campaign-coffee.jpg";
import marketImg from "@/assets/campaign-market.jpg";

type BusinessType = "dine" | "shop" | "service" | "event" | "other";

const TYPE_CONFIG: Record<
  BusinessType,
  { label: string; icon: typeof Utensils; emoji: string; ctaCollapsed: string; image: string }
> = {
  dine: {
    label: "Dine",
    icon: Utensils,
    emoji: "🍽",
    ctaCollapsed: "Reserve Your Table",
    image: assetSrc(bizFallback),
  },
  shop: {
    label: "Shop",
    icon: ShoppingBag,
    emoji: "🛍",
    ctaCollapsed: "Visit Store",
    image: assetSrc(marketImg),
  },
  service: {
    label: "Service",
    icon: Scissors,
    emoji: "💇",
    ctaCollapsed: "Book Appointment",
    image: assetSrc(coffeeImg),
  },
  event: {
    label: "Event",
    icon: Users,
    emoji: "🎉",
    ctaCollapsed: "Attend Event",
    image: assetSrc(bizFallback),
  },
  other: {
    label: "Participate",
    icon: MapPin,
    emoji: "📍",
    ctaCollapsed: "Participate",
    image: assetSrc(bizFallback),
  },
};

const PARTY_SIZES = [1, 2, 3, 4, "5+"] as const;

const STORAGE_KEY = "forkup_participant";

/** True when at least one weekday has giveback hours set. */
function hasEligibleHours(hours: VenueProfileSnapshot["hours"]): boolean {
  return VENUE_DAYS.some((day) => isOpenVenueDay(hours[day]));
}

/** Reuse join-funnel gallery photos when this browser still has the draft. */
function photosFromJoinDraft(businessName: string): string[] {
  const draft = loadBusinessJoinDraft();
  const found = draft?.found;
  if (!found) return [];
  const draftName = found.businessName?.trim().toLowerCase() || "";
  const want = businessName.trim().toLowerCase();
  if (draftName && want && draftName !== want) return [];
  return Array.isArray(found.imageUrls)
    ? found.imageUrls.filter((u): u is string => typeof u === "string" && u.trim().length > 0)
    : [];
}

function aboutFromJoinDraft(businessName: string): string {
  const draft = loadBusinessJoinDraft();
  const found = draft?.found;
  if (!found) return "";
  const draftName = found.businessName?.trim().toLowerCase() || "";
  const want = businessName.trim().toLowerCase();
  if (draftName && want && draftName !== want) return "";
  return found.about?.trim() || "";
}

function hoursFromJoinDraft(businessName: string) {
  const draft = loadBusinessJoinDraft();
  if (!draft) return null;
  const found = draft.found;
  if (found) {
    const draftName = found.businessName?.trim().toLowerCase() || "";
    const want = businessName.trim().toLowerCase();
    if (draftName && want && draftName !== want) return null;
  }
  const hours = normalizeVenueHours(draft.discountHours);
  return hasEligibleHours(hours) ? hours : normalizeVenueHours(found?.discountHours ?? null);
}

interface Participant {
  firstName: string;
  email: string;
  partySize: number | string;
  returning: boolean;
}

interface ConfirmedParticipation extends Participant {
  reservationUrl: string | null;
}

const CAPTURE_COPY = {
  header: "Let us know you're supporting this campaign",
  subtext:
    "This helps ForkUp track participation and show participating businesses the community support they helped create.",
  takes: "It only takes a few seconds.",
  cta: "Continue to Reservation",
  helper:
    "You'll be redirected to complete your reservation or booking directly with the business.",
};

const inputClassName =
  "w-full h-12 px-4 rounded-xl bg-secondary/60 border border-border focus:bg-card focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-base placeholder:text-muted-foreground transition-all";

function locKey(loc: ParticipatingLocation): string {
  return `${loc.businessId}-${loc.locationId}-${loc.methodId}`;
}

/** Open the booking page in this click, before any await, so the browser allows the tab. */
function openReservationTab(url: string | null | undefined): Window | null {
  const target = url?.trim();
  if (!target || typeof window === "undefined") return null;
  return window.open(target, "_blank");
}

function releaseReservationTab(tab: Window | null) {
  if (!tab) return;
  try {
    tab.opener = null;
  } catch {
    /* ignore */
  }
}

function businessTypeFromLoc(loc: ParticipatingLocation): BusinessType {
  if (loc.cta === "reserve" || loc.cta === "visit") return "dine";
  if (loc.cta === "shop") return "shop";
  if (loc.cta === "book") return "service";
  if (loc.cta === "attend") return "event";
  const t = (loc.businessType || "").toLowerCase();
  if (t.includes("restaurant") || t.includes("dine") || t.includes("food") || t.includes("cafe")) {
    return "dine";
  }
  if (t.includes("shop") || t.includes("retail") || t.includes("boutique")) return "shop";
  if (t.includes("salon") || t.includes("spa") || t.includes("service")) return "service";
  return "other";
}

function actionLine(type: BusinessType): string {
  if (type === "dine") return "Dine In or Takeout";
  if (type === "shop") return "Shop In Store";
  if (type === "service") return "Book an Appointment";
  if (type === "event") return "Attend Event";
  return "Participate";
}

function givebackScope(type: BusinessType): string {
  if (type === "dine") return "dine-in and takeout";
  if (type === "shop") return "all purchases";
  if (type === "service") return "booked services";
  return "your visit";
}

function CaptureForm({
  businessName,
  fieldIdPrefix,
  reservationUrl,
  onComplete,
}: {
  businessName: string;
  fieldIdPrefix: string;
  reservationUrl: string | null;
  onComplete: (p: Participant) => Promise<void>;
}) {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [partySize, setPartySize] = useState<number | string | null>(null);
  const [returning, setReturning] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const trimmedName = firstName.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) return setError("Please enter your first name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return setError("Please enter a valid email address.");
    }
    if (trimmedName.length > 50 || trimmedEmail.length > 100) return setError("Input too long.");
    if (partySize === null) return setError("Please select your party size.");
    if (returning === null) return setError("Please let us know if this is your first visit.");

    setError(null);
    setSubmitting(true);
    const bookingTab = openReservationTab(reservationUrl);
    try {
      const participant: Participant = {
        firstName: trimmedName,
        email: trimmedEmail,
        partySize,
        returning,
      };
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(participant));
      } catch {
        /* ignore */
      }
      await onComplete(participant);
      releaseReservationTab(bookingTab);
    } catch (err) {
      bookingTab?.close();
      setError(err instanceof Error ? err.message : "Could not save your visit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-5" onClick={(e) => e.stopPropagation()}>
      <div className="text-center space-y-1.5">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary mb-1">
          <Heart size={18} />
        </div>
        <h4 className="font-serif text-xl text-foreground leading-tight text-balance">
          {CAPTURE_COPY.header}
        </h4>
        <p className="text-sm text-muted-foreground text-pretty">{CAPTURE_COPY.subtext}</p>
        <p className="text-xs text-muted-foreground/70">{CAPTURE_COPY.takes}</p>
      </div>

      <div className="space-y-3">
        <div>
          <label htmlFor={`${fieldIdPrefix}-first-name`} className="sr-only">
            First name
          </label>
          <input
            id={`${fieldIdPrefix}-first-name`}
            type="text"
            autoComplete="given-name"
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            maxLength={50}
            className={inputClassName}
          />
        </div>
        <div>
          <label htmlFor={`${fieldIdPrefix}-email`} className="sr-only">
            Email address
          </label>
          <input
            id={`${fieldIdPrefix}-email`}
            type="email"
            autoComplete="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={100}
            className={inputClassName}
          />
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-foreground mb-3">Party size</p>
        <div className="flex gap-2">
          {PARTY_SIZES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setPartySize(s)}
              className={`w-11 h-11 rounded-xl text-sm font-medium transition-all duration-200 active:scale-95 ${
                partySize === s
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary text-secondary-foreground hover:bg-warm-sand"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-foreground mb-3">
          Is this your first visit to {businessName}?
        </p>
        <div className="flex gap-2">
          {[
            { label: "First Time", value: false },
            { label: "Returning Guest", value: true },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => setReturning(opt.value)}
              className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 active:scale-95 ${
                returning === opt.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary text-secondary-foreground hover:bg-warm-sand"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-destructive text-center">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full btn-primary text-base py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {submitting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Saving…
          </>
        ) : (
          CAPTURE_COPY.cta
        )}
      </button>

      <p className="text-[11px] text-muted-foreground/70 text-center">{CAPTURE_COPY.helper}</p>
    </form>
  );
}

function ReusePrompt({
  participant,
  nonprofitName,
  onContinue,
  onUseDifferent,
  continuing,
}: {
  participant: Participant;
  nonprofitName: string;
  onContinue: () => void;
  onUseDifferent: () => void;
  continuing: boolean;
}) {
  return (
    <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
      <div className="text-center space-y-1.5">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary mb-1">
          <Heart size={18} />
        </div>
        <h4 className="font-serif text-xl text-foreground leading-tight text-balance">
          Continue supporting {nonprofitName}
        </h4>
        <p className="text-sm text-muted-foreground text-pretty">
          You already entered your details for another participating business. Reuse them for this
          visit?
        </p>
      </div>
      <div className="space-y-2.5">
        <button
          type="button"
          onClick={onContinue}
          disabled={continuing}
          className="w-full btn-primary text-base py-4 rounded-2xl text-left px-5 disabled:opacity-60"
        >
          <span className="block font-semibold">
            {continuing ? "Saving…" : `Continue as ${participant.firstName}`}
          </span>
          <span className="block text-xs font-normal opacity-80 truncate">{participant.email}</span>
        </button>
        <button
          type="button"
          onClick={onUseDifferent}
          disabled={continuing}
          className="w-full bg-secondary hover:bg-warm-sand text-foreground text-sm font-medium py-3 rounded-xl transition-colors"
        >
          Use different details
        </button>
      </div>
    </div>
  );
}

function LocationCard({
  loc,
  isExpanded,
  participation,
  defaultParticipant,
  liveSupporterCount,
  isMostPopular,
  nonprofitName,
  campaignSlug,
  previewOnly,
  onToggle,
  onConfirmParticipation,
  onOpenProfile,
  profileLoading,
}: {
  loc: ParticipatingLocation;
  isExpanded: boolean;
  participation: ConfirmedParticipation | null;
  defaultParticipant: Participant | null;
  liveSupporterCount: number;
  isMostPopular: boolean;
  nonprofitName: string;
  campaignSlug: string;
  previewOnly: boolean;
  onToggle: () => void;
  onConfirmParticipation: (key: string, p: Participant) => Promise<ConfirmedParticipation>;
  onOpenProfile: () => void;
  profileLoading: boolean;
}) {
  const type = businessTypeFromLoc(loc);
  const config = TYPE_CONFIG[type];
  const key = locKey(loc);
  const [forceFreshForm, setForceFreshForm] = useState(false);
  const [reuseSubmitting, setReuseSubmitting] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);

  const cityLine = [loc.city, loc.state].filter(Boolean).join(", ");

  const handleCapture = async (p: Participant) => {
    setForceFreshForm(false);
    setCardError(null);
    await onConfirmParticipation(key, p);
  };

  const handleContinueAs = async () => {
    if (!defaultParticipant) return;
    setReuseSubmitting(true);
    setCardError(null);
    const bookingTab = openReservationTab(loc.reservationUrl);
    try {
      await onConfirmParticipation(key, defaultParticipant);
      releaseReservationTab(bookingTab);
    } catch (err) {
      bookingTab?.close();
      setCardError(err instanceof Error ? err.message : "Could not save your visit");
    } finally {
      setReuseSubmitting(false);
    }
  };

  const showConfirmed = !!participation;
  const showReusePrompt = !showConfirmed && !!defaultParticipant && !forceFreshForm && !previewOnly;
  const showCaptureForm = !showConfirmed && !previewOnly && (!defaultParticipant || forceFreshForm);

  return (
    <div
      className={`card-warm overflow-hidden transition-all duration-300 ${
        isExpanded ? "ring-2 ring-primary/30 shadow-lg shadow-primary/[0.08]" : ""
      }`}
    >
      <div className="cursor-pointer" onClick={onToggle}>
        <div className="relative">
          <button
            type="button"
            className="relative block w-full text-left"
            aria-label={`View ${loc.businessName} profile`}
            disabled={profileLoading}
            onClick={(e) => {
              e.stopPropagation();
              onOpenProfile();
            }}
          >
            <img
              src={config.image}
              alt={loc.businessName}
              className={`w-full object-cover transition-all duration-500 ${
                isExpanded ? "h-56 sm:h-64" : "h-44 sm:h-48"
              }`}
            />
            {profileLoading ? (
              <span className="absolute inset-0 flex items-center justify-center bg-black/35">
                <Loader2 className="size-8 animate-spin text-white" aria-hidden />
                <span className="sr-only">Loading venue profile</span>
              </span>
            ) : null}
          </button>
          <div className="pointer-events-none absolute top-3 right-3 flex items-center gap-1.5">
            {isMostPopular && (
              <span className="bg-primary text-primary-foreground text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1">
                <Sparkles size={11} /> Most popular
              </span>
            )}
            <span className="bg-card/90 backdrop-blur-sm text-foreground text-xs font-semibold px-3 py-1.5 rounded-full shadow-sm">
              {config.emoji} {config.label}
            </span>
          </div>
          <img
            src={assetSrc(forkupLogo)}
            alt="ForkUp"
            className="pointer-events-none absolute bottom-3 left-3 h-7 opacity-70"
          />
        </div>

        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between mb-1">
            <h3 className="font-serif text-xl sm:text-2xl text-foreground leading-tight">
              {loc.businessName}
            </h3>
            <ChevronDown
              size={20}
              className={`text-muted-foreground mt-1 flex-shrink-0 transition-transform duration-300 ${
                isExpanded ? "rotate-180" : ""
              }`}
            />
          </div>

          {cityLine ? (
            <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1.5">
              <MapPin size={13} className="flex-shrink-0" /> {cityLine}
            </p>
          ) : null}

          <p className="text-sm text-foreground mb-3 flex items-center gap-1.5 tabular-nums">
            <Users size={13} className="flex-shrink-0 text-primary" />
            <span className="font-semibold">{liveSupporterCount}</span>
            <span className="text-muted-foreground">Supporters Going</span>
          </p>

          <p className="text-sm font-semibold text-foreground mb-1.5">{actionLine(type)}</p>

          <p className="text-xs text-muted-foreground">
            {loc.givebackPercentage}% of {givebackScope(type)} will be donated
          </p>

          {!isExpanded && !previewOnly && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              className="mt-4 w-full btn-primary py-3.5 text-sm rounded-xl"
            >
              {config.ctaCollapsed}
            </button>
          )}

          {!isExpanded && previewOnly && (
            <p className="mt-4 text-sm font-medium text-muted-foreground">
              Participation opens when the campaign goes live.
            </p>
          )}
        </div>
      </div>

      <div
        className={`overflow-hidden transition-all duration-500 ease-out ${
          isExpanded ? "max-h-[900px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-5 sm:px-6 pb-6 space-y-5">
          <div className="h-px bg-border" />

          {previewOnly && (
            <p className="text-sm font-medium text-muted-foreground">
              Participation opens when the campaign goes live.
            </p>
          )}

          {showCaptureForm && (
            <CaptureForm
              businessName={loc.businessName}
              fieldIdPrefix={key}
              reservationUrl={loc.reservationUrl}
              onComplete={handleCapture}
            />
          )}

          {showReusePrompt && defaultParticipant && (
            <ReusePrompt
              participant={defaultParticipant}
              nonprofitName={nonprofitName}
              onContinue={() => void handleContinueAs()}
              onUseDifferent={() => setForceFreshForm(true)}
              continuing={reuseSubmitting}
            />
          )}

          {cardError && <p className="text-xs text-destructive text-center">{cardError}</p>}

          {showConfirmed && participation && (
            <>
              <p className="text-sm text-foreground">
                Welcome, <span className="font-semibold">{participation.firstName}</span>
              </p>

              {cityLine ? (
                <p className="text-sm text-muted-foreground flex items-start gap-2">
                  <MapPin size={14} className="mt-0.5 flex-shrink-0 text-primary" />
                  {loc.locationName}
                  {cityLine ? ` · ${cityLine}` : ""}
                </p>
              ) : null}

              <div className="bg-secondary/60 rounded-xl p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  How your visit gives back
                </p>
                <p className="text-sm text-foreground">
                  {loc.givebackPercentage}% of your{" "}
                  {type === "dine"
                    ? "dine-in or takeout order"
                    : type === "shop"
                      ? "purchase"
                      : type === "service"
                        ? "appointment"
                        : "visit"}{" "}
                  at {loc.businessName} will be donated to support {nonprofitName}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 font-medium text-secondary-foreground">
                  <Users size={12} /> Party of {participation.partySize}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 font-medium text-secondary-foreground">
                  {participation.returning ? "Returning guest" : "First visit"}
                </span>
              </div>

              {(participation.reservationUrl || loc.reservationUrl) ? (
                <a
                  href={participation.reservationUrl || loc.reservationUrl || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full btn-primary text-base py-4 rounded-2xl flex items-center justify-center gap-3 no-underline"
                >
                  <span className="font-semibold">
                    {bookingCtaLabel(participation.reservationUrl || loc.reservationUrl || "")}
                  </span>
                  <ExternalLink size={16} />
                </a>
              ) : (
                <p className="text-sm text-muted-foreground text-center">
                  Mention the campaign when you visit, and save your receipt for giveback tracking.
                </p>
              )}

              <a
                href={buildReceiptUploadHref({
                  campaignSlug,
                  businessId: loc.businessId,
                  locationId: loc.locationId,
                  methodId: loc.methodId,
                  firstName: participation.firstName,
                  email: participation.email,
                })}
                className="inline-flex w-full items-center justify-center gap-1.5 text-sm font-semibold text-primary hover:underline"
              >
                <Receipt className="size-4" />
                Already have your receipt? Upload it
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function PublicCampaignLocationsSection({
  id = "locations",
  locations,
  nonprofitName,
  campaignSlug,
  supportersGoing,
  previewOnly = false,
}: {
  id?: string;
  locations: ParticipatingLocation[];
  nonprofitName: string;
  campaignSlug: string;
  supportersGoing: number;
  previewOnly?: boolean;
}) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [participations, setParticipations] = useState<Record<string, ConfirmedParticipation>>({});
  const [lastParticipant, setLastParticipant] = useState<Participant | null>(null);
  const [venueProfile, setVenueProfile] = useState<VenueProfileSnapshot | null>(null);
  const [venueLoc, setVenueLoc] = useState<ParticipatingLocation | null>(null);
  const [venueReservationUrl, setVenueReservationUrl] = useState<string | null>(null);
  const [profileLoadingKey, setProfileLoadingKey] = useState<string | null>(null);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    loop: false,
    skipSnaps: false,
    containScroll: "trimSnaps",
  });

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) setLastParticipant(JSON.parse(raw) as Participant);
    } catch {
      /* ignore */
    }
  }, []);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  const toggle = (key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key));
  };

  const openVenueProfile = (loc: ParticipatingLocation) => {
    const key = locKey(loc);
    const type = businessTypeFromLoc(loc);
    const isRestaurant = type === "dine";

    const saved = loadVenueProfileSnapshot(loc.businessId);
    const cachedPhotos = loadCachedVenuePhotos(loc.businessId) ?? [];
    const draftPhotos = photosFromJoinDraft(loc.businessName);
    const draftAbout = aboutFromJoinDraft(loc.businessName);
    const draftHours = hoursFromJoinDraft(loc.businessName);
    const logo = loc.logoUrl?.trim() || null;
    const dbGallery = Array.isArray(loc.galleryImageUrls)
      ? loc.galleryImageUrls.filter((u) => typeof u === "string" && u.trim())
      : [];

    const photoUrls =
      (saved?.photoUrls && saved.photoUrls.length > 0
        ? saved.photoUrls
        : null) ??
      (cachedPhotos.length > 0 ? cachedPhotos : null) ??
      (dbGallery.length > 0 ? dbGallery : null) ??
      (draftPhotos.length > 0 ? draftPhotos : null) ??
      (logo ? [logo] : []);

    const savedHours = normalizeVenueHours(saved?.hours ?? null);
    const hours =
      hasEligibleHours(savedHours)
        ? savedHours
        : draftHours && hasEligibleHours(draftHours)
          ? draftHours
          : savedHours;

    const draft = loadBusinessJoinDraft();
    const draftMatches =
      draft?.found &&
      draft.found.businessName.trim().toLowerCase() ===
        loc.businessName.trim().toLowerCase();
    const draftFound = draftMatches ? draft.found : null;

    const base: VenueProfileSnapshot = {
      businessId: loc.businessId,
      businessName: saved?.businessName || loc.businessName,
      address: saved?.address || loc.address?.trim() || "",
      city: saved?.city || loc.city || "",
      state: saved?.state || loc.state || "",
      zip: saved?.zip || loc.zip?.trim() || "",
      about: saved?.about || loc.description?.trim() || draftAbout || "",
      coverUrl: saved?.coverUrl || photoUrls[0] || logo,
      photoUrls,
      hours,
      eligibleWindow:
        saved?.eligibleWindow?.trim() ||
        draft?.eligibleWindow?.trim() ||
        "",
      givebackPercent: loc.givebackPercentage,
      causeName: nonprofitName,
      isRestaurant:
        saved?.isRestaurant !== undefined ? saved.isRestaurant : isRestaurant,
      websiteUrl:
        saved?.websiteUrl?.trim() ||
        draftFound?.website?.trim() ||
        loc.website?.trim() ||
        null,
      facebookUrl:
        saved?.facebookUrl?.trim() ||
        draftFound?.facebookUrl?.trim() ||
        loc.facebookUrl?.trim() ||
        null,
      instagramUrl:
        saved?.instagramUrl?.trim() ||
        draftFound?.instagramUrl?.trim() ||
        loc.instagramUrl?.trim() ||
        null,
      linkedinUrl:
        saved?.linkedinUrl?.trim() ||
        draftFound?.linkedinUrl?.trim() ||
        loc.linkedinUrl?.trim() ||
        null,
      youtubeUrl: saved?.youtubeUrl?.trim() || draftFound?.youtubeUrl?.trim() || null,
      tiktokUrl:
        saved?.tiktokUrl?.trim() ||
        draftFound?.tiktokUrl?.trim() ||
        loc.tiktokUrl?.trim() ||
        null,
      phone:
        saved?.phone?.trim() ||
        draftFound?.phone?.trim() ||
        loc.contactPhone?.trim() ||
        null,
      email:
        saved?.email?.trim() ||
        draftFound?.contactEmail?.trim() ||
        loc.contactEmail?.trim() ||
        null,
    };

    setVenueProfile(base);
    setVenueLoc(loc);
    const draftReservation = draftFound?.reservationUrl?.trim() || null;
    const initialBookUrl =
      loc.reservationUrl?.trim() || draftReservation || null;
    setVenueReservationUrl(initialBookUrl);

    const hasRealGallery =
      photoUrls.length > 0 && !(photoUrls.length === 1 && photoUrls[0] === logo);
    const needsAbout = !base.about.trim();
    const needsHours = !hasEligibleHours(base.hours);
    const needsBookUrl = !initialBookUrl;
    /** Scrape social when both FB and IG missing. */
    const needsSocial =
      !base.facebookUrl?.trim() && !base.instagramUrl?.trim();
    /** Contact once per session — sites without email must not wipe profile on every open. */
    const needsContact =
      (!base.phone?.trim() || !base.email?.trim()) &&
      !loadContactLookupTried(loc.businessId);
    const needsHydrate =
      !hasRealGallery ||
      needsAbout ||
      needsHours ||
      needsBookUrl ||
      needsSocial ||
      needsContact;

    if (hasRealGallery) {
      saveCachedVenuePhotos(loc.businessId, photoUrls);
      setPhotosLoading(false);
    }
    if (!needsHydrate) return;

    // Avoid stacking scrapes for the same card.
    if (profileLoadingKey === key) return;
    setProfileLoadingKey(key);
    if (!hasRealGallery) setPhotosLoading(true);
    void (async () => {
      try {
        let website = loc.website?.trim() || base.websiteUrl?.trim() || "";
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

        // Always find when about/hours/social/contact missing — even if website is already known.
        // Gallery uses a separate fast path below (never blocked behind find).
        const originEarly = websiteOriginUrl(website);
        if (!hasRealGallery && originEarly) {
          try {
            const venue = await fetchBusinessVenueImages({
              websiteUrl: originEarly,
              reservationUrl: loc.reservationUrl || null,
              businessId: loc.businessId,
            });
            if (venue.imageUrls?.length) {
              nextPhotos = venue.imageUrls;
              saveCachedVenuePhotos(loc.businessId, nextPhotos);
              setVenueProfile((prev) => {
                if (!prev || prev.businessId !== loc.businessId) return prev;
                return mergeVenueSnapshotKeepExisting(prev, {
                  coverUrl: nextPhotos[0]!,
                  photoUrls: nextPhotos,
                });
              });
              setPhotosLoading(false);
            }
            const scrapedBook = venue.reservationUrl?.trim();
            if (scrapedBook) {
              setVenueReservationUrl((prev) => prev || scrapedBook);
            }
          } catch {
            /* keep going — find may still supply photos */
          }
        }

        if (
          !website ||
          needsAbout ||
          needsHours ||
          needsBookUrl ||
          needsSocial ||
          needsContact ||
          nextPhotos.length === 0
        ) {
          try {
            const found = await findBusinessProfile({
              businessName: loc.businessName,
              joinDoorType: isRestaurant ? "restaurant" : "local",
              ...(website ? { website } : {}),
              businessId: loc.businessId,
            });
            website = website || found.website?.trim() || "";
            about = about || found.about || "";
            address = address || found.address || "";
            city = city || found.city || "";
            state = state || found.state || "";
            zip = zip || found.zip || "";
            businessName = businessName || found.businessName?.trim() || businessName;
            facebookUrl = facebookUrl || found.facebookUrl?.trim() || null;
            instagramUrl = instagramUrl || found.instagramUrl?.trim() || null;
            linkedinUrl = linkedinUrl || found.linkedinUrl?.trim() || null;
            youtubeUrl = youtubeUrl || found.youtubeUrl?.trim() || null;
            tiktokUrl = tiktokUrl || found.tiktokUrl?.trim() || null;
            phone = phone || found.phone?.trim() || null;
            email = email || found.contactEmail?.trim() || null;
            if (needsContact) markContactLookupTried(loc.businessId);
            if (!hasRealGallery && Array.isArray(found.imageUrls) && found.imageUrls.length > 0) {
              nextPhotos = found.imageUrls.filter(Boolean);
            }
            const foundHours = normalizeVenueHours(found.discountHours);
            if (needsHours && hasEligibleHours(foundHours)) {
              nextHours = foundHours;
            }
            eligibleWindow =
              eligibleWindow || found.eligibleWindow?.trim() || "";
            const foundBook = found.reservationUrl?.trim();
            if (foundBook) {
              setVenueReservationUrl((prev) => prev || foundBook);
            }
          } catch {
            /* keep system fields */
          }
        }

        const origin = websiteOriginUrl(website);
        if (origin && nextPhotos.length === 0) {
          try {
            const venue = await fetchBusinessVenueImages({
              websiteUrl: origin,
              reservationUrl: loc.reservationUrl || null,
              businessId: loc.businessId,
            });
            if (venue.imageUrls?.length) {
              nextPhotos = venue.imageUrls;
            }
            const scrapedBook = venue.reservationUrl?.trim();
            if (scrapedBook) {
              setVenueReservationUrl((prev) => prev || scrapedBook);
            }
          } catch {
            /* keep find / draft photos */
          }
        }

        if (nextPhotos.length > 0) {
          saveCachedVenuePhotos(loc.businessId, nextPhotos);
        }

        const coverUrl = nextPhotos[0] || logo;
        setVenueProfile((prev) => {
          if (!prev || prev.businessId !== loc.businessId) return prev;
          return mergeVenueSnapshotKeepExisting(prev, {
            businessName,
            address,
            city,
            state,
            zip,
            about,
            coverUrl: nextPhotos.length > 0 ? coverUrl : prev.coverUrl,
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
        });
      } catch {
        /* profile already visible — never clear fields that were already shown */
        if (needsContact) markContactLookupTried(loc.businessId);
      } finally {
        setProfileLoadingKey((prev) => (prev === key ? null : prev));
        setPhotosLoading(false);
      }
    })();
  };

  const handleConfirmParticipation = async (key: string, p: Participant) => {
    const loc = locations.find((l) => locKey(l) === key);
    if (!loc) throw new Error("Location not found");

    const guests = p.partySize === "5+" ? 5 : Number(p.partySize);
    const result = await submitParticipation(campaignSlug, {
      firstName: p.firstName,
      email: p.email,
      partySize: guests,
      isFirstVisit: !p.returning,
      businessId: loc.businessId,
      locationId: loc.locationId,
      methodId: loc.methodId,
    });

    const confirmed: ConfirmedParticipation = {
      ...p,
      reservationUrl: result.reservationUrl?.trim() || loc.reservationUrl,
    };
    setParticipations((prev) => ({ ...prev, [key]: confirmed }));
    setLastParticipant(p);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    } catch {
      /* ignore */
    }
    return confirmed;
  };

  const baseline = Math.max(0, supportersGoing);
  const liveCounts = locations.reduce<Record<string, number>>((acc, loc) => {
    const key = locKey(loc);
    acc[key] = baseline + (participations[key] ? 1 : 0);
    return acc;
  }, {});

  const mostPopularKey =
    locations.length > 0
      ? locations.reduce((top, loc) => {
          const key = locKey(loc);
          return liveCounts[key] > liveCounts[top] ? key : top;
        }, locKey(locations[0]))
      : "";

  const percentHint =
    locations.length > 0
      ? (() => {
          const percents = locations.map((l) => l.givebackPercentage);
          const min = Math.min(...percents);
          const max = Math.max(...percents);
          return min === max ? `${min}%` : `${min}%–${max}%`;
        })()
      : "10%–20%";

  if (locations.length === 0) return null;

  if (venueProfile) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-venue-canvas">
        <BusinessVenueProfile
          profile={venueProfile}
          editing={false}
          readOnly
          photosLoading={photosLoading}
          reservationUrl={venueReservationUrl}
          onBookParticipation={async (p) => {
            if (!venueLoc) throw new Error("Location not found");
            await handleConfirmParticipation(locKey(venueLoc), {
              firstName: p.firstName,
              email: p.email,
              partySize: p.partySize,
              returning: p.returning,
            });
          }}
          onToggleEdit={() => {}}
          onChange={() => {}}
          onBack={() => {
            setPhotosLoading(false);
            setVenueReservationUrl(null);
            setVenueLoc(null);
            setVenueProfile(null);
          }}
          backLabel="Back to campaign"
        />
      </div>
    );
  }

  return (
    <section id={id} className="mt-4 scroll-mt-24 pt-2 pb-4 md:mt-6 md:pb-6">
      <div className="px-0">
        <ScrollReveal>
          <p className="text-center text-sm sm:text-base text-foreground font-medium mb-1 text-pretty max-w-2xl mx-auto">
            Just show up — a portion of your purchase will be donated to this cause.
          </p>
          <p className="text-center text-sm text-muted-foreground mb-3 text-pretty">
            No extra cost — just support a local business.
          </p>
          <h2 className="font-serif text-2xl sm:text-3xl text-center text-foreground mb-2 text-balance leading-[1.15]">
            Choose where to participate
          </h2>
          <p className="text-center text-xs text-muted-foreground/70 mb-5">
            Participating businesses are donating {percentHint} of your visit to {nonprofitName}
          </p>
        </ScrollReveal>
      </div>

      <div className="relative max-w-6xl mx-auto">
        <button
          type="button"
          onClick={scrollPrev}
          className="absolute -left-1 sm:left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-card shadow-md border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:shadow-lg transition-all duration-200 active:scale-95"
          aria-label="Previous location"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          onClick={scrollNext}
          className="absolute -right-1 sm:right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-card shadow-md border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:shadow-lg transition-all duration-200 active:scale-95"
          aria-label="Next location"
        >
          <ChevronRight size={18} />
        </button>

        <div ref={emblaRef} className="overflow-hidden mx-6 sm:mx-12">
          <div className="flex gap-5">
            {locations.map((loc, i) => {
              const key = locKey(loc);
              return (
                <div
                  key={key}
                  className="flex-[0_0_85%] sm:flex-[0_0_48%] lg:flex-[0_0_32%] min-w-0"
                >
                  <ScrollReveal delay={i * 80}>
                    <LocationCard
                      loc={loc}
                      isExpanded={expandedKey === key}
                      participation={participations[key] ?? null}
                      defaultParticipant={lastParticipant}
                      liveSupporterCount={liveCounts[key]}
                      isMostPopular={key === mostPopularKey}
                      nonprofitName={nonprofitName}
                      campaignSlug={campaignSlug}
                      previewOnly={previewOnly}
                      onToggle={() => toggle(key)}
                      onConfirmParticipation={handleConfirmParticipation}
                      onOpenProfile={() => openVenueProfile(loc)}
                      profileLoading={false}
                    />
                  </ScrollReveal>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
