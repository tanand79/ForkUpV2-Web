"use client";

/**
 * Homepage business directory card (near Live Campaigns).
 * Pending claim → blurred card; invite CTA only when inviteable.
 */
import { Clock, MapPin, Store } from "lucide-react";
import bizFallback from "@/assets/biz-restaurant.jpg";
import type { BusinessDirectoryItem } from "@/lib/api";
import { assetSrc } from "@/lib/utils";

type Props = {
  business: BusinessDirectoryItem;
  /** Real venue photo when known; falls back to placeholder. */
  coverUrl?: string | null;
  onViewProfile: (business: BusinessDirectoryItem) => void;
  onInvite: (business: BusinessDirectoryItem) => void;
};

export function HomepageBusinessCard({
  business,
  coverUrl,
  onViewProfile,
  onInvite,
}: Props) {
  const pending = business.awaitingVerification;
  const loc = business.locations[0];
  const place =
    loc &&
    [loc.locationName, loc.city, loc.state].filter(Boolean).join(", ");
  const imageSrc = coverUrl?.trim() ? coverUrl.trim() : assetSrc(bizFallback);

  return (
    <article
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${
        pending ? "ring-1 ring-amber-400/40" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => onViewProfile(business)}
        className="flex flex-1 flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        aria-label={`View profile for ${business.businessName}`}
      >
        <div className={`relative aspect-[4/3] overflow-hidden bg-muted ${pending ? "blur-[2px]" : ""}`}>
          <img
            src={imageSrc}
            alt=""
            loading="lazy"
            width={1024}
            height={768}
            className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.02]"
            onError={(e) => {
              const el = e.currentTarget;
              const fallback = assetSrc(bizFallback);
              if (el.src !== fallback) el.src = fallback;
            }}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-foreground/35" />
          {pending && (
            <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-amber-100/95 px-2.5 py-1 text-[11px] font-semibold text-amber-900 ring-1 ring-amber-200 backdrop-blur-md">
              <Clock className="size-3" />
              Awaiting verification
            </span>
          )}
        </div>

        <div className={`flex flex-1 flex-col space-y-3 p-5 ${pending ? "blur-[1.5px]" : ""}`}>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {business.businessType || "Business"}
            </p>
            <h3 className="font-display text-xl font-semibold leading-tight tracking-tight text-foreground transition-colors group-hover:text-primary">
              {business.businessName}
            </h3>
          </div>

          {place && (
            <div className="inline-flex items-start gap-1.5 text-xs text-muted-foreground">
              <MapPin className="mt-0.5 size-3.5 shrink-0" />
              <span>{place}</span>
            </div>
          )}

          <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Store className="size-3.5" />
            <span>
              <span className="font-medium text-foreground/80">{business.locations.length}</span>{" "}
              {business.locations.length === 1 ? "location" : "locations"}
            </span>
          </div>
        </div>
      </button>

      <div className="relative z-10 flex flex-wrap gap-2 border-t border-border p-4">
        <button
          type="button"
          onClick={() => onViewProfile(business)}
          className="inline-flex flex-1 items-center justify-center rounded-full border border-border px-3 py-2 text-sm font-semibold transition-colors hover:bg-accent"
        >
          View profile
        </button>
        {business.inviteable ? (
          <button
            type="button"
            onClick={() => onInvite(business)}
            className="inline-flex flex-1 items-center justify-center rounded-full bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-dark"
          >
            Invite
          </button>
        ) : (
          <span
            className="inline-flex flex-1 items-center justify-center rounded-full bg-muted px-3 py-2 text-sm font-medium text-muted-foreground"
            title="Claim is pending verification"
          >
            Invite unavailable
          </span>
        )}
      </div>
    </article>
  );
}
