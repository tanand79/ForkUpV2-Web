"use client";

/**
 * In-review campaign photos editor (additive).
 *
 * Purpose: On the Pending ForkUp Review preview screen, let organizers upload,
 * load social suggestions, crop/resize (via CampaignGalleryPicker Resize), and
 * save up to 8 gallery images without leaving the page.
 *
 * Inputs:
 *   slug — campaign slug (auth required for save)
 *   initialCoverUrl — current campaigns.cover_image_url (fallback if gallery empty)
 *   onSaved — optional callback with the new cover URL after a successful PUT
 *
 * Outputs: UI + PUT /api/campaign-images/:slug; calls onSaved(coverUrl)
 *
 * Changelog: Added so Crop/Resize/Save is visible on in-review-preview
 * (users never reached Campaign Review gallery from this screen).
 */

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import {
  fetchCampaignImages,
  putCampaignImages,
} from "@/lib/api";
import {
  buildCampaignGalleryPayload,
  durableCampaignImageUrl,
  MAX_CAMPAIGN_GALLERY_IMAGES,
} from "@/lib/builder-submit";
import type { CampaignImage, CampaignState, PromotionChannels } from "@/lib/campaign-context";
import { useCampaign } from "@/lib/campaign-context";
import { resolveCampaignImage } from "@/lib/campaign-images";
import { CampaignGalleryPicker } from "@/components/campaign/CampaignGalleryPicker";

const EMPTY_PROMOTION: PromotionChannels = {
  facebookUrl: "",
  instagramHandle: "",
  websiteUrl: "",
  newsletter: "",
};

export interface InReviewCampaignPhotosEditorProps {
  slug: string;
  initialCoverUrl: string | null;
  /** Inputs: new cover URL (or null). Outputs: none. */
  onSaved?: (coverUrl: string | null) => void;
}

/**
 * Loads gallery into local picker state and persists on Save photos.
 *
 * Inputs: InReviewCampaignPhotosEditorProps
 * Outputs: JSX panel with thumbnails, Resize, and Save
 */
export function InReviewCampaignPhotosEditor({
  slug,
  initialCoverUrl,
  onSaved,
}: InReviewCampaignPhotosEditorProps) {
  const { state, update } = useCampaign();
  const [cover, setCover] = useState<CampaignImage | null>(null);
  const [images, setImages] = useState<CampaignImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const promotion = state.promotion ?? EMPTY_PROMOTION;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const { images: gallery } = await fetchCampaignImages(slug);
        if (cancelled) return;

        if (gallery.length > 0) {
          const mapped: CampaignImage[] = gallery.map((g, i) => {
            const resolved = resolveCampaignImage(g.imageUrl) || g.imageUrl;
            return {
              id: `gallery-${g.id}-${i}`,
              url: resolved,
              name: g.isCover ? "Featured" : `Photo ${i + 1}`,
              storedUrl: g.storedUrl || g.imageUrl,
              source: (g.source as CampaignImage["source"]) || "manual",
              sourceUrl: g.sourceUrl,
            };
          });
          const featured =
            mapped.find((_, i) => gallery[i]?.isCover) ?? mapped[0] ?? null;
          setCover(featured);
          setImages(mapped.filter((m) => !featured || m.id !== featured.id));
        } else if (initialCoverUrl) {
          const resolved = resolveCampaignImage(initialCoverUrl) || initialCoverUrl;
          setCover({
            id: `cover-${slug}`,
            url: resolved,
            name: "Featured",
            storedUrl: initialCoverUrl,
            source: "manual",
          });
          setImages([]);
        } else {
          setCover(null);
          setImages([]);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load campaign photos.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, initialCoverUrl]);

  /**
   * Persists the current picker slots via PUT /api/campaign-images/:slug.
   * Inputs: none (reads cover/images state)
   * Outputs: updates server gallery; syncs campaign context cover; onSaved()
   */
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setHint(null);
    try {
      const payload = buildCampaignGalleryPayload({
        cover,
        images,
      } as CampaignState);
      if (payload.length === 0) {
        setError("Add at least one photo before saving.");
        return;
      }
      if (payload.length > MAX_CAMPAIGN_GALLERY_IMAGES) {
        setError(`At most ${MAX_CAMPAIGN_GALLERY_IMAGES} images are allowed.`);
        return;
      }
      const { images: saved } = await putCampaignImages(slug, payload);
      const coverRow = saved.find((i) => i.isCover) ?? saved[0];
      const coverResolved = coverRow
        ? resolveCampaignImage(coverRow.imageUrl) || coverRow.imageUrl
        : null;
      if (coverRow) {
        update({
          cover: {
            id: `cover-${slug}`,
            url: coverResolved || coverRow.imageUrl,
            name: "Featured",
            storedUrl: coverRow.storedUrl || coverRow.imageUrl,
            source: "manual",
          },
          images: saved
            .filter((i) => !i.isCover)
            .map((g, i) => ({
              id: `gallery-${g.id}-${i}`,
              url: resolveCampaignImage(g.imageUrl) || g.imageUrl,
              name: `Photo ${i + 1}`,
              storedUrl: g.storedUrl || g.imageUrl,
              source: (g.source as CampaignImage["source"]) || "manual",
              sourceUrl: g.sourceUrl,
            })),
        });
      }
      setHint(
        `Saved ${saved.length} photo${saved.length === 1 ? "" : "s"}. Crop with Resize anytime, then Save again.`,
      );
      onSaved?.(coverResolved || durableCampaignImageUrl(cover) || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save photos.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold">Campaign photos</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Up to {MAX_CAMPAIGN_GALLERY_IMAGES} photos. Large preview + thumbnails (like the public
            page). Tap <strong>Resize</strong> on the open image to crop, then{" "}
            <strong>Save photos</strong>.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || loading}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          {saving ? "Saving…" : "Save photos"}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : (
        <CampaignGalleryPicker
          promotion={promotion}
          cover={cover}
          images={images}
          onChange={({ cover: nextCover, images: nextImages }) => {
            setCover(nextCover);
            setImages(nextImages);
            setHint(null);
          }}
        />
      )}

      {hint ? <p className="mt-3 text-xs text-muted-foreground">{hint}</p> : null}
      {error ? <p className="mt-3 text-xs font-medium text-destructive">{error}</p> : null}
    </section>
  );
}
