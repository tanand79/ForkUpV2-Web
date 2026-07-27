"use client";

/**
 * Campaign gallery picker (up to 6 images) for create/review flow.
 *
 * Purpose: Load preview images from Facebook / Instagram / website handles,
 * let the organizer pick a featured cover, remove/replace slots, or upload manually.
 *
 * Inputs: promotion channels + current cover/images from campaign state
 * Outputs: single onChange({ cover, images }) so cover/images stay in sync
 */

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Sparkles, Star, X } from "lucide-react";
import type { CampaignImage, PromotionChannels } from "@/lib/campaign-context";
import { suggestCampaignImages, uploadImage } from "@/lib/api";
import { MAX_CAMPAIGN_GALLERY_IMAGES } from "@/lib/builder-submit";

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

  const slots: CampaignImage[] = [];
  if (cover) slots.push(cover);
  for (const img of images) {
    if (slots.length >= MAX_CAMPAIGN_GALLERY_IMAGES) break;
    if (cover && (img.id === cover.id || (img.url && img.url === cover.url))) continue;
    slots.push(img);
  }

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
      setHint(
        `Loaded ${mapped.length} image${mapped.length === 1 ? "" : "s"}. The first is featured — tap a star to change.`,
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

    setUploading(true);
    try {
      const imageBase64 = await readFileAsDataUrl(file);
      const { url: storedUrl } = await uploadImage({
        imageBase64,
        imageMimeType: file.type,
        kind: "cover",
      });
      next = next.map((i) =>
        i.id === id ? { ...i, storedUrl, source: "manual" as const } : i,
      );
      applySlots(next, cover?.id ?? id);
      setHint("Image uploaded. It’s set as featured unless you pick another.");
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
    applySlots(
      slots.filter((i) => i.id !== id),
      cover && cover.id !== id ? cover.id : undefined,
    );
  };

  const setAsCover = (id: string) => {
    applySlots(slots, id);
  };

  const handleBrokenImage = (id: string) => {
    const remaining = slots.filter((i) => i.id !== id);
    applySlots(remaining, cover && cover.id !== id ? cover.id : undefined);
    setHint("Removed a photo that couldn’t be loaded. Try Upload or Load from social again.");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">Campaign photos</p>
          <p className="text-xs text-muted-foreground">
            Up to {MAX_CAMPAIGN_GALLERY_IMAGES} · load from social or upload
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

      <div className="grid grid-cols-3 gap-2">
        {slots.map((img) => {
          const isFeatured = cover?.id === img.id;
          return (
            <div
              key={img.id}
              className={`group relative aspect-square overflow-hidden rounded-xl bg-secondary ring-1 ${
                isFeatured ? "ring-2 ring-primary" : "ring-border"
              }`}
            >
              <img
                src={previewSrc(img)}
                alt={img.name}
                className="size-full object-cover"
                onError={() => handleBrokenImage(img.id)}
              />
              {isFeatured && (
                <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                  <Star className="size-2.5 fill-current" />
                  Featured
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-gradient-to-t from-foreground/80 to-transparent p-1.5">
                {!isFeatured && (
                  <button
                    type="button"
                    onClick={() => setAsCover(img.id)}
                    className="rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-semibold"
                  >
                    Set featured
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeAt(img.id)}
                  className="ml-auto flex size-6 items-center justify-center rounded-full bg-background/90"
                  aria-label="Remove image"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        {canAdd && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border bg-secondary/40 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ImagePlus className="size-4" />
            )}
            <span className="text-[11px] font-semibold">{uploading ? "Saving…" : "Upload"}</span>
          </button>
        )}
      </div>

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
    </div>
  );
}
