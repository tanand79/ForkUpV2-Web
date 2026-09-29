"use client";

/**
 * Nonprofit org profile — Lovable VenueProfile layout for NPOs.
 * Edit updates parent snapshot; gallery/social flush from dashboard.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
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
  Youtube,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LocationMapEmbed } from "@/components/campaign/LocationMapEmbed";
import { cn } from "@/lib/utils";
import { resolveVenueImageSrc } from "@/lib/business-join-images";
import { uploadImage } from "@/lib/api";
import {
  formatNonprofitAddress,
  type NonprofitOrgProfileSnapshot,
} from "@/lib/nonprofit-org-profile";

const ORG_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ORG_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const ORG_GALLERY_MAX = 24;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

type Props = {
  profile: NonprofitOrgProfileSnapshot;
  editing: boolean;
  onToggleEdit: () => void;
  onChange: (patch: Partial<NonprofitOrgProfileSnapshot>) => void;
  onBack: () => void;
  backLabel?: string;
  readOnly?: boolean;
  photosLoading?: boolean;
};

type GalleryImage = { id: string; src: string; alt: string };

type OrgSocialPlatform =
  | "instagram"
  | "facebook"
  | "linkedin"
  | "youtube"
  | "tiktok"
  | "website"
  | "phone"
  | "email";

type OrgSocialLink = {
  platform: OrgSocialPlatform;
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

function socialLinksFromProfile(
  profile: NonprofitOrgProfileSnapshot,
): OrgSocialLink[] {
  const links: OrgSocialLink[] = [];
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

function OrgSocialLinks({
  links,
  className,
}: {
  links: OrgSocialLink[];
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
            className="grid size-8 place-items-center rounded-full border border-venue-line bg-venue-paper text-venue-ink transition-colors hover:border-venue-accent hover:text-venue-accent sm:size-9"
          >
            <Icon className="size-3.5 sm:size-4" strokeWidth={1.75} aria-hidden="true" />
          </a>
        );
      })}
    </div>
  );
}

function OrgSocialEditFields({
  profile,
  onChange,
  className,
}: {
  profile: NonprofitOrgProfileSnapshot;
  onChange: (patch: Partial<NonprofitOrgProfileSnapshot>) => void;
  className?: string;
}) {
  const fieldClass =
    "mt-1 w-full rounded-sm border border-venue-line bg-venue-paper px-2.5 py-1.5 text-sm text-venue-ink";
  return (
    <div
      className={cn("grid w-full max-w-sm gap-2 sm:min-w-[16rem]", className)}
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
        YouTube
        <input
          type="url"
          className={fieldClass}
          value={profile.youtubeUrl ?? ""}
          placeholder="https://youtube.com/…"
          onChange={(e) => onChange({ youtubeUrl: e.target.value })}
        />
      </label>
      <label className="block text-xs font-medium text-venue-ink">
        LinkedIn
        <input
          type="url"
          className={fieldClass}
          value={profile.linkedinUrl ?? ""}
          placeholder="https://linkedin.com/…"
          onChange={(e) => onChange({ linkedinUrl: e.target.value })}
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
          placeholder="hello@org.org"
          onChange={(e) => onChange({ email: e.target.value })}
        />
      </label>
    </div>
  );
}

function OrgGallery({
  images,
  orgName,
  editing,
  activeSrc,
  onSelectCover,
  onUploadFiles,
  uploading = false,
  uploadError = null,
  photosLoading = false,
}: {
  images: GalleryImage[];
  orgName: string;
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
        nextIndex > activeIndex ||
          (activeIndex === images.length - 1 && nextIndex === 0)
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
          Add photos of your organization and impact. Tap a photo to set it as
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
      <section aria-label={`${orgName} image gallery`} className="space-y-3">
        <div className="grid h-52 place-items-center rounded-md bg-venue-soft text-sm text-venue-muted sm:h-72 lg:h-[22rem]">
          {photosLoading
            ? "Finding photos from website & social links…"
            : editing
              ? "No photos yet — upload organization images"
              : "Organization images coming soon"}
        </div>
        {uploadControls}
      </section>
    );
  }

  const activeImage = images[activeIndex] ?? images[0]!;
  const coverResolved = activeSrc;

  return (
    <section aria-label={`${orgName} image gallery`} className="space-y-3">
      <div
        className="group relative h-[18rem] overflow-hidden rounded-md bg-venue-ink sm:h-[25rem] lg:h-[31rem]"
        onTouchStart={(event) => {
          touchStart.current = event.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          const start = touchStart.current;
          const end = event.changedTouches[0]?.clientX;
          touchStart.current = null;
          if (start === null || end === undefined || Math.abs(start - end) < 45)
            return;
          showImage(activeIndex + (start > end ? 1 : -1));
        }}
      >
        <img
          key={activeImage.id}
          src={activeImage.src}
          alt={activeImage.alt}
          width={1600}
          height={1008}
          referrerPolicy="no-referrer"
          className={cn(
            "h-full w-full object-contain motion-safe:animate-venue-reveal",
            direction === "previous" &&
              "motion-safe:[animation-direction:reverse]",
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
              aria-label="Previous organization image"
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
              aria-label="Next organization image"
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
      </div>

      {images.length > 1 || editing ? (
        <div
          role="tablist"
          aria-label={`${orgName} thumbnails`}
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
                  index === activeIndex &&
                    "border-venue-accent opacity-100 ring-1 ring-venue-accent",
                  isCover && editing && "opacity-100",
                )}
              >
                <img
                  src={image.src}
                  alt=""
                  loading="lazy"
                  width={160}
                  height={96}
                  referrerPolicy="no-referrer"
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

export function NonprofitOrgProfile({
  profile,
  editing,
  onToggleEdit,
  onChange,
  onBack,
  backLabel = "Back",
  readOnly = false,
  photosLoading = false,
}: Props) {
  const canEdit = !readOnly && editing;
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const addressLine = formatNonprofitAddress(profile);
  const aboutParagraphs = profile.about
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const category = profile.causeCategory?.trim()
    ? `Nonprofit — ${profile.causeCategory.trim()}`
    : "Nonprofit — community";

  const photoList =
    profile.photoUrls.length > 0
      ? profile.photoUrls
      : profile.coverUrl
        ? [profile.coverUrl]
        : profile.logoUrl
          ? [profile.logoUrl]
          : [];
  const images: GalleryImage[] = photoList.map((src, index) => {
    const resolved = resolveVenueImageSrc(src);
    return {
      id: `${index}-${resolved.slice(-24)}`,
      src: resolved,
      alt: `${profile.organizationName} photo ${index + 1}`,
    };
  });
  const resolvedCover = profile.coverUrl
    ? resolveVenueImageSrc(profile.coverUrl)
    : null;

  const handleUploadFiles = useCallback(
    async (files: FileList) => {
      if (!canEdit) return;
      setUploadError(null);
      const remaining = ORG_GALLERY_MAX - photoList.length;
      if (remaining <= 0) {
        setUploadError(`You can add up to ${ORG_GALLERY_MAX} photos.`);
        return;
      }

      const accepted = Array.from(files).slice(0, remaining);
      const uploaded: string[] = [];
      let skipped = false;
      setUploading(true);
      try {
        for (const file of accepted) {
          if (
            !ORG_IMAGE_TYPES.includes(file.type) ||
            file.size > ORG_IMAGE_MAX_BYTES
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

      const nextPhotos = [...photoList, ...uploaded].slice(0, ORG_GALLERY_MAX);
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
              <HeartHandshake className="size-3.5" /> {category}
            </div>
            {canEdit ? (
              <input
                className="mt-3 w-full max-w-3xl rounded-sm border border-venue-line bg-venue-paper px-3 py-2 font-venue-serif text-3xl text-venue-ink sm:text-5xl"
                value={profile.organizationName}
                onChange={(e) => onChange({ organizationName: e.target.value })}
                aria-label="Organization name"
              />
            ) : (
              <h1 className="mt-3 font-venue-serif text-4xl leading-none text-venue-ink sm:text-6xl lg:text-7xl">
                {profile.organizationName}
              </h1>
            )}
            {canEdit ? (
              <div className="mt-4 grid max-w-3xl gap-2 sm:grid-cols-2">
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
              </div>
            ) : (
              <p className="mt-4 flex items-start gap-2 text-sm text-venue-body sm:text-base">
                <MapPin className="mt-0.5 size-4 shrink-0 text-venue-accent" />
                {addressLine
                  ? addressLine
                  : photosLoading
                    ? "Looking up location…"
                    : "Location not set"}
              </p>
            )}
          </div>
          {canEdit ? (
            <OrgSocialEditFields
              profile={profile}
              onChange={onChange}
              className="ml-auto pt-1 sm:pt-3"
            />
          ) : (
            <div className="ml-auto flex flex-col items-end gap-3 pt-1 sm:pt-3">
              <OrgSocialLinks links={socialLinks} />
            </div>
          )}
        </header>

        <OrgGallery
          images={images}
          orgName={profile.organizationName}
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

        <section className="mt-12 max-w-3xl" aria-labelledby="about-org-heading">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-venue-accent">
            Our mission
          </p>
          <h2
            id="about-org-heading"
            className="mt-2 font-venue-serif text-3xl text-venue-ink sm:text-4xl"
          >
            About
          </h2>
          {canEdit ? (
            <textarea
              className="mt-5 min-h-40 w-full rounded-sm border border-venue-line bg-venue-paper px-3 py-2.5 text-base leading-8 text-venue-body"
              value={profile.about}
              placeholder="Tell supporters about your organization and impact."
              onChange={(e) => onChange({ about: e.target.value })}
            />
          ) : aboutParagraphs.length > 0 ? (
            <div className="mt-5 space-y-5 text-base leading-8 text-venue-body sm:text-lg">
              {aboutParagraphs.map((paragraph, index) => (
                <p key={`${index}-${paragraph.slice(0, 24)}`}>{paragraph}</p>
              ))}
            </div>
          ) : (
            <p className="mt-5 text-base text-venue-muted">
              {readOnly
                ? "Organization details will appear here when available."
                : "Add a short story about your organization with Edit."}
            </p>
          )}
        </section>

        {addressLine ? (
          <LocationMapEmbed
            address={addressLine}
            title={`${profile.organizationName} location`}
            className="mt-16"
          />
        ) : null}
      </div>
    </main>
  );
}
