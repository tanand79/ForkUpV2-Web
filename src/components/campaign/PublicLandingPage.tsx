"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  Heart,
  Store,
  Users,
  Loader2,
} from "lucide-react";
import { assetSrc } from "@/lib/utils";
import forkupLogo from "@/assets/forkup-logo.png";
import heroImage from "@/assets/events-hero.jpg";
import { formatCurrency } from "@/data/campaigns";
import { useCampaign } from "@/lib/campaign-context";
import { fetchCampaigns } from "@/lib/api";
import { stashAccountIntent } from "@/lib/campaign-auth";
import type { CampaignListItem } from "@/lib/campaign-types";
import { CampaignDirectoryCard } from "@/components/campaign/CampaignDirectoryCard";

/**
 * Public Landing Page — the broad public ForkUp marketplace front door.
 *
 * Routing into the current build:
 *   • Start a Campaign        → Campaign Setup Landing ("start")
 *   • Explore Campaigns       → scroll to Live Campaigns section
 *   • Become a Business Partner → Business Claim ("business-claim")
 *   • Campaigns nav           → scroll to Live Campaigns section
 *   • For Nonprofits nav      → scroll to Audience section
 *   • For Businesses nav      → scroll to For Businesses section
 *   • How ForkUp Works nav    → scroll to How ForkUp Works section
 *   • Campaign card           → /campaign/{slug} (live API data)
 */

const AUDIENCE = [
  {
    emoji: "❤️",
    title: "Nonprofit",
    desc: "Launch fundraising campaigns with local businesses.",
    cta: "Start Campaign",
    action: "start" as const,
  },
  {
    emoji: "🏪",
    title: "Business",
    desc: "Support local causes and attract customers.",
    cta: "Become a Partner",
    action: "business-claim" as const,
  },
  {
    emoji: "👥",
    title: "Supporter",
    desc: "Discover campaigns and participate.",
    cta: "Explore Campaigns",
    action: "campaigns" as const,
  },
];

const HOW_IT_WORKS = [
  {
    emoji: "❤️",
    title: "Choose Your Fundraising Methods",
    desc: "Combine Dine & Donate, online donations, guest bartending events, ambassador fundraising, and more.",
  },
  {
    emoji: "🏪",
    title: "Rally Businesses & Supporters",
    desc: "Invite local businesses, supporters, volunteers, and ambassadors to participate.",
  },
  {
    emoji: "👥",
    title: "Take Action In The Community",
    desc: "People dine, shop, book services, donate, attend events, and spread the word.",
  },
  {
    emoji: "📈",
    title: "ForkUp Tracks The Impact",
    desc: "Participation, fundraising activity, donations, and campaign results are organized in one place.",
  },
  {
    emoji: "🎯",
    title: "Causes Get Funded",
    desc: "Businesses give back, donations are collected, results are shared, and funds flow to the nonprofit.",
  },
];

const WHY_LOVE = [
  {
    audience: "For Nonprofits",
    icon: Heart,
    title: "Raise money with the help of your community.",
    desc: "Local businesses and supporters work together to fund your cause.",
  },
  {
    audience: "For Businesses",
    icon: Store,
    title: "Turn community support into new business.",
    desc: "Participate in campaigns that bring people through your doors while giving back.",
  },
  {
    audience: "For Supporters",
    icon: Users,
    title: "Make your everyday spending count.",
    desc: "Support causes you care about by dining, shopping, donating, and participating locally.",
  },
];


export function PublicLandingPage() {
  const { goTo } = useCampaign();
  const [liveCampaigns, setLiveCampaigns] = useState<CampaignListItem[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);

  useEffect(() => {
    void fetchCampaigns()
      .then((rows) => setLiveCampaigns(rows.slice(0, 4)))
      .catch(() => setLiveCampaigns([]))
      .finally(() => setCampaignsLoading(false));
  }, []);

  const scrollTo = (id: string) => {
    if (typeof document === "undefined") return;
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleAudience = (action: "start" | "business-claim" | "campaigns") => {
    if (action === "campaigns") {
      stashAccountIntent("supporter");
      goTo("campaign-directory");
      return;
    }
    stashAccountIntent(action === "start" ? "nonprofit" : "business");
    goTo(action);
  };

  const navItems = [
    { label: "Campaigns", target: "campaigns" },
    { label: "For Nonprofits", target: "audience" },
    { label: "For Businesses", target: "businesses" },
    { label: "How ForkUp Works", target: "how-it-works" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* In-page nav */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-6">
          <button onClick={() => scrollTo("hero")} className="flex items-center gap-2">
            <img src={assetSrc(forkupLogo)} alt="ForkUp" width={96} height={100} className="h-8 w-auto object-contain" />
          </button>
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <button
                key={item.target}
                onClick={() => scrollTo(item.target)}
                className="rounded-full px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </button>
            ))}
          </nav>
          <button
            onClick={() => goTo("start")}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-all hover:bg-primary-dark hover:-translate-y-0.5 active:scale-95"
          >
            Start a Campaign
            <ArrowRight className="size-4" />
          </button>
        </div>
      </header>

      {/* Hero */}
      <section id="hero" className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0">
          <img
            src={assetSrc(heroImage)}
            alt="Neighbors dining and shopping at local businesses at golden hour"
            width={1920}
            height={1080}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-foreground/70 via-foreground/50 to-foreground/20" />
        </div>

        <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-20 sm:px-6 md:pb-24 md:pt-28">
          <div className="max-w-3xl space-y-5 text-background animate-rise">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-background/90">
              Do good through everyday spending
            </p>
            <h1 className="font-display text-5xl font-semibold leading-[0.98] tracking-tight md:text-7xl">
              Turn everyday spending into{" "}
              <span className="italic font-normal">real community impact</span>
            </h1>
            <p className="max-w-2xl text-lg leading-relaxed text-background/90 md:text-xl">
              ForkUp helps nonprofits and local businesses create fundraising campaigns where everyday
              dining, shopping, and services generate real support for local causes.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={() => goTo("start")}
                className="group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-base font-semibold text-primary-foreground shadow-xl shadow-primary/20 transition-all hover:bg-primary-dark hover:-translate-y-0.5 active:scale-95"
              >
                Start a Campaign
                <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
              </button>
              <button
                onClick={() => goTo("campaign-directory")}
                className="inline-flex items-center gap-2 rounded-full border border-background/50 bg-background/10 px-7 py-3.5 text-base font-semibold text-background backdrop-blur-md transition-all hover:bg-background/20"
              >
                Explore Campaigns
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Live Campaigns — primary destination, directly below hero */}
      <section id="campaigns" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-12 sm:px-6 md:py-16">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              Live Campaigns
            </h2>
            <p className="mt-1 text-muted-foreground">
              Discover causes and businesses working together right now.
            </p>
          </div>
          <button
            type="button"
            onClick={() => goTo("campaign-directory")}
            className="hidden shrink-0 text-sm font-semibold text-primary sm:inline-flex sm:items-center sm:gap-1"
          >
            View all <ArrowRight className="size-4" />
          </button>
        </div>

        {campaignsLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        )}

        {!campaignsLoading && liveCampaigns.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No live campaigns yet.{" "}
            <button type="button" onClick={() => goTo("start")} className="font-semibold text-primary">
              Start the first one
            </button>
            .
          </p>
        )}

        <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-4">
          {liveCampaigns.map((c) => (
            <CampaignDirectoryCard key={c.slug} campaign={c} />
          ))}
        </div>

        <div className="mt-6 text-center sm:hidden">
          <button
            type="button"
            onClick={() => goTo("campaign-directory")}
            className="text-sm font-semibold text-primary"
          >
            View all campaigns →
          </button>
        </div>
      </section>

      {/* Choose Your Path — compact navigation strip */}
      <section id="audience" className="scroll-mt-24 border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-5 py-8 sm:px-6 md:py-10">
          <div className="text-center">
            <h2 className="font-display text-xl font-semibold tracking-tight text-foreground md:text-2xl">
              Choose Your Path
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Select the option that best describes you.
            </p>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {AUDIENCE.map((a) => (
              <div
                key={a.title}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 shadow-sm transition-all hover:shadow-md"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-lg">
                  <span aria-hidden>{a.emoji}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-sm font-semibold tracking-tight text-foreground">
                    {a.title}
                  </h3>
                  <p className="text-xs leading-snug text-muted-foreground">{a.desc}</p>
                </div>
                <button
                  onClick={() => handleAudience(a.action)}
                  className="group inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-all hover:border-primary/40 hover:text-primary"
                >
                  {a.cta}
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>





      {/* A Better Way To Raise Money Together */}
      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-6 md:py-24">
          <h2 className="text-center font-display text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
            A Better Way To Raise Money Together
          </h2>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {WHY_LOVE.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.audience}
                  className="flex flex-col items-start rounded-3xl border border-border bg-card p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-accent">
                    <Icon className="size-6 text-primary" />
                  </div>
                  <p className="mt-5 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    {item.audience}
                  </p>
                  <h3 className="mt-2 font-display text-xl font-semibold leading-tight tracking-tight text-foreground">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-base leading-relaxed text-muted-foreground">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Trust / Results */}
      <section className="border-t border-border bg-background">
        <div className="mx-auto max-w-5xl px-5 py-20 sm:px-6 md:py-24">
          <div className="mb-10 text-center">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
              Real Campaigns. Real Local Impact.
            </h2>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {campaignsLoading ? (
              <div className="col-span-full flex justify-center py-12">
                <Loader2 className="size-8 animate-spin text-primary" />
              </div>
            ) : liveCampaigns.length === 0 ? (
              <p className="col-span-full text-center text-sm text-muted-foreground">
                Live campaign results will appear here as nonprofits launch on ForkUp.
              </p>
            ) : (
              liveCampaigns.map((r) => (
              <div
                key={r.slug}
                className="rounded-3xl border border-border bg-card p-7 shadow-sm"
              >
                <h3 className="font-display text-xl font-semibold leading-tight tracking-tight text-foreground">
                  {r.name}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">{r.nonprofit}</p>
                <p className="mt-4 font-display text-3xl font-semibold text-primary">
                  {formatCurrency(r.raised)}{" "}
                  <span className="text-base font-normal text-muted-foreground">raised</span>
                </p>
                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="size-4" />
                    {r.supportersGoing} supporters
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Store className="size-4" />
                    {r.participatingLocationCount} participating businesses
                  </span>
                </div>
              </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* For Businesses */}
      <section id="businesses" className="scroll-mt-24 border-t border-border bg-muted/60">
        <div className="mx-auto max-w-3xl px-5 py-20 text-center sm:px-6 md:py-24">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            For Businesses
          </p>
          <h2 className="font-display text-3xl font-semibold leading-[1.05] tracking-tight text-foreground md:text-5xl">
            Looking for a meaningful way to give back?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
            Support local causes, engage your community, and drive traffic to your business through ForkUp
            campaigns.
          </p>

          <div className="mx-auto my-8 h-px w-[60px] bg-border" />

          <button
            onClick={() => goTo("business-claim")}
            className="group inline-flex items-center gap-2 rounded-full border border-border bg-card px-7 py-3.5 text-base font-semibold text-foreground transition-all hover:border-primary/40 hover:-translate-y-0.5"
          >
            Become a Business Partner
            <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </section>

      {/* How ForkUp Works — compact supporting content */}
      <section id="how-it-works" className="scroll-mt-24 border-t border-border bg-background">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:px-6 md:py-16">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              How ForkUp Works
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-base font-medium text-foreground">
              One campaign. Multiple ways to support a cause.
            </p>
            <p className="mx-auto mt-2 max-w-xl text-base text-muted-foreground">
              Supporters can dine, shop, book services, donate online, attend events, and share with
              friends — all within the same ForkUp campaign.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {HOW_IT_WORKS.map((step) => (
              <div
                key={step.title}
                className="flex flex-col items-start rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex size-11 items-center justify-center rounded-xl bg-accent text-2xl">
                  <span aria-hidden>{step.emoji}</span>
                </div>
                <h3 className="mt-3 font-display text-base font-semibold leading-tight tracking-tight text-foreground">
                  {step.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>

          <p className="mx-auto mt-8 max-w-2xl text-center text-sm font-medium text-muted-foreground">
            ForkUp turns everyday community activity into measurable impact.
          </p>
        </div>
      </section>



      {/* Final CTA */}
      <section className="border-t border-border bg-background">
        <div className="mx-auto max-w-3xl px-5 py-20 text-center sm:px-6 md:py-28">
          <h2 className="font-display text-3xl font-semibold leading-[1.05] tracking-tight text-foreground md:text-5xl">
            Ready to turn community support into impact?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
            Start a campaign, join as a business, or explore causes already live on ForkUp.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => goTo("start")}
              className="group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-base font-semibold text-primary-foreground shadow-xl shadow-primary/20 transition-all hover:bg-primary-dark hover:-translate-y-0.5 active:scale-95"
            >
              Start a Campaign
              <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
            </button>
            <button
              onClick={() => goTo("business-claim")}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-7 py-3.5 text-base font-semibold text-foreground transition-all hover:border-primary/40 hover:-translate-y-0.5"
            >
              Become a Business Partner
            </button>
            <button
              onClick={() => scrollTo("campaigns")}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-7 py-3.5 text-base font-semibold text-foreground transition-all hover:border-primary/40 hover:-translate-y-0.5"
            >
              Explore Campaigns
            </button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 text-sm text-muted-foreground sm:px-6 md:flex-row">
          <p>© {new Date().getFullYear()} ForkUp. Do good, locally.</p>
          <div className="flex items-center gap-6">
            <button onClick={() => scrollTo("campaigns")} className="transition-colors hover:text-foreground">
              Campaigns
            </button>
            <button onClick={() => scrollTo("audience")} className="transition-colors hover:text-foreground">
              For Nonprofits
            </button>
            <button onClick={() => scrollTo("businesses")} className="transition-colors hover:text-foreground">
              For Businesses
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
