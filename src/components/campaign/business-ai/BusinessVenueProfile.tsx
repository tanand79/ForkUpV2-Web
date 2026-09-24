"use client";

/**
 * Venue profile — Lovable VenueProfile layout wired to ForkUp join + dashboard data.
 * Edit updates the parent VenueProfileSnapshot; Continue stays for the join funnel.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Facebook,
  Globe,
  HeartHandshake,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  Music2,
  Pencil,
  Phone,
  Upload,
  Users,
  UtensilsCrossed,
  Youtube,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { bookingCtaLabel } from "@/lib/booking-platform";
import { resolveVenueImageSrc } from "@/lib/business-join-images";
import { uploadImage } from "@/lib/api";
import {
  VENUE_DAYS,
  eligibilityRowsFromHours,
  formatVenueAddress,
  isOpenVenueDay,
  type VenueProfileSnapshot,
} from "@/lib/business-venue-profile";

const VENUE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const VENUE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const VENUE_GALLERY_MAX = 24;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

type VenueBookParticipant = {
  firstName: string;
  email: string;
  partySize: number | string;
  returning: boolean;
};

type Props = {
  profile: VenueProfileSnapshot;
  editing: boolean;
  onToggleEdit: () => void;
  onChange: (patch: Partial<VenueProfileSnapshot>) => void;
  onBack: () => void;
  backLabel?: string;
  onContinue?: () => void;
  continueLabel?: string;
  /** Public campaign / supporter view — hide Edit and business-only CTAs. */
  readOnly?: boolean;
  /** True while gallery photos are still loading in the background. */
  photosLoading?: boolean;
  /** Additive: live booking URL for campaign / supporter reserve CTA. */
  reservationUrl?: string | null;
  /**
   * Additive: same path as campaign “Continue to Reservation” —
   * open Resy + record participation after name/email.
   */
  onBookParticipation?: (participant: VenueBookParticipant) => Promise<void>;
};

type GalleryImage = { id: string; src: string; alt: string };

type VenueSocialPlatform =
  | "instagram"
  | "facebook"
  | "linkedin"
  | "youtube"
  | "tiktok"
  | "website"
  | "phone"
  | "email";

type VenueSocialLink = {
  platform: VenueSocialPlatform;
  url: string;
  label: string;
};

const SOCIAL_ICONS = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
  youtube: Youtube,
  tiktok: Music2,
  website: Globe,
  phone: Phone,
  email: Mail,
} as const;

function normalizeSocialHref(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/** Lovable VenueProfile icon row — only platforms with a URL. */
function socialLinksFromProfile(profile: VenueProfileSnapshot): VenueSocialLink[] {
  const links: VenueSocialLink[] = [];
  const website = profile.websiteUrl?.trim();
  if (website) {
    links.push({
      platform: "website",
      url: normalizeSocialHref(website),
      label: "Website",
    });
  }
  const instagram = profile.instagramUrl?.trim();
  if (instagram) {
    links.push({
      platform: "instagram",
      url: normalizeSocialHref(instagram),
      label: "Instagram",
    });
  }
  const facebook = profile.facebookUrl?.trim();
  if (facebook) {
    links.push({
      platform: "facebook",
      url: normalizeSocialHref(facebook),
      label: "Facebook",
    });
  }
  const linkedin = profile.linkedinUrl?.trim();
  if (linkedin) {
    links.push({
      platform: "linkedin",
      url: normalizeSocialHref(linkedin),
      label: "LinkedIn",
    });
  }
  const youtube = profile.youtubeUrl?.trim();
  if (youtube) {
    links.push({
      platform: "youtube",
      url: normalizeSocialHref(youtube),
      label: "YouTube",
    });
  }
  const tiktok = profile.tiktokUrl?.trim();
  if (tiktok) {
    links.push({
      platform: "tiktok",
      url: normalizeSocialHref(tiktok),
      label: "TikTok",
    });
  }
  const phone = profile.phone?.trim();
  if (phone) {
    const digits = phone.replace(/[^\d+]/g, "");
    links.push({
      platform: "phone",
      url: digits ? `tel:${digits}` : `tel:${phone}`,
      label: phone,
    });
  }
  const email = profile.email?.trim();
  if (email) {
    links.push({
      platform: "email",
      url: `mailto:${email}`,
      label: email,
    });
  }
  return links;
}

function VenueSocialLinks({
  links,
  className,
}: {
  links: VenueSocialLink[];
  className?: string;
}) {
  if (!links.length) return null;
  return (
    <div className={cn("flex shrink-0 flex-wrap items-center gap-2", className)}>
      {links.map((link) => {
        const Icon = SOCIAL_ICONS[link.platform];
        return (
          <a
            key={link.platform}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={link.label}
            title={link.label}
            className="grid size-8 place-items-center rounded-full border border-venue-line bg-venue-paper text-venue-body transition-colors hover:border-venue-accent hover:text-venue-accent sm:size-9"
          >
            <Icon className="size-3.5 sm:size-4" strokeWidth={1.75} aria-hidden="true" />
          </a>
        );
      })}
    </div>
  );
}

/** Edit mode — website / social / phone / email for the icon row. */
function VenueSocialEditFields({
  profile,
  onChange,
  className,
}: {
  profile: VenueProfileSnapshot;
  onChange: (patch: Partial<VenueProfileSnapshot>) => void;
  className?: string;
}) {
  const fieldClass =
    "mt-1 w-full rounded-sm border border-venue-line bg-venue-paper px-2.5 py-1.5 text-sm text-venue-ink";
  return (
    <div
      className={cn(
        "grid w-full max-w-sm gap-2 sm:min-w-[16rem]",
        className,
      )}
    >
      <label className="block text-xs font-medium text-venue-ink">
        Website
        <input
          type="url"
          className={fieldClass}
          value={profile.websiteUrl ?? ""}
          placeholder="https://"
          onChange={(e) => onChange({ websiteUrl: e.target.value })}
        />
      </label>
      <label className="block text-xs font-medium text-venue-ink">
        Instagram
        <input
          type="url"
          className={fieldClass}
          value={profile.instagramUrl ?? ""}
          placeholder="https://instagram.com/…"
          onChange={(e) => onChange({ instagramUrl: e.target.value })}
        />
      </label>
      <label className="block text-xs font-medium text-venue-ink">
        Facebook
        <input
          type="url"
          className={fieldClass}
          value={profile.facebookUrl ?? ""}
          placeholder="https://facebook.com/…"
          onChange={(e) => onChange({ facebookUrl: e.target.value })}
        />
      </label>
      <label className="block text-xs font-medium text-venue-ink">
        Phone
        <input
          type="tel"
          className={fieldClass}
          value={profile.phone ?? ""}
          placeholder="(555) 555-5555"
          onChange={(e) => onChange({ phone: e.target.value })}
        />
      </label>
      <label className="block text-xs font-medium text-venue-ink">
        Email
        <input
          type="email"
          className={fieldClass}
          value={profile.email ?? ""}
          placeholder="hello@venue.com"
          onChange={(e) => onChange({ email: e.target.value })}
        />
      </label>
    </div>
  );
}

function VenueGallery({
  images,
  venueName,
  editing,
  activeSrc,
  onSelectCover,
  onUploadFiles,
  uploading = false,
  uploadError = null,
  photosLoading = false,
}: {
  images: GalleryImage[];
  venueName: string;
  editing: boolean;
  activeSrc: string | null;
  onSelectCover: (src: string) => void;
  onUploadFiles?: (files: FileList) => void;
  uploading?: boolean;
  uploadError?: string | null;
  photosLoading?: boolean;
}) {
  const initial =
    activeSrc && images.some((img) => img.src === activeSrc)
      ? images.findIndex((img) => img.src === activeSrc)
      : 0;
  const [activeIndex, setActiveIndex] = useState(Math.max(0, initial));
  const [direction, setDirection] = useState<"next" | "previous">("next");
  const touchStart = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!activeSrc) return;
    const idx = images.findIndex((img) => img.src === activeSrc);
    if (idx >= 0) setActiveIndex(idx);
  }, [activeSrc, images]);

  const showImage = useCallback(
    (index: number) => {
      if (images.length === 0) return;
      const nextIndex = (index + images.length) % images.length;
      setDirection(
        nextIndex > activeIndex || (activeIndex === images.length - 1 && nextIndex === 0)
          ? "next"
          : "previous",
      );
      setActiveIndex(nextIndex);
      onSelectCover(images[nextIndex]!.src);
    },
    [activeIndex, images, onSelectCover],
  );

  useEffect(() => {
    if (activeIndex >= images.length) setActiveIndex(0);
  }, [activeIndex, images.length]);

  const uploadControls =
    editing && onUploadFiles ? (
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          onChange={(e) => {
            const files = e.target.files;
            if (files && files.length > 0) onUploadFiles(files);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="h-9 rounded-full border-venue-line bg-venue-paper px-3 text-xs font-semibold text-venue-ink shadow-none hover:bg-venue-soft"
        >
          <Upload className="size-3.5" />
          {uploading ? "Uploading…" : "Upload photos"}
        </Button>
        <p className="text-xs text-venue-muted">
          Add your own photos beyond the ones we found. Tap a photo to set it as
          the cover.
        </p>
        {uploadError ? (
          <p className="w-full text-xs text-red-700" role="alert">
            {uploadError}
          </p>
        ) : null}
      </div>
    ) : null;

  if (images.length === 0) {
    return (
      <section aria-label={`${venueName} image gallery`} className="space-y-3">
        <div className="grid h-52 place-items-center rounded-md bg-venue-soft text-sm text-venue-muted sm:h-72 lg:h-[22rem]">
          {photosLoading
            ? "Loading venue photos…"
            : editing
              ? "No photos yet — upload venue images"
              : "Venue images coming soon"}
        </div>
        {uploadControls}
      </section>
    );
  }

  const activeImage = images[activeIndex] ?? images[0]!;
  const coverResolved = activeSrc;

  return (
    <section aria-label={`${venueName} image gallery`} className="space-y-3">
      <div
        className="group relative h-[18rem] overflow-hidden rounded-md bg-venue-ink sm:h-[25rem] lg:h-[31rem]"
        onTouchStart={(event) => {
          touchStart.current = event.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          const start = touchStart.current;
          const end = event.changedTouches[0]?.clientX;
          touchStart.current = null;
          if (start === null || end === undefined || Math.abs(start - end) < 45) return;
          showImage(activeIndex + (start > end ? 1 : -1));
        }}
      >
        <img
          key={activeImage.id}
          src={activeImage.src}
          alt={activeImage.alt}
          width={1600}
          height={1008}
          className={cn(
            // contain — show the full photo; cover was clipping signs/heads.
            "h-full w-full object-contain motion-safe:animate-venue-reveal",
            direction === "previous" && "motion-safe:[animation-direction:reverse]",
          )}
        />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-venue-ink/70 to-transparent" />

        {editing && coverResolved && activeImage.src === coverResolved ? (
          <span className="absolute left-4 top-4 rounded-full bg-venue-accent px-3 py-1 text-xs font-semibold text-venue-paper">
            Cover
          </span>
        ) : null}

        {images.length > 1 ? (
          <>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              aria-label="Previous venue image"
              title="Previous image"
              onClick={() => showImage(activeIndex - 1)}
              className="absolute left-3 top-1/2 size-10 -translate-y-1/2 rounded-full border-0 bg-venue-paper/90 text-venue-ink shadow-lg hover:bg-venue-paper sm:left-5"
            >
              <ChevronLeft className="size-5" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              aria-label="Next venue image"
              title="Next image"
              onClick={() => showImage(activeIndex + 1)}
              className="absolute right-3 top-1/2 size-10 -translate-y-1/2 rounded-full border-0 bg-venue-paper/90 text-venue-ink shadow-lg hover:bg-venue-paper sm:right-5"
            >
              <ChevronRight className="size-5" />
            </Button>
          </>
        ) : null}

        <span className="absolute bottom-4 right-4 rounded-full bg-venue-ink/70 px-3 py-1.5 text-xs font-semibold text-venue-paper backdrop-blur-sm">
          {activeIndex + 1} / {images.length}
        </span>
        <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-2" aria-label="Choose venue image">
          {images.map((image, index) => (
            <Button
              key={image.id}
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Show image ${index + 1}`}
              aria-current={index === activeIndex}
              onClick={() => showImage(index)}
              className="size-5 rounded-full p-0 hover:bg-transparent"
            >
              <span
                className={cn(
                  "size-1.5 rounded-full bg-venue-paper/60 transition-all",
                  index === activeIndex && "w-5 bg-venue-paper",
                )}
              />
            </Button>
          ))}
        </div>
      </div>

      {images.length > 1 || editing ? (
        <div
          role="tablist"
          aria-label={`${venueName} thumbnails`}
          className="-mx-5 flex snap-x gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:px-0"
        >
          {images.map((image, index) => {
            const isCover = Boolean(coverResolved && image.src === coverResolved);
            return (
              <Button
                key={image.id}
                type="button"
                variant="ghost"
                role="tab"
                aria-label={
                  isCover
                    ? `${image.alt} (cover)`
                    : editing
                      ? `Set ${image.alt} as cover`
                      : `View ${image.alt}`
                }
                aria-selected={index === activeIndex}
                onClick={() => showImage(index)}
                className={cn(
                  "relative h-auto w-14 shrink-0 snap-start overflow-hidden rounded-sm border border-transparent p-0 opacity-65 transition-all hover:opacity-100 sm:w-16",
                  index === activeIndex && "border-venue-accent opacity-100 ring-1 ring-venue-accent",
                  isCover && editing && "opacity-100",
                )}
              >
                <img
                  src={image.src}
                  alt=""
                  loading="lazy"
                  width={160}
                  height={96}
                  className="aspect-[5/3] w-full bg-venue-ink/10 object-contain"
                />
                {isCover && editing ? (
                  <span className="absolute inset-x-0 bottom-0 bg-venue-accent/95 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-venue-paper">
                    Cover
                  </span>
                ) : null}
              </Button>
            );
          })}
        </div>
      ) : null}

      {uploadControls}
    </section>
  );
}

function EligibilitySchedule({
  rows,
  editing,
  hours,
  onChangeDay,
}: {
  rows: { day: string; periods: string[] }[];
  editing: boolean;
  hours: VenueProfileSnapshot["hours"];
  onChangeDay: (day: (typeof VENUE_DAYS)[number], value: string) => void;
}) {
  return (
    <section aria-labelledby="eligibility-heading" className="border-t border-venue-line pt-8">
      <div className="mb-5 flex items-center gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-full bg-venue-soft text-venue-accent">
          <Clock3 className="size-4" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-venue-accent">
            Giveback hours
          </p>
          <h2 id="eligibility-heading" className="font-venue-serif text-2xl text-venue-ink">
            Eligible days &amp; meal periods
          </h2>
        </div>
      </div>
      <div className="divide-y divide-venue-line border-y border-venue-line">
        {rows.map((row) => {
          const day = row.day as (typeof VENUE_DAYS)[number];
          return (
            <div
              key={row.day}
              className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-4 py-3.5 text-sm"
            >
              <span className="font-semibold text-venue-ink">{row.day}</span>
              {editing ? (
                <input
                  className="w-full rounded-sm border border-venue-line bg-venue-paper px-2 py-1.5 text-sm text-venue-ink"
                  value={isOpenVenueDay(hours[day]) ? hours[day] : ""}
                  placeholder="Not eligible"
                  aria-label={`${row.day} eligible periods`}
                  onChange={(e) => onChangeDay(day, e.target.value)}
                />
              ) : (
                <span className={row.periods.length ? "text-venue-body" : "text-venue-muted"}>
                  {row.periods.length ? row.periods.join(" · ") : "Not eligible"}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ReservationPreview({
  venueName,
  offerName,
  dateLabel,
  donationPercent,
  beneficiary,
  bookUrl = null,
  liveBooking = false,
  onBookParticipation,
}: {
  venueName: string;
  offerName: string;
  dateLabel: string;
  donationPercent: number;
  beneficiary: string;
  /** When set with liveBooking, CTA opens this Resy / booking URL. */
  bookUrl?: string | null;
  liveBooking?: boolean;
  onBookParticipation?: (participant: VenueBookParticipant) => Promise<void>;
}) {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [partySize, setPartySize] = useState("2");
  const [visitType, setVisitType] = useState<"first" | "returning">("first");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const sizes = ["1", "2", "3", "4", "5+"];
  const trimmedBookUrl = bookUrl?.trim() || "";
  const canBook = liveBooking && trimmedBookUrl.length > 0;
  const ctaLabel = canBook
    ? bookingCtaLabel(trimmedBookUrl)
    : liveBooking
      ? "Continue to Reservation"
      : "Book Now";

  const submitLiveBooking = async () => {
    if (!liveBooking) return;
    const trimmedName = firstName.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) {
      setError("Please enter your first name.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!trimmedBookUrl) {
      setError("Booking link is not available for this venue yet.");
      return;
    }

    setError(null);
    setSubmitting(true);
    // Open Resy in this click (before await) so the browser allows the tab —
    // same pattern as campaign “Continue to Reservation”.
    const bookingTab =
      typeof window !== "undefined" ? window.open(trimmedBookUrl, "_blank") : null;
    try {
      if (onBookParticipation) {
        await onBookParticipation({
          firstName: trimmedName,
          email: trimmedEmail,
          partySize,
          returning: visitType === "returning",
        });
      }
      if (bookingTab) {
        try {
          bookingTab.opener = null;
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      bookingTab?.close();
      setError(err instanceof Error ? err.message : "Could not save your visit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <aside
      id="reservation"
      aria-labelledby="reservation-heading"
      className="rounded-md border border-venue-line bg-venue-paper p-5 shadow-[var(--shadow-venue)] sm:p-7 lg:sticky lg:top-8"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-venue-accent">
        Reserve with purpose
      </p>
      <h2
        id="reservation-heading"
        className="mt-2 font-venue-serif text-3xl leading-tight text-venue-ink"
      >
        Your table can give back.
      </h2>
      <p className="mt-2 text-sm leading-6 text-venue-body">
        {liveBooking
          ? `Book at ${venueName} — a portion of your visit supports ${beneficiary}.`
          : `Preview of what supporters see during a live campaign at ${venueName}.`}
      </p>

      <div className="mt-6 rounded-sm bg-venue-soft p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-venue-accent text-venue-paper">
            <HeartHandshake className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-venue-ink">{offerName}</p>
            {dateLabel ? (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-venue-body">
                <CalendarDays className="size-3.5" /> {dateLabel}
              </p>
            ) : null}
          </div>
        </div>
        {donationPercent > 0 ? (
          <p className="mt-4 border-t border-venue-line pt-4 text-sm leading-6 text-venue-body">
            <strong className="font-semibold text-venue-ink">
              {donationPercent}% of your bill
            </strong>{" "}
            will be donated to {beneficiary}.
          </p>
        ) : null}
      </div>

      {liveBooking ? (
        <div className="mt-6 space-y-4">
          <label className="block text-sm font-semibold text-venue-ink">
            First name
            <input
              type="text"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Your first name"
              className="mt-1.5 h-11 w-full rounded-sm border border-venue-line bg-venue-paper px-3 text-sm text-venue-ink placeholder:text-venue-muted"
            />
          </label>
          <label className="block text-sm font-semibold text-venue-ink">
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="mt-1.5 h-11 w-full rounded-sm border border-venue-line bg-venue-paper px-3 text-sm text-venue-ink placeholder:text-venue-muted"
            />
          </label>
        </div>
      ) : null}

      <fieldset className="mt-6">
        <legend className="flex items-center gap-2 text-sm font-semibold text-venue-ink">
          <Users className="size-4 text-venue-accent" /> Party size
        </legend>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {sizes.map((size) => (
            <Button
              key={size}
              type="button"
              variant={partySize === size ? "default" : "outline"}
              aria-pressed={partySize === size}
              onClick={() => setPartySize(size)}
              className={cn(
                "h-10 rounded-sm border-venue-line px-0 shadow-none",
                partySize === size
                  ? "bg-venue-ink text-venue-paper hover:bg-venue-ink/90"
                  : "bg-venue-paper text-venue-ink hover:bg-venue-soft",
              )}
            >
              {size}
            </Button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-6">
        <legend className="text-sm font-semibold text-venue-ink">
          Have you dined here before?
        </legend>
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-sm bg-venue-soft p-1">
          {(["first", "returning"] as const).map((option) => (
            <Button
              key={option}
              type="button"
              variant="ghost"
              aria-pressed={visitType === option}
              onClick={() => setVisitType(option)}
              className={cn(
                "h-10 rounded-sm text-xs shadow-none hover:bg-venue-paper",
                visitType === option
                  ? "bg-venue-paper text-venue-ink shadow-sm"
                  : "text-venue-body",
              )}
            >
              {visitType === option ? <Check className="size-3.5" /> : null}
              {option === "first" ? "First time" : "Been here before"}
            </Button>
          ))}
        </div>
      </fieldset>

      {error ? (
        <p className="mt-4 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <Button
        type="button"
        disabled={liveBooking ? submitting || !canBook : false}
        onClick={liveBooking ? () => void submitLiveBooking() : undefined}
        className="mt-6 h-12 w-full rounded-sm bg-venue-accent text-sm font-semibold text-venue-paper shadow-none hover:bg-venue-accent-strong disabled:opacity-60"
      >
        {submitting ? "Opening reservation…" : ctaLabel} <ArrowRight />
      </Button>

      <p className="mt-4 border-t border-venue-line pt-4 text-xs text-venue-muted">
        {liveBooking
          ? canBook
            ? "You'll be redirected to complete your reservation with the business."
            : "Booking link is not available for this venue yet."
          : "Preview only — booking goes live with a campaign."}
      </p>
    </aside>
  );
}

export function BusinessVenueProfile({
  profile,
  editing,
  onToggleEdit,
  onChange,
  onBack,
  backLabel = "Back",
  onContinue,
  continueLabel = "Continue",
  readOnly = false,
  photosLoading = false,
  reservationUrl = null,
  onBookParticipation,
}: Props) {
  const canEdit = !readOnly && editing;
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const addressLine = formatVenueAddress(profile);
  const aboutParagraphs = profile.about
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const category = profile.isRestaurant
    ? "Restaurant — give back"
    : "Local business — give back";
  const offerName = profile.isRestaurant ? "Dine & Donate" : "Shop & Give Back";
  const beneficiary = profile.causeName?.trim() || "your selected cause";
  const dateLabel = profile.eligibleWindow.trim();
  const liveBookUrl = reservationUrl?.trim() || null;

  const photoList =
    profile.photoUrls.length > 0
      ? profile.photoUrls
      : profile.coverUrl
        ? [profile.coverUrl]
        : [];
  const images: GalleryImage[] = photoList.map((src, index) => {
    const resolved = resolveVenueImageSrc(src);
    return {
      id: `${index}-${resolved.slice(-24)}`,
      src: resolved,
      alt: `${profile.businessName} photo ${index + 1}`,
    };
  });
  const resolvedCover = profile.coverUrl
    ? resolveVenueImageSrc(profile.coverUrl)
    : null;

  const handleUploadFiles = useCallback(
    async (files: FileList) => {
      if (!canEdit) return;
      setUploadError(null);
      const remaining = VENUE_GALLERY_MAX - photoList.length;
      if (remaining <= 0) {
        setUploadError(`You can add up to ${VENUE_GALLERY_MAX} photos.`);
        return;
      }

      const accepted = Array.from(files).slice(0, remaining);
      const uploaded: string[] = [];
      let skipped = false;
      setUploading(true);
      try {
        for (const file of accepted) {
          if (
            !VENUE_IMAGE_TYPES.includes(file.type) ||
            file.size > VENUE_IMAGE_MAX_BYTES
          ) {
            skipped = true;
            continue;
          }
          try {
            const imageBase64 = await readFileAsDataUrl(file);
            const { url } = await uploadImage({
              imageBase64,
              imageMimeType: file.type,
              kind: "cover",
            });
            if (url?.trim()) uploaded.push(url.trim());
          } catch {
            skipped = true;
          }
        }
      } finally {
        setUploading(false);
      }

      if (uploaded.length === 0) {
        setUploadError(
          skipped
            ? "Photos must be JPG, PNG, or WEBP under 10MB."
            : "We couldn't upload those photos. Please try again.",
        );
        return;
      }

      const nextPhotos = [...photoList, ...uploaded].slice(0, VENUE_GALLERY_MAX);
      onChange({
        photoUrls: nextPhotos,
        coverUrl: profile.coverUrl || uploaded[0] || null,
      });
      if (skipped) {
        setUploadError(
          "Some photos were skipped — each must be JPG/PNG/WEBP under 10MB.",
        );
      }
    },
    [canEdit, onChange, photoList, profile.coverUrl],
  );

  const eligibility = eligibilityRowsFromHours(profile.hours);
  const socialLinks = socialLinksFromProfile(profile);

  return (
    <main className="venue-theme min-h-screen bg-venue-canvas pb-28 text-venue-body sm:pb-10">
      <div className="mx-auto max-w-7xl px-5 pb-16 pt-8 sm:px-8 sm:pt-12 lg:px-10 lg:pb-24">
        <div className="mb-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="text-sm font-medium text-venue-muted hover:text-venue-ink"
          >
            {backLabel}
          </button>
          {!readOnly ? (
            <Button
              type="button"
              variant="outline"
              onClick={onToggleEdit}
              className="h-9 rounded-full border-venue-line bg-venue-paper px-3 text-xs font-semibold text-venue-ink shadow-none hover:bg-venue-soft"
            >
              <Pencil className="size-3.5" />
              {editing ? "Done" : "Edit"}
            </Button>
          ) : (
            <span className="h-9 w-9" aria-hidden />
          )}
        </div>

        <header className="mb-8 flex flex-wrap items-start justify-between gap-x-8 gap-y-4 sm:mb-10">
          <div className="min-w-0 max-w-4xl">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-venue-accent">
              <UtensilsCrossed className="size-3.5" /> {category}
            </div>
            {canEdit ? (
              <input
                className="mt-3 w-full max-w-3xl rounded-sm border border-venue-line bg-venue-paper px-3 py-2 font-venue-serif text-3xl text-venue-ink sm:text-5xl"
                value={profile.businessName}
                onChange={(e) => onChange({ businessName: e.target.value })}
                aria-label="Business name"
              />
            ) : (
              <h1 className="mt-3 font-venue-serif text-4xl leading-none text-venue-ink sm:text-6xl lg:text-7xl">
                {profile.businessName}
              </h1>
            )}
            {canEdit ? (
              <div className="mt-4 grid max-w-3xl gap-2 sm:grid-cols-2">
                <label className="block text-sm font-medium text-venue-ink sm:col-span-2">
                  Street address
                  <input
                    className="mt-1.5 w-full rounded-sm border border-venue-line bg-venue-paper px-3 py-2 text-sm"
                    value={profile.address}
                    onChange={(e) => onChange({ address: e.target.value })}
                  />
                </label>
                <label className="block text-sm font-medium text-venue-ink">
                  City
                  <input
                    className="mt-1.5 w-full rounded-sm border border-venue-line bg-venue-paper px-3 py-2 text-sm"
                    value={profile.city}
                    onChange={(e) => onChange({ city: e.target.value })}
                  />
                </label>
                <label className="block text-sm font-medium text-venue-ink">
                  State
                  <input
                    className="mt-1.5 w-full rounded-sm border border-venue-line bg-venue-paper px-3 py-2 text-sm"
                    value={profile.state}
                    onChange={(e) => onChange({ state: e.target.value })}
                  />
                </label>
                <label className="block text-sm font-medium text-venue-ink sm:col-span-2">
                  ZIP
                  <input
                    className="mt-1.5 w-full rounded-sm border border-venue-line bg-venue-paper px-3 py-2 text-sm"
                    value={profile.zip}
                    onChange={(e) => onChange({ zip: e.target.value })}
                  />
                </label>
                <label className="block text-sm font-medium text-venue-ink sm:col-span-2">
                  Eligible time
                  <input
                    className="mt-1.5 w-full rounded-sm border border-venue-line bg-venue-paper px-3 py-2 text-sm"
                    value={profile.eligibleWindow}
                    placeholder="e.g. October 6–8, 2026"
                    onChange={(e) => onChange({ eligibleWindow: e.target.value })}
                  />
                </label>
              </div>
            ) : (
              <p className="mt-4 flex items-start gap-2 text-sm text-venue-body sm:text-base">
                <MapPin className="mt-0.5 size-4 shrink-0 text-venue-accent" />
                {addressLine || "Address not set"}
              </p>
            )}
          </div>
          {canEdit ? (
            <VenueSocialEditFields
              profile={profile}
              onChange={onChange}
              className="ml-auto pt-1 sm:pt-3"
            />
          ) : (
            <VenueSocialLinks links={socialLinks} className="ml-auto pt-1 sm:pt-3" />
          )}
        </header>

        <VenueGallery
          images={images}
          venueName={profile.businessName}
          editing={canEdit}
          activeSrc={resolvedCover}
          photosLoading={photosLoading}
          uploading={uploading}
          uploadError={uploadError}
          onUploadFiles={canEdit ? handleUploadFiles : undefined}
          onSelectCover={(src) => {
            if (!canEdit) return;
            const original =
              photoList.find((u) => resolveVenueImageSrc(u) === src) ?? src;
            onChange({ coverUrl: original });
          }}
        />

        <div className="mt-12 grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-16 xl:grid-cols-[minmax(0,1fr)_27rem]">
          <div className="space-y-12">
            <section aria-labelledby="about-venue-heading">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-venue-accent">
                The experience
              </p>
              <h2
                id="about-venue-heading"
                className="mt-2 font-venue-serif text-3xl text-venue-ink sm:text-4xl"
              >
                About the venue
              </h2>
              {canEdit ? (
                <textarea
                  className="mt-5 min-h-40 w-full max-w-3xl rounded-sm border border-venue-line bg-venue-paper px-3 py-2.5 text-base leading-8 text-venue-body"
                  value={profile.about}
                  placeholder="Tell supporters about your venue."
                  onChange={(e) => onChange({ about: e.target.value })}
                />
              ) : aboutParagraphs.length > 0 ? (
                <div className="mt-5 max-w-3xl space-y-5 text-base leading-8 text-venue-body sm:text-lg">
                  {aboutParagraphs.map((paragraph, index) => (
                    <p key={`${index}-${paragraph.slice(0, 24)}`}>{paragraph}</p>
                  ))}
                </div>
              ) : (
                <p className="mt-5 text-base text-venue-muted">
                  {readOnly
                    ? "Venue details will appear here when available."
                    : "Add a short story about your venue with Edit."}
                </p>
              )}
            </section>

            {/* Campaign profile: hours stay under About; reserve sits in the right column. */}
            {readOnly ? (
              <EligibilitySchedule
                rows={eligibility}
                editing={canEdit}
                hours={profile.hours}
                onChangeDay={(day, value) =>
                  onChange({
                    hours: {
                      ...profile.hours,
                      [day]: value.trim() ? value.trim() : "-",
                    },
                  })
                }
              />
            ) : null}
          </div>

          {readOnly ? (
            <ReservationPreview
              venueName={profile.businessName}
              offerName={offerName}
              dateLabel={dateLabel}
              donationPercent={profile.givebackPercent}
              beneficiary={beneficiary}
              bookUrl={liveBookUrl}
              liveBooking
              onBookParticipation={onBookParticipation}
            />
          ) : (
            <div className="lg:sticky lg:top-8">
              <EligibilitySchedule
                rows={eligibility}
                editing={canEdit}
                hours={profile.hours}
                onChangeDay={(day, value) =>
                  onChange({
                    hours: {
                      ...profile.hours,
                      [day]: value.trim() ? value.trim() : "-",
                    },
                  })
                }
              />
            </div>
          )}
        </div>

        {onContinue ? (
          <Button
            type="button"
            onClick={onContinue}
            className="mt-12 h-12 w-full rounded-sm bg-venue-accent text-sm font-semibold text-venue-paper shadow-none hover:bg-venue-accent-strong sm:max-w-md"
          >
            {continueLabel}
            <ArrowRight className="size-4" />
          </Button>
        ) : null}
      </div>

      {onContinue || (readOnly && liveBookUrl) ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-venue-line bg-venue-paper/95 p-3 backdrop-blur-md sm:hidden">
          {onContinue ? (
            <Button
              type="button"
              onClick={onContinue}
              className="h-12 w-full rounded-sm bg-venue-accent text-venue-paper shadow-none hover:bg-venue-accent-strong"
            >
              {continueLabel} <ArrowRight />
            </Button>
          ) : (
            <Button
              type="button"
              asChild
              className="h-12 w-full rounded-sm bg-venue-accent text-venue-paper shadow-none hover:bg-venue-accent-strong"
            >
              <a href="#reservation">
                {bookingCtaLabel(liveBookUrl!)} <ArrowRight />
              </a>
            </Button>
          )}
        </div>
      ) : null}
    </main>
  );
}
