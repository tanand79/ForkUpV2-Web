"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, Sparkles, Store, Users } from "lucide-react";
import { formatCurrency } from "@/data/campaigns";
import { resolveCampaignImage } from "@/lib/campaign-images";
import type { CampaignListItem } from "@/lib/campaign-types";
import { campaignPublicPath } from "@/lib/campaign-paths";
import { netAfterPlatformFee } from "@/lib/platform-config";

export function CampaignDirectoryCard({ campaign }: { campaign: CampaignListItem }) {
  const displayRaised = netAfterPlatformFee(campaign.raised);
  const pct =
    campaign.goal > 0 ? Math.min(100, Math.round((displayRaised / campaign.goal) * 100)) : 0;
  const resolvedSrc = resolveCampaignImage(campaign.image);
  const placeholderSrc = resolveCampaignImage(null);
  const [imgSrc, setImgSrc] = useState(resolvedSrc);

  useEffect(() => {
    setImgSrc(resolvedSrc);
  }, [resolvedSrc]);

  return (
    <Link
      href={campaignPublicPath(campaign.slug)}
      className="group block w-full overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <img
          src={imgSrc}
          alt={campaign.name}
          loading="lazy"
          width={1024}
          height={768}
          className="h-full w-full object-contain object-center transition-transform duration-500 group-hover:scale-[1.02]"
          onError={() => {
            if (imgSrc !== placeholderSrc) setImgSrc(placeholderSrc);
          }}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-foreground/35" />
        {campaign.topEvent && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/70 px-2 py-0.5 text-[10px] font-medium text-foreground/85 ring-1 ring-background/40 backdrop-blur-md">
            <Sparkles className="size-2.5 text-primary" />
            Top Event
          </span>
        )}
        <span className="absolute right-3 top-3 rounded-full bg-foreground/55 px-2.5 py-1 text-xs font-medium text-background ring-1 ring-background/15 backdrop-blur-md">
          {campaign.dateRange}
        </span>
      </div>

      <div className="space-y-3 p-5">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {campaign.nonprofit}
            {campaign.nonprofitVerified && (
              <span className="ml-1.5 text-primary">· Verified</span>
            )}
          </p>
          <h3 className="font-display text-xl font-semibold leading-tight tracking-tight text-foreground transition-colors group-hover:text-primary">
            {campaign.name}
          </h3>
        </div>

        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{formatCurrency(displayRaised)}</span>{" "}
          raised
          {campaign.goal > 0 && (
            <>
              {" "}
              of <span className="font-semibold text-foreground">{formatCurrency(campaign.goal)}</span>
            </>
          )}
        </p>

        {campaign.goal > 0 && (
          <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
        )}

        <div className="space-y-1 pt-1 text-xs text-muted-foreground">
          <div className="inline-flex items-center gap-1.5">
            <Users className="size-3.5" />
            <span>
              <span className="font-medium text-foreground/80">{campaign.supportersGoing}</span>{" "}
              people going
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Store className="size-3.5" />
            <span>
              <span className="font-medium text-foreground/80">
                {campaign.participatingLocationCount}
              </span>{" "}
              participating {campaign.participatingLocationCount === 1 ? "location" : "locations"}
            </span>
          </div>
          {campaign.participatingLocationCount > 0 && (
            <div className="inline-flex items-center gap-1.5">
              <MapPin className="size-3.5" />
              <span>Tap to view where to participate</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
