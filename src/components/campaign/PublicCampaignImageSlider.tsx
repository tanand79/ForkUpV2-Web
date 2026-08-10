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
 *
 * Outputs: interactive slider UI only (no API calls)
 *
 * Changelog: Added Embla-based slider + thumbnails for public campaign page.
 * Changelog: Hero uses object-contain so full images autofit (no crop).
 */

import { useEffect, useState } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";

export interface PublicCampaignImageSliderProps {
  urls: string[];
  alt: string;
  placeholderSrc: string;
}

/**
 * Renders a single hero image or a multi-image carousel with thumbnails.
 *
 * Inputs: PublicCampaignImageSliderProps
 * Outputs: JSX for the campaign hero media block
 */
export function PublicCampaignImageSlider({
  urls,
  alt,
  placeholderSrc,
}: PublicCampaignImageSliderProps) {
  const slides = urls.length > 0 ? urls : [placeholderSrc];
  const galleryKey = slides.join("\0");

  const [api, setApi] = useState<CarouselApi>();
  const [activeIdx, setActiveIdx] = useState(0);
  const [failedSrcs, setFailedSrcs] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setFailedSrcs(new Set());
    setActiveIdx(0);
  }, [galleryKey]);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setActiveIdx(api.selectedScrollSnap());
    onSelect();
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

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
   * Thumbnail strip (always shown when there is at least one slide).
   * Inputs: none — uses slides/activeIdx/api from closure
   * Outputs: JSX strip
   */
  const thumbnailStrip = (
    <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
      {slides.map((src, idx) => (
        <button
          key={`thumb-${src}-${idx}`}
          type="button"
          onClick={() => {
            if (slides.length > 1) api?.scrollTo(idx);
            setActiveIdx(idx);
          }}
          aria-label={`Show photo ${idx + 1}`}
          aria-current={idx === activeIdx ? "true" : undefined}
          className={`size-16 shrink-0 overflow-hidden rounded-lg bg-muted ring-2 transition-shadow ${
            idx === activeIdx
              ? "ring-primary"
              : "ring-transparent opacity-80 hover:opacity-100"
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displaySrc(src)}
            alt=""
            className="size-full object-cover object-center"
            onError={() => markFailed(src)}
          />
        </button>
      ))}
    </div>
  );

  if (slides.length <= 1) {
    const only = slides[0] ?? placeholderSrc;
    return (
      <div>
        <div className="overflow-hidden rounded-2xl border border-border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displaySrc(only)}
            alt={alt}
            className={heroImgClass}
            onError={() => markFailed(only)}
          />
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
            {slides.map((src, idx) => (
              <CarouselItem key={`${src}-${idx}`} className="basis-full pl-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={displaySrc(src)}
                  alt={idx === 0 ? alt : `${alt} — photo ${idx + 1}`}
                  className={heroImgClass}
                  onError={() => markFailed(src)}
                />
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
