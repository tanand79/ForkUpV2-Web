"use client";

/**
 * Campaign gallery picker (up to 8 images) for create/review flow.
 *
 * Purpose: Load preview images from Facebook / Instagram / website handles,
 * let the organizer pick a featured cover, remove/replace slots, or upload manually.
 * Layout matches the public campaign page: large open preview + horizontal thumb strip.
 * Uploads are auto-downscaled (~1600px) before save.
 *
 * Inputs: promotion channels + current cover/images from campaign state
 * Outputs: single onChange({ cover, images }) so cover/images stay in sync
 *
 * Changelog: Max raised to 8; upload path uses resizeCampaignImageFile.
 * Changelog: Visible Resize dialog (all-sides crop).
 * Changelog: Public-style layout (large open preview + thumbnail strip).
 */

import { useEffect, useRef, useState } from "react";
import { Crop, ImagePlus, Loader2, Replace, Sparkles, Star, X } from "lucide-react";
import type { CampaignImage, PromotionChannels } from "@/lib/campaign-context";
import { suggestCampaignImages, uploadImage } from "@/lib/api";
import { MAX_CAMPAIGN_GALLERY_IMAGES } from "@/lib/builder-submit";
import { resizeCampaignImageFile } from "@/lib/resize-campaign-image";
import { CampaignImageResizeDialog } from "@/components/campaign/CampaignImageResizeDialog";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the selected image"));
    reader.readAsDataURL(file);
  });
}

function previewSrc(img: CampaignImage): string {
  return img.url || img.storedUrl || "";
}

export interface CampaignGalleryPickerProps {
  promotion: PromotionChannels;
  cover: CampaignImage | null;
  images: CampaignImage[];
  /** Atomic update — keeps featured cover and gallery slots consistent. */
  onChange: (next: { cover: CampaignImage | null; images: CampaignImage[] }) => void;
}

export function CampaignGalleryPicker({
  promotion,
  cover,
  images,
  onChange,
}: CampaignGalleryPickerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [resizeOpen, setResizeOpen] = useState(false);
  /** Which gallery slot is shown in the large open preview. */
  const [activeId, setActiveId] = useState<string | null>(cover?.id ?? null);

  const slots: CampaignImage[] = [];
  if (cover) slots.push(cover);
  for (const img of images) {
    if (slots.length >= MAX_CAMPAIGN_GALLERY_IMAGES) break;
    if (cover && (img.id === cover.id || (img.url && img.url === cover.url))) continue;
    slots.push(img);
  }

  const active =
    slots.find((s) => s.id === activeId) ??
    slots.find((s) => cover && s.id === cover.id) ??
    slots[0] ??
    null;

  useEffect(() => {
    if (!slots.length) {
      setActiveId(null);
      return;
    }
    if (!activeId || !slots.some((s) => s.id === activeId)) {
      setActiveId(cover?.id ?? slots[0]!.id);
    }
    // Keep active valid when gallery membership changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots.map((s) => s.id).join("|"), cover?.id]);

  const canAdd = slots.length < MAX_CAMPAIGN_GALLERY_IMAGES;
  const hasSocialInput = Boolean(
    promotion.facebookUrl.trim() ||
      promotion.instagramHandle.trim() ||
      promotion.websiteUrl.trim(),
  );

  const applySlots = (next: CampaignImage[], featuredId?: string) => {
    const limited = next.slice(0, MAX_CAMPAIGN_GALLERY_IMAGES);
    const featured =
      limited.find((i) => i.id === featuredId) ??
      limited.find((i) => cover && i.id === cover.id) ??
      limited[0] ??
      null;
    onChange({
      cover: featured,
      images: limited.filter((i) => !featured || i.id !== featured.id),
    });
  };

  const handleSuggest = async () => {
    setError(null);
    setHint(null);
    if (!hasSocialInput) {
      setError("Add a Facebook URL, Instagram handle, or website above, then try again.");
      return;
    }
    setLoadingSuggest(true);
    try {
      const { images: suggested } = await suggestCampaignImages({
        facebookUrl: promotion.facebookUrl,
        instagramHandle: promotion.instagramHandle,
        websiteUrl: promotion.websiteUrl,
        limit: MAX_CAMPAIGN_GALLERY_IMAGES,
      });
      if (suggested.length === 0) {
        setHint(
          "No public preview images were found from those links (sites often block scrapers). Upload a photo manually instead.",
        );
        return;
      }
      const mapped: CampaignImage[] = suggested.map((s, i) => ({
        id: makeId(`social-${i}`),
        url: s.url,
        name: `From ${s.source}`,
        storedUrl: s.url,
        source: s.source,
        sourceUrl: s.sourceUrl,
        ...(s.caption ? { caption: s.caption } : {}),
      }));
      const existingManual = slots.filter((s) => s.source === "manual");
      const merged: CampaignImage[] = [];
      const seen = new Set<string>();
      for (const img of [...existingManual, ...mapped]) {
        const key = img.storedUrl || img.url;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        merged.push(img);
        if (merged.length >= MAX_CAMPAIGN_GALLERY_IMAGES) break;
      }
      applySlots(merged);
      setActiveId(merged[0]?.id ?? null);
      setHint(
        `Loaded ${mapped.length} image${mapped.length === 1 ? "" : "s"}. Tap a thumbnail, then Resize or Set featured.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load images from social links.");
    } finally {
      setLoadingSuggest(false);
    }
  };

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    setError(null);
    setHint(null);
    if (!canAdd && slots.length >= MAX_CAMPAIGN_GALLERY_IMAGES) {
      setError(`You can add up to ${MAX_CAMPAIGN_GALLERY_IMAGES} images.`);
      return;
    }
    if (!IMAGE_TYPES.includes(file.type)) {
      setError("Image must be a JPG, PNG, or WEBP file.");
      return;
    }
    if (file.size > IMAGE_MAX_BYTES) {
      setError("Image must be 10MB or smaller.");
      return;
    }

    const id = makeId("upload");
    const previewUrl = URL.createObjectURL(file);
    const draft: CampaignImage = {
      id,
      url: previewUrl,
      name: file.name,
      source: "manual",
    };

    let next = [...slots];
    if (next.length >= MAX_CAMPAIGN_GALLERY_IMAGES) {
      const replaceIdx = next.findIndex((i) => !cover || i.id !== cover.id);
      if (replaceIdx >= 0) next[replaceIdx] = draft;
      else next[next.length - 1] = draft;
    } else {
      next.push(draft);
    }
    applySlots(next, cover?.id ?? id);
    setActiveId(id);

    setUploading(true);
    try {
      const resized = await resizeCampaignImageFile(file);
      const imageBase64 = await readFileAsDataUrl(resized);
      const { url: storedUrl } = await uploadImage({
        imageBase64,
        imageMimeType: resized.type || file.type,
        kind: "cover",
      });
      next = next.map((i) =>
        i.id === id ? { ...i, storedUrl, source: "manual" as const } : i,
      );
      applySlots(next, cover?.id ?? id);
      setHint(
        `Image uploaded. ${Math.min(next.length, MAX_CAMPAIGN_GALLERY_IMAGES)}/${MAX_CAMPAIGN_GALLERY_IMAGES} — Resize on the open preview below.`,
      );
    } catch {
      setError("We couldn't save that image. Please try again.");
      applySlots(
        slots.filter((i) => i.id !== id),
        cover?.id,
      );
    } finally {
      setUploading(false);
    }
  };

  const removeAt = (id: string) => {
    const remaining = slots.filter((i) => i.id !== id);
    applySlots(remaining, cover && cover.id !== id ? cover.id : undefined);
    if (activeId === id) {
      setActiveId(remaining[0]?.id ?? null);
    }
  };

  const setAsCover = (id: string) => {
    applySlots(slots, id);
    setActiveId(id);
    setHint("Featured image updated.");
  };

  const handleBrokenImage = (id: string) => {
    const remaining = slots.filter((i) => i.id !== id);
    applySlots(remaining, cover && cover.id !== id ? cover.id : undefined);
    setHint("Removed a photo that couldn’t be loaded. Try Upload or Load from social again.");
    if (activeId === id) setActiveId(remaining[0]?.id ?? null);
  };

  /**
   * Applies a cropped File from CampaignImageResizeDialog to the open preview image.
   * Inputs: target image id, cropped File
   * Outputs: updates cover/images via onChange after upload
   */
  const handleResizeApply = async (targetId: string, file: File) => {
    setError(null);
    setUploading(true);
    try {
      const previewUrl = URL.createObjectURL(file);
      const imageBase64 = await readFileAsDataUrl(file);
      const { url: storedUrl } = await uploadImage({
        imageBase64,
        imageMimeType: file.type || "image/jpeg",
        kind: "cover",
      });
      const next = slots.map((i) =>
        i.id === targetId
          ? {
              ...i,
              url: previewUrl,
              storedUrl,
              name: file.name,
              source: "manual" as const,
            }
          : i,
      );
      applySlots(next, cover?.id);
      setActiveId(targetId);
      setHint("Image cropped. Tap Save photos if you’re on the review screen.");
    } catch {
      setError("Could not save the resized image. Try again.");
      throw new Error("resize upload failed");
    } finally {
      setUploading(false);
    }
  };

  const activeIsFeatured = Boolean(active && cover && active.id === cover.id);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">Campaign photos</p>
          <p className="text-xs text-muted-foreground">
            {slots.length}/{MAX_CAMPAIGN_GALLERY_IMAGES} · large preview + thumbnails · Resize on
            the open image
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => void handleSuggest()}
        disabled={loadingSuggest || !hasSocialInput}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loadingSuggest ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Sparkles className="size-4" />
        )}
        {loadingSuggest ? "Loading images…" : "Load images from social / website"}
      </button>
      {!hasSocialInput && (
        <p className="text-[11px] text-amber-700">
          Add Facebook, Instagram, or Website in Promotion channels first.
        </p>
      )}

      {/* Open preview — same idea as public campaign hero */}
      {active ? (
        <div className="relative overflow-hidden rounded-2xl border border-border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewSrc(active)}
            alt={active.name}
            className="aspect-[16/10] w-full object-contain"
            onError={() => handleBrokenImage(active.id)}
          />
          {activeIsFeatured ? (
            <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground shadow-sm">
              <Star className="size-3 fill-current" />
              Featured
            </span>
          ) : null}
          <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-2 bg-gradient-to-t from-foreground/70 to-transparent p-3">
            <button
              type="button"
              disabled={uploading}
              onClick={() => setResizeOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-background/95 px-3 py-1.5 text-xs font-semibold shadow-sm"
            >
              <Crop className="size-3.5" />
              Resize
            </button>
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-full bg-background/95 px-3 py-1.5 text-xs font-semibold shadow-sm"
            >
              <Replace className="size-3.5" />
              Change photo
            </button>
            {!activeIsFeatured ? (
              <button
                type="button"
                onClick={() => setAsCover(active.id)}
                className="inline-flex items-center gap-1.5 rounded-full bg-background/95 px-3 py-1.5 text-xs font-semibold shadow-sm"
              >
                <Star className="size-3.5" />
                Set featured
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => removeAt(active.id)}
              className="ml-auto inline-flex size-8 items-center justify-center rounded-full bg-background/95 shadow-sm"
              aria-label="Remove image"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-secondary/40 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <ImagePlus className="size-5" />
          )}
          <span className="text-sm font-semibold">
            {uploading ? "Saving…" : "Upload a campaign photo"}
          </span>
        </button>
      )}

      {/* Thumbnail strip — like public campaign page */}
      {(slots.length > 0 || canAdd) && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {slots.map((img) => {
            const selected = active?.id === img.id;
            const isFeatured = cover?.id === img.id;
            return (
              <button
                key={img.id}
                type="button"
                onClick={() => setActiveId(img.id)}
                aria-label={`Show ${img.name}`}
                aria-current={selected ? "true" : undefined}
                className={`relative size-16 shrink-0 overflow-hidden rounded-lg ring-2 transition-shadow ${
                  selected
                    ? "ring-primary"
                    : "ring-transparent opacity-80 hover:opacity-100"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewSrc(img)}
                  alt=""
                  className="size-full object-cover"
                  onError={() => handleBrokenImage(img.id)}
                />
                {isFeatured ? (
                  <span className="absolute left-0.5 top-0.5 rounded bg-primary px-1 text-[8px] font-bold text-primary-foreground">
                    ★
                  </span>
                ) : null}
              </button>
            );
          })}

          {canAdd && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex size-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-dashed border-border bg-secondary/40 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50"
              aria-label="Upload photo"
            >
              {uploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ImagePlus className="size-4" />
              )}
              <span className="text-[9px] font-semibold">Add</span>
            </button>
          )}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          void handleUpload(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />

      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}

      <CampaignImageResizeDialog
        open={resizeOpen && Boolean(active)}
        imageSrc={active ? previewSrc(active) : null}
        imageName={active?.name}
        onClose={() => setResizeOpen(false)}
        onApply={async (file) => {
          if (!active) return;
          await handleResizeApply(active.id, file);
        }}
      />
    </div>
  );
}
