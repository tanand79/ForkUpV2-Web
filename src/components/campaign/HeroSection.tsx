import Link from "next/link";
import { Calendar, Users } from "lucide-react";
import { assetSrc } from "@/lib/utils";
import heroImg from "@/assets/hero-campaign.jpg";
import forkupLogo from "@/assets/forkup-logo.png";
import { useCampaign } from "@/lib/campaign-context";
import {
  getCampaignTitle,
  getNonprofitName,
  getCoverImage,
  getCampaignDateLabel,
} from "@/lib/campaign-display";

interface HeroSectionProps {
  onViewLocations: () => void;
  onDonate?: () => void;
  showLocationsCta?: boolean;
  showDonateCta?: boolean;
}

export const HeroSection = ({
  onViewLocations,
  onDonate,
  showLocationsCta = true,
  showDonateCta = true,
}: HeroSectionProps) => {
  const { state } = useCampaign();
  const title = getCampaignTitle(state);
  const nonprofitName = getNonprofitName(state);
  const coverImage = getCoverImage(state) ?? heroImg;
  const dateLabel = getCampaignDateLabel(state);

  return (
    <section className="relative min-h-[90vh] flex flex-col items-center justify-center overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0">
        <img
          src={assetSrc(coverImage)}
          alt={`${nonprofitName} campaign`}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-charcoal/60" />
      </div>

      {/* ForkUp logo — top center */}
      <div
        className="absolute top-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1 opacity-0 animate-fade-in"
        style={{ animationDelay: "50ms", animationFillMode: "forwards" }}
      >
        <Link href="/" aria-label="ForkUp home" className="rounded-lg transition-opacity hover:opacity-80">
          <img src={assetSrc(forkupLogo)} alt="ForkUp" className="h-[60px] w-auto drop-shadow-lg" />
        </Link>
        <span className="text-[12px] tracking-[0.25em] uppercase font-medium" style={{ color: "hsl(30 20% 85%)" }}>
          Do Good Through Everyday Spending
        </span>
      </div>

      {/* Content */}
      <div className="relative z-10 text-center max-w-2xl mx-auto section-padding py-24">

        <h1
          className="font-serif text-5xl sm:text-6xl md:text-7xl leading-[1.08] mb-6 text-balance opacity-0 animate-fade-up"
          style={{ color: "hsl(var(--warm-cream))", animationDelay: "200ms", animationFillMode: "forwards" }}
        >
          {title}
        </h1>

        <p
          className="text-lg sm:text-xl mb-2 opacity-0 animate-fade-up"
          style={{ color: "hsl(30 30% 95%)", animationDelay: "350ms", animationFillMode: "forwards" }}
        >
          Dine, shop, or book at participating local businesses — a portion of your visit supports {nonprofitName}.
        </p>

        {/* Social proof */}
        <div
          className="inline-flex items-center gap-2.5 bg-white/10 backdrop-blur-sm border border-white/15 rounded-full px-5 py-2 mb-4 opacity-0 animate-fade-up"
          style={{ animationDelay: "480ms", animationFillMode: "forwards" }}
        >
          <div className="flex -space-x-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-6 h-6 rounded-full bg-forest/80 border-2 border-white/20 flex items-center justify-center">
                <Users size={10} style={{ color: "hsl(var(--warm-cream))" }} />
              </div>
            ))}
          </div>
          <span className="text-xs font-medium tracking-wide" style={{ color: "hsl(30 25% 95%)" }}>
            82 Supporters Going
          </span>

        </div>

        {/* Trust badge */}
        <div
          className="flex items-center justify-center gap-3 mb-8 opacity-0 animate-fade-up"
          style={{ animationDelay: "510ms", animationFillMode: "forwards" }}
        >
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/15 rounded-full px-4 py-1.5">
            <div className="w-5 h-5 rounded-full bg-forest flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--warm-cream))" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
            </div>
            <span className="text-xs font-medium tracking-wide" style={{ color: "hsl(30 25% 95%)" }}>Verified Nonprofit</span>
          </div>
        </div>

        {/* Event details */}
        <div
          className="flex flex-wrap items-center justify-center gap-5 mb-10 opacity-0 animate-fade-up"
          style={{ color: "hsl(30 20% 90%)", animationDelay: "550ms", animationFillMode: "forwards" }}
        >
          <span className="flex items-center gap-2 text-sm">
            <Calendar size={16} /> {dateLabel}
          </span>
        </div>


        {/* CTAs — dual path */}
        <div
          className="flex flex-col items-center gap-3 opacity-0 animate-fade-up"
          style={{ animationDelay: "650ms", animationFillMode: "forwards" }}
        >
          {showLocationsCta && (
            <button onClick={onViewLocations} className="btn-primary text-base px-10 py-4">
              Choose where to participate
            </button>
          )}
          {showDonateCta && (
            <button
              onClick={onDonate}
              className="text-sm font-medium transition-all duration-200 ease-out active:scale-[0.97] group"
              style={{ color: "hsl(30 25% 90%)" }}
            >
              Can't make it?{" "}
              <span className="underline underline-offset-2 decoration-warm-cream/40 group-hover:decoration-warm-cream/70 transition-colors">
                Donate to {nonprofitName}
              </span>
            </button>
          )}
          <p
            className="text-xs mt-1"
            style={{ color: "hsl(30 20% 80%)" }}
          >
            Takes 10 seconds — every dollar goes to the team
          </p>
        </div>
      </div>
    </section>
  );
};
