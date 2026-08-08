"use client";

/**
 * AI flow cover picker sheet.
 *
 * Purpose: Let organizers change the AI-build featured photo by picking a
 * suggested social/analysis image or uploading a new file (same rules as
 * classic CampaignReview featured-image replace).
 *
 * Inputs:
 *   open - whether the sheet is visible
 *   cover / images - current campaign media
 *   optional social URLs - live-refetch suggest when opened
 *   onClose - dismiss without change
 *   onSelectCover - set featured cover (and keep other suggested images)
 *   onSuggestedImages - optional: push live-fetched suggestions into gallery
 *
 * Output: calls onSelectCover with the chosen CampaignImage, then parent closes.
 *
 * Changelog: Additive live refetch of social post images on open (YT/LI/FB/IG).
 * Additive: referrerPolicy=no-referrer so social CDN images can render in browser.
 */
import { useEffect, useRef, useState } from "react";
import { ImageIcon, Loader2, Replace } from "lucide-react";
import type { CampaignImage } from "@/lib/campaign-context";
import { suggestCampaignImages, uploadImage } from "@/lib/api";
import { aiFlowCoverSourceLabel } from "./resolve-ai-flow-images";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;

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

function dedupeKey(url: string): string {
  return url.split("?")[0].toLowerCase();
}

export interface AiCampaignCoverPickerProps {
  open: boolean;
  cover: CampaignImage | null;
  images: CampaignImage[];
  onClose: () => void;
  onSelectCover: (cover: CampaignImage) => void;
  /** Optional social inputs for live POST /api/campaign-images/suggest on open. */
  facebookUrl?: string | null;
  instagramHandle?: string | null;
  websiteUrl?: string | null;
  linkedinUrl?: string | null;
  youtubeUrl?: string | null;
  /**
   * Optional: parent stores live-fetched suggestions so gallery stays in sync.
   * Inputs: newly suggested CampaignImage[]. Outputs: none.
   */
  onSuggestedImages?: (images: CampaignImage[]) => void;
}

export function AiCampaignCoverPicker({
  open,
  cover,
  images,
  onClose,
  onSelectCover,
  facebookUrl,
  instagramHandle,
  websiteUrl,
  linkedinUrl,
  youtubeUrl,
  onSuggestedImages,
}: AiCampaignCoverPickerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [liveSuggestions, setLiveSuggestions] = useState<CampaignImage[]>([]);

  useEffect(() => {
    if (!open) {
      setLiveSuggestions([]);
      setLoadingSuggest(false);
      setError(null);
      return;
    }

    const fb = (facebookUrl || "").trim();
    const ig = (instagramHandle || "").trim();
    const web = (websiteUrl || "").trim();
    const li = (linkedinUrl || "").trim();
    const yt = (youtubeUrl || "").trim();
    const hasAny = Boolean(fb || ig || web || li || yt);
    if (!hasAny) return;

    let cancelled = false;
    setLoadingSuggest(true);
    void (async () => {
      try {
        const { images: suggested } = await suggestCampaignImages({
          facebookUrl: fb || undefined,
          instagramHandle: ig || undefined,
          websiteUrl: web || undefined,
          linkedinUrl: li || undefined,
          youtubeUrl: yt || undefined,
          limit: 10,
        });
        if (cancelled) return;
        const mapped: CampaignImage[] = suggested.map((s, i) => ({
          id: `live-social-${Date.now()}-${i}`,
          url: s.url,
          name: `From ${s.source}`,
          storedUrl: s.url,
          source: s.source,
          sourceUrl: s.sourceUrl,
          ...(s.caption ? { caption: s.caption } : {}),
        }));
        setLiveSuggestions(mapped);
        if (mapped.length > 0) onSuggestedImages?.(mapped);
      } catch {
        if (!cancelled) {
          /* keep existing cover/images; do not block picker */
        }
      } finally {
        if (!cancelled) setLoadingSuggest(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Refetch whenever the sheet opens or social inputs change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, facebookUrl, instagramHandle, websiteUrl, linkedinUrl, youtubeUrl]);

  if (!open) return null;

  /** Deduped suggestions: live social first, then current cover, then gallery. */
  const suggestions: CampaignImage[] = [];
  const seen = new Set<string>();
  for (const img of [...liveSuggestions, cover, ...images].filter(Boolean) as CampaignImage[]) {
    const src = previewSrc(img);
    if (!src) continue;
    const key = dedupeKey(src);
    if (seen.has(key)) continue;
    seen.add(key);
    suggestions.push(img);
  }

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    setError(null);
    if (!IMAGE_TYPES.includes(file.type)) {
      setError("Image must be a JPG, PNG, or WEBP file.");
      return;
    }
    if (file.size > IMAGE_MAX_BYTES) {
      setError("Image must be 10MB or smaller.");
      return;
    }

    const coverId = `cover-${Date.now()}`;
    const previewUrl = URL.createObjectURL(file);
    const pending: CampaignImage = {
      id: coverId,
      url: previewUrl,
      name: file.name,
      source: "manual",
    };
    onSelectCover(pending);
    setUploading(true);
    try {
      const imageBase64 = await readFileAsDataUrl(file);
      const { url: storedUrl } = await uploadImage({
        imageBase64,
        imageMimeType: file.type,
        kind: "cover",
      });
      onSelectCover({ ...pending, storedUrl });
      onClose();
    } catch {
      setError("We couldn't save that image. Please check your connection and try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-foreground/40 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-cover-picker-title"
        className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 id="ai-cover-picker-title" className="text-sm font-bold">
            Change Featured Image
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            Close
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5">
          {loadingSuggest ? (
            <p className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin text-primary" />
              Finding photos from social links…
            </p>
          ) : null}

          {suggestions.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">
                Suggested photos
              </p>
              {suggestions.every(
                (img) =>
                  img.source === "website" ||
                  aiFlowCoverSourceLabel(img) === "From website",
              ) ? (
                <p className="mb-2 rounded-lg bg-secondary/50 px-2.5 py-2 text-[11px] leading-snug text-muted-foreground">
                  Facebook/Instagram posts aren’t publicly readable without login, so these
                  photos are from the organization website. Upload a social post photo below
                  if you prefer.
                </p>
              ) : null}
              <div className="grid grid-cols-3 gap-2">
                {suggestions.map((img) => {
                  const selected = cover?.id === img.id || cover?.url === img.url;
                  const src = previewSrc(img);
                  const sourceLabel = aiFlowCoverSourceLabel(img);
                  return (
                    <button
                      key={img.id}
                      type="button"
                      disabled={uploading}
                      onClick={() => {
                        onSelectCover(img);
                        onClose();
                      }}
                      className={`relative aspect-square overflow-hidden rounded-xl bg-secondary ring-2 transition-all ${
                        selected
                          ? "ring-primary"
                          : "ring-transparent hover:ring-primary/40"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt={img.name}
                        referrerPolicy="no-referrer"
                        className="size-full object-cover"
                      />
                      <span className="absolute inset-x-0 top-0 bg-background/85 px-1 py-0.5 text-center text-[9px] font-semibold leading-tight text-foreground">
                        {sourceLabel}
                      </span>
                      {selected ? (
                        <span className="absolute inset-x-0 bottom-0 bg-primary/90 py-0.5 text-center text-[10px] font-semibold text-primary-foreground">
                          Current
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : !loadingSuggest ? (
            <p className="text-xs text-muted-foreground">
              No suggested photos yet. Upload an image below.
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-secondary/30 px-4 py-6 text-sm font-semibold transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? (
              <>Saving image…</>
            ) : (
              <>
                <ImageIcon className="size-5" />
                Upload an image
              </>
            )}
          </button>
          {error ? (
            <p className="text-xs font-medium text-destructive">{error}</p>
          ) : null}
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
      </div>
    </div>
  );
}

/** Overlay control reused on the AI build cover preview. */
export function AiCoverChangeButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1.5 text-xs font-semibold shadow-sm backdrop-blur transition-colors hover:bg-background"
    >
      <Replace className="size-3.5" />
      Change photo
    </button>
  );
}
