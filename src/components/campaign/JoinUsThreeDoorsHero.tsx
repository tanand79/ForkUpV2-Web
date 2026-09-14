"use client";

/**
 * Pass A — Join Us three-door hero for website-landing.
 * Purpose: Simple role doors (nonprofit / restaurant / local business) before deeper flows.
 * Inputs: onNonprofit, onRestaurant, onLocalBusiness click handlers from PublicHomePage.
 * Outputs: Full-bleed hero + Join Us panel + value-prop bar (no new routes/API).
 */
import {
  ArrowRight,
  BarChart3,
  Heart,
  MapPin,
  ShieldCheck,
  Store,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { assetSrc } from "@/lib/utils";
import heroImage from "@/assets/events-hero.jpg";
import nonprofitImg from "@/assets/campaign-sports.jpg";
import restaurantImg from "@/assets/biz-restaurant.jpg";
import businessImg from "@/assets/biz-retail.jpg";

export type JoinUsThreeDoorsHeroProps = {
  onNonprofit: () => void;
  onRestaurant: () => void;
  onLocalBusiness: () => void;
};

const DOORS = [
  {
    id: "nonprofit" as const,
    title: "I'm a Nonprofit or Charity",
    blurb: "I want to raise money and grow our mission.",
    icon: Heart,
    image: nonprofitImg,
    imageAlt: "Community youth supporting a cause",
    arrowClass: "bg-primary text-primary-foreground",
  },
  {
    id: "restaurant" as const,
    title: "I'm a Restaurant",
    blurb: "I want to support local causes and bring in new customers.",
    icon: UtensilsCrossed,
    image: restaurantImg,
    imageAlt: "Restaurant dish",
    arrowClass: "bg-primary text-primary-foreground",
  },
  {
    id: "local" as const,
    title: "I'm a Local Business",
    blurb: "I want to give back and connect with my community.",
    icon: Store,
    image: businessImg,
    imageAlt: "Local business storefront",
    arrowClass: "bg-[hsl(210_55%_42%)] text-white",
  },
] as const;

const VALUE_PROPS = [
  {
    title: "Easy to Start",
    desc: "Create a profile in under 2 minutes.",
    icon: Users,
  },
  {
    title: "Real Impact",
    desc: "Track donations and community support in real time.",
    icon: BarChart3,
  },
  {
    title: "Local First",
    desc: "Support the causes and businesses in your community.",
    icon: MapPin,
  },
  {
    title: "Trusted & Secure",
    desc: "Safe, transparent, and built for lasting impact.",
    icon: ShieldCheck,
  },
] as const;

export function JoinUsThreeDoorsHero({
  onNonprofit,
  onRestaurant,
  onLocalBusiness,
}: JoinUsThreeDoorsHeroProps) {
  const onDoor = (id: (typeof DOORS)[number]["id"]) => {
    if (id === "nonprofit") onNonprofit();
    else if (id === "restaurant") onRestaurant();
    else onLocalBusiness();
  };

  return (
    <>
      <section id="hero" className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0">
          <img
            src={assetSrc(heroImage)}
            alt="Neighbors dining together outdoors"
            width={1920}
            height={1080}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-foreground/88 via-foreground/72 to-foreground/55" />
        </div>

        <div className="relative mx-auto grid max-w-6xl gap-8 px-5 py-10 sm:px-6 md:grid-cols-[1.05fr_0.95fr] md:items-center md:gap-10 md:py-14 lg:py-16">
          <div className="animate-rise space-y-4 text-background md:space-y-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-background/85">
              Do good through everyday spending
            </p>
            <h1 className="font-display max-w-xl text-3xl font-semibold leading-[1.15] tracking-tight sm:text-4xl lg:text-[2.65rem]">
              Raise more by bringing your community and local businesses{" "}
              <span className="text-primary">together.</span>
            </h1>
            <p className="max-w-lg text-sm leading-relaxed text-background/88 sm:text-base">
              ForkUp connects nonprofits, restaurants, and local businesses to build campaigns,
              drive participation, and track real impact — all in one place.
            </p>
            <p className="font-display pt-2 text-2xl italic text-background/95 sm:text-3xl">
              Good Food. Greater Impact.
            </p>
          </div>

          <div className="animate-rise rounded-2xl border border-white/15 bg-foreground/55 p-4 shadow-2xl backdrop-blur-md sm:p-5">
            <h2 className="font-display text-2xl font-semibold text-background">Join Us</h2>
            <p className="mt-1 text-sm text-background/75">
              Choose how you want to make an impact.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {DOORS.map((door) => {
                const Icon = door.icon;
                return (
                  <button
                    key={door.id}
                    type="button"
                    onClick={() => onDoor(door.id)}
                    className="group flex flex-col overflow-hidden rounded-xl border border-white/10 bg-background/95 text-left shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.99]"
                  >
                    <div className="flex flex-1 flex-col gap-2 p-3.5 pb-2">
                      <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Icon className="size-4" />
                      </span>
                      <span className="text-sm font-semibold leading-snug text-foreground">
                        {door.title}
                      </span>
                      <span className="text-xs leading-snug text-muted-foreground">
                        {door.blurb}
                      </span>
                    </div>
                    <div className="relative mt-auto h-24 w-full">
                      <img
                        src={assetSrc(door.image)}
                        alt={door.imageAlt}
                        className="h-full w-full object-cover"
                      />
                      <span
                        className={`absolute bottom-2 right-2 inline-flex size-8 items-center justify-center rounded-full shadow-md transition-transform group-hover:translate-x-0.5 ${door.arrowClass}`}
                        aria-hidden
                      >
                        <ArrowRight className="size-4" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="border-b border-border bg-muted/40"
        aria-label="Why ForkUp"
      >
        <div className="mx-auto grid max-w-6xl divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
          {VALUE_PROPS.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="flex items-start gap-3 px-5 py-5 sm:px-6">
                <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
