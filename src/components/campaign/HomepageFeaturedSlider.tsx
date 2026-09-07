"use client";

/**
 * Homepage featured campaigns slider (Task 2).
 * Inputs: live campaign list + loading flag.
 * Outputs: full-width hero carousel; static fallback when no campaigns.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { assetSrc } from "@/lib/utils";
import heroImage from "@/assets/events-hero.jpg";
import { resolveCampaignImage } from "@/lib/campaign-images";
import { campaignPublicPath } from "@/lib/campaign-paths";
import type { CampaignListItem } from "@/lib/campaign-types";

const AUTOPLAY_MS = 7000;

export type HomepageFeaturedSliderProps = {
  campaigns: CampaignListItem[];
  loading?: boolean;
  onStartCampaign?: () => void;
};

function sortFeatured(campaigns: CampaignListItem[]): CampaignListItem[] {
  return [...campaigns].sort((a, b) => {
    if (a.topEvent !== b.topEvent) return a.topEvent ? -1 : 1;
    return b.raised - a.raised;
  });
}

export function HomepageFeaturedSlider({
  campaigns,
  loading,
  onStartCampaign,
}: HomepageFeaturedSliderProps) {
  const featured = useMemo(() => sortFeatured(campaigns).slice(0, 8), [campaigns]);
  const [api, setApi] = useState<CarouselApi>();
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setActiveIdx(api.selectedScrollSnap());
    onSelect();
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  useEffect(() => {
    if (!api || featured.length <= 1) return;
    const timer = window.setInterval(() => api.scrollNext(), AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [api, featured.length]);

  if (loading) {
    return (
      <section className="relative flex min-h-[220px] items-center justify-center border-b border-border bg-muted/40 sm:min-h-[280px] md:min-h-[320px]">
        <Loader2 className="size-8 animate-spin text-primary" />
      </section>
    );
  }

  if (featured.length === 0) {
    return (
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0">
          <img
            src={assetSrc(heroImage)}
            alt=""
            className="h-full w-full object-cover"
            width={1920}
            height={1080}
          />
          <div className="absolute inset-0 bg-foreground/75" />
        </div>
        <div className="relative mx-auto flex min-h-[220px] max-w-6xl flex-col items-center justify-center px-5 py-10 text-center text-background sm:min-h-[260px] md:min-h-[300px]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-background/85">
            Live campaigns near you
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">
            See what&apos;s happening in your community
          </h1>
          <p className="mt-2 max-w-lg text-sm text-background/85 md:text-base">
            No active campaigns in your area yet. Start one or check back soon.
          </p>
          {onStartCampaign && (
            <button
              type="button"
              onClick={onStartCampaign}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Start a Campaign <ArrowRight className="size-4" />
            </button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="relative border-b border-border bg-muted/30">
      <Carousel
        setApi={setApi}
        opts={{ loop: featured.length > 1, align: "start" }}
        className="mx-auto max-w-6xl px-5 sm:px-6"
      >
        <CarouselContent className="-ml-0">
          {featured.map((campaign) => {
            const img = resolveCampaignImage(campaign.image);
            const placeholder = resolveCampaignImage(null);
            return (
              <CarouselItem key={campaign.slug} className="basis-full pl-0">
                <Link
                  href={campaignPublicPath(campaign.slug)}
                  className="group relative block overflow-hidden rounded-2xl md:rounded-3xl"
                >
                  <div className="relative aspect-[16/7] min-h-[200px] w-full bg-muted sm:aspect-[16/6] md:min-h-[280px]">
                    <img
                      src={img}
                      alt={campaign.name}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                      onError={(e) => {
                        const el = e.currentTarget;
                        if (el.src !== placeholder) el.src = placeholder;
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-foreground/85 via-foreground/35 to-foreground/10" />
                    <div className="absolute inset-x-0 bottom-0 p-5 text-background sm:p-7 md:p-8">
                      <div className="flex flex-wrap items-center gap-2">
                        {campaign.topEvent && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-background/20 px-2.5 py-0.5 text-[11px] font-medium backdrop-blur-sm">
                            <Sparkles className="size-3 text-primary" />
                            Featured
                          </span>
                        )}
                        <span className="rounded-full bg-background/20 px-2.5 py-0.5 text-[11px] font-medium backdrop-blur-sm">
                          {campaign.dateRange}
                        </span>
                      </div>
                      <p className="mt-2 text-xs font-medium uppercase tracking-wider text-background/80">
                        {campaign.nonprofit}
                      </p>
                      <h2 className="mt-1 font-display text-2xl font-semibold leading-tight tracking-tight sm:text-3xl md:text-4xl">
                        {campaign.name}
                      </h2>
                      <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-background/95">
                        View campaign
                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              </CarouselItem>
            );
          })}
        </CarouselContent>
        {featured.length > 1 && (
          <>
            <CarouselPrevious className="left-3 border-background/30 bg-background/80 text-foreground hover:bg-background md:left-5" />
            <CarouselNext className="right-3 border-background/30 bg-background/80 text-foreground hover:bg-background md:right-5" />
          </>
        )}
      </Carousel>
      {featured.length > 1 && (
        <div className="flex justify-center gap-1.5 pb-4 pt-2">
          {featured.map((c, i) => (
            <button
              key={c.slug}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => api?.scrollTo(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === activeIdx ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/35"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
