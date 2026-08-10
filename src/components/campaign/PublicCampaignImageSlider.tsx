"use client";

/**
 * Public campaign hero image slider (additive).
 *
 * Purpose: Let visitors swipe or use arrows through campaign gallery photos,
 * with a thumbnail strip to jump to a specific slide.
 *
 * Inputs:
 *   urls — resolved gallery image URLs (1–8 typical)
 *   alt — accessible label for the campaign / first slide
 *   placeholderSrc — fallback when a URL fails to load
 *   featuredYoutubeUrl — optional watch/Shorts URL; shown as first slide when set
 *
 * Outputs: interactive slider UI only (no API calls)
 *
 * Changelog: Added Embla-based slider + thumbnails for public campaign page.
 * Changelog: Hero uses object-contain so full images autofit (no crop).
 * Changelog: Optional featured YouTube first — muted autoplay, advance on end;
 *            image slides auto-advance every 10s; arrows remain manual.
 */

import { useEffect, useRef, useState } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { FeaturedYoutubeEmbed } from "@/components/campaign/FeaturedYoutubeEmbed";
import {
  parseFeaturedYoutubeUrl,
  youtubeThumbnailUrl,
} from "@/lib/featured-youtube";

const IMAGE_AUTOPLAY_MS = 10_000;

export interface PublicCampaignImageSliderProps {
  urls: string[];
  alt: string;
  placeholderSrc: string;
  /** Additive: optional featured YouTube watch/Shorts URL (plays first when set). */
  featuredYoutubeUrl?: string | null;
}

type Slide =
  | { kind: "youtube"; videoId: string; url: string }
  | { kind: "image"; src: string };

/**
 * Renders a single hero image or a multi-slide carousel (optional YouTube first).
 *
 * Inputs: PublicCampaignImageSliderProps
 * Outputs: JSX for the campaign hero media block
 */
export function PublicCampaignImageSlider({
  urls,
  alt,
  placeholderSrc,
  featuredYoutubeUrl,
}: PublicCampaignImageSliderProps) {
  const yt = parseFeaturedYoutubeUrl(featuredYoutubeUrl ?? null);
  const imageUrls = urls.length > 0 ? urls : yt ? [] : [placeholderSrc];

  const slides: Slide[] = [
    ...(yt ? [{ kind: "youtube" as const, videoId: yt.videoId, url: yt.url }] : []),
    ...imageUrls.map((src) => ({ kind: "image" as const, src })),
  ];

  const galleryKey = `${yt?.videoId ?? ""}|${imageUrls.join("\0")}`;
  const slideCount = slides.length;

  const [api, setApi] = useState<CarouselApi>();
  const [activeIdx, setActiveIdx] = useState(0);
  const [failedSrcs, setFailedSrcs] = useState<Set<string>>(() => new Set());
  const activeIdxRef = useRef(0);

  useEffect(() => {
    setFailedSrcs(new Set());
    setActiveIdx(0);
    activeIdxRef.current = 0;
  }, [galleryKey]);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => {
      const idx = api.selectedScrollSnap();
      setActiveIdx(idx);
      activeIdxRef.current = idx;
    };
    onSelect();
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  /**
   * Image auto-advance every 10s. Skipped while the active slide is YouTube
   * (video ends via onEnded) or when there is only one slide.
   */
  useEffect(() => {
    if (!api || slideCount <= 1) return;
    const current = slides[activeIdx];
    if (!current || current.kind === "youtube") return;

    const timer = window.setTimeout(() => {
      const next = activeIdxRef.current + 1;
      if (next < slideCount) {
        api.scrollTo(next);
      } else {
        api.scrollTo(0);
      }
    }, IMAGE_AUTOPLAY_MS);

    return () => window.clearTimeout(timer);
    // galleryKey captures slide identity; slides[] is rebuilt each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, activeIdx, galleryKey, slideCount]);

  /**
   * Marks a gallery URL as failed so the bundled placeholder is shown.
   * Inputs: src — URL that failed to load
   * Outputs: updates failedSrcs state
   */
  const markFailed = (src: string) => {
    if (!src || src === placeholderSrc) return;
    setFailedSrcs((prev) => {
      if (prev.has(src)) return prev;
      const next = new Set(prev);
      next.add(src);
      return next;
    });
  };

  const displaySrc = (src: string) =>
    failedSrcs.has(src) ? placeholderSrc : src;

  /** Shared hero frame: full image visible (contain), letterboxed on muted bg. */
  const heroImgClass =
    "mx-auto aspect-[16/10] w-full object-contain object-center";

  /**
   * Advance to the next slide after the featured video ends.
   * Inputs: none. Outputs: scrolls carousel when video slide is active.
   */
  const handleVideoEnded = () => {
    if (!api || slideCount <= 1) return;
    if (slides[activeIdxRef.current]?.kind !== "youtube") return;
    const next = activeIdxRef.current + 1;
    if (next < slideCount) api.scrollTo(next);
  };

  /**
   * Thumbnail strip (always shown when there is at least one slide).
   * Inputs: none — uses slides/activeIdx/api from closure
   * Outputs: JSX strip
   */
  const thumbnailStrip = (
    <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
      {slides.map((slide, idx) => {
        const thumbSrc =
          slide.kind === "youtube"
            ? youtubeThumbnailUrl(slide.videoId)
            : displaySrc(slide.src);
        return (
          <button
            key={`thumb-${slide.kind}-${idx}`}
            type="button"
            onClick={() => {
              if (slides.length > 1) api?.scrollTo(idx);
              setActiveIdx(idx);
              activeIdxRef.current = idx;
            }}
            aria-label={
              slide.kind === "youtube"
                ? "Show featured video"
                : `Show photo ${idx + 1}`
            }
            aria-current={idx === activeIdx ? "true" : undefined}
            className={`relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted ring-2 transition-shadow ${
              idx === activeIdx
                ? "ring-primary"
                : "ring-transparent opacity-80 hover:opacity-100"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbSrc}
              alt=""
              className="size-full object-cover object-center"
              onError={() => {
                if (slide.kind === "image") markFailed(slide.src);
              }}
            />
            {slide.kind === "youtube" ? (
              <span className="absolute inset-0 flex items-center justify-center bg-black/35 text-[10px] font-bold text-white">
                ▶
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );

  const renderSlide = (slide: Slide, idx: number) => {
    if (slide.kind === "youtube") {
      return (
        <FeaturedYoutubeEmbed
          videoId={slide.videoId}
          title={`${alt} — featured video`}
          active={activeIdx === idx}
          onEnded={handleVideoEnded}
        />
      );
    }
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={displaySrc(slide.src)}
        alt={idx === 0 && !yt ? alt : `${alt} — photo ${idx + 1}`}
        className={heroImgClass}
        onError={() => markFailed(slide.src)}
      />
    );
  };

  if (slides.length <= 1) {
    const only = slides[0];
    return (
      <div>
        <div className="overflow-hidden rounded-2xl border border-border bg-muted">
          {only ? renderSlide(only, 0) : null}
        </div>
        {thumbnailStrip}
      </div>
    );
  }

  return (
    <div>
      <Carousel
        setApi={setApi}
        opts={{ loop: false, align: "start" }}
        className="w-full"
      >
        <div className="relative overflow-hidden rounded-2xl border border-border bg-muted">
          <CarouselContent className="-ml-0">
            {slides.map((slide, idx) => (
              <CarouselItem
                key={`${slide.kind}-${idx}`}
                className="basis-full pl-0"
              >
                {renderSlide(slide, idx)}
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious
            type="button"
            className="left-2 top-1/2 z-10 size-9 -translate-y-1/2 border-border bg-background/90 shadow-sm disabled:opacity-40"
          />
          <CarouselNext
            type="button"
            className="right-2 top-1/2 z-10 size-9 -translate-y-1/2 border-border bg-background/90 shadow-sm disabled:opacity-40"
          />
        </div>
      </Carousel>

      {thumbnailStrip}
    </div>
  );
}
