"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Sparkles,
  Zap,
  BarChart3,
  Store,
  Users,
  ChevronDown,
  Menu,
  X,
  Loader2,
} from "lucide-react";
import { assetSrc } from "@/lib/utils";
import forkupLogo from "@/assets/forkup-logo-transparent.png";
import heroImage from "@/assets/events-hero.jpg";
import { formatCurrency } from "@/data/campaigns";
import { useCampaign } from "@/lib/campaign-context";
import { fetchCampaigns } from "@/lib/api";
import { stashAccountIntent } from "@/lib/campaign-auth";
import { getAuthToken } from "@/lib/auth-storage";
import { useClientMounted } from "@/lib/use-client-mounted";
import type { CampaignListItem } from "@/lib/campaign-types";
import { CampaignDirectoryCard } from "@/components/campaign/CampaignDirectoryCard";

/**
 * Public Landing Page — the broad public ForkUp marketplace front door.
 *
 * Routing into the current build (Lovable flow direction):
 *   • Start a Campaign        → Find org ("nonprofit-claim") or Org Ready ("start") if claimed
 *   • Explore Live Campaigns  → scroll to Live Campaigns section
 *   • Local business? Join    → Business Claim ("business-claim")
 *   • Campaigns dropdown       → scroll to Live Campaigns / campaign directory
 *   • For Nonprofits nav       → scroll to For Nonprofits section
 *   • For Businesses nav       → scroll to For Local Businesses section
 *   • How ForkUp Works nav     → scroll to How ForkUp Works section
 *   • Campaign card            → /campaign/{slug} (live API data)
 *
 * Full nonprofit path:
 *   Landing → Find org → Claim/edit → Org Ready → Quick Start → Details → Media
 *   → Review → Invite businesses (if giveback) → Launch
 */

const HOW_IT_WORKS = [
  {
    title: "Create Your Campaign",
    desc: "Tell ForkUp what you’re raising money for and choose the ways people can support.",
  },
  {
    title: "Invite Businesses, Ambassadors, or Supporters",
    desc: "Bring in local businesses, ambassadors, teams, and community supporters to spread the word.",
  },
  {
    title: "Supporters Take Action",
    desc: "People dine, shop, donate online, attend events, upload receipts, or share the campaign.",
  },
  {
    title: "ForkUp Tracks the Impact",
    desc: "Every visit, donation, and share is tracked so you can see what’s driving results.",
  },
  {
    title: "Results Are Shared and Settled",
    desc: "Campaign results are shared with participants and funds are settled with the nonprofit.",
  },
];

const WHY_LOVE = [
  {
    eyebrow: "EASY TO START",
    icon: Zap,
    title: "Create a campaign in minutes.",
    desc: "Tell ForkUp what you’re raising money for, choose how people can support, and review everything before launch.",
  },
  {
    eyebrow: "GUIDED TO LAUNCH",
    icon: Sparkles,
    title: "ForkUp keeps the campaign moving.",
    desc: "Behind the scenes, the Success Engine helps organize campaign messaging, partner activity, reminders, and next steps so the campaign does not stall after setup.",
  },
  {
    eyebrow: "TRACKED THROUGH CLOSEOUT",
    icon: BarChart3,
    title: "See the impact from start to finish.",
    desc: "Supporter activity, receipts, donations, giveback, reporting, and settlement stay organized from launch through closeout.",
  },
];

export function PublicLandingPage() {
  const { goTo, state } = useCampaign();
  const mounted = useClientMounted();
  const isLoggedIn = mounted && Boolean(getAuthToken());
  const [mobileOpen, setMobileOpen] = useState(false);
  const [liveCampaigns, setLiveCampaigns] = useState<CampaignListItem[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [campaignsMenuOpen, setCampaignsMenuOpen] = useState(false);
  const campaignsMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void fetchCampaigns()
      .then((rows) => setLiveCampaigns(rows.slice(0, 4)))
      .catch(() => setLiveCampaigns([]))
      .finally(() => setCampaignsLoading(false));
  }, []);

  // Close the (tap-friendly) Campaigns dropdown on outside click or Escape.
  useEffect(() => {
    if (!campaignsMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!campaignsMenuRef.current?.contains(e.target as Node)) setCampaignsMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCampaignsMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [campaignsMenuOpen]);

  const scrollTo = (id: string) => {
    setMobileOpen(false);
    setCampaignsMenuOpen(false);
    if (typeof document === "undefined") return;
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Nonprofit members → own-org create. Everyone else → fundraiser find-org path.
  const startCampaign = () => {
    if (state.nonprofitMemberships.length > 0 || state.nonprofitProfile) {
      stashAccountIntent("nonprofit");
      goTo("start");
      return;
    }
    stashAccountIntent("fundraiser");
    goTo("ai-find-org");
  };

  const joinAsBusiness = () => {
    stashAccountIntent("business");
    goTo("business-claim");
  };

  const exploreDirectory = () => {
    stashAccountIntent("supporter");
    goTo("campaign-directory");
  };

  const campaignMenu: {
    label: string;
    desc: string;
    onSelect: () => void;
  }[] = [
    {
      label: "Live Campaigns",
      desc: "Active campaigns happening now.",
      onSelect: () => scrollTo("campaigns"),
    },
    {
      label: "Past Campaigns",
      desc: "Completed campaigns and final results.",
      onSelect: () => {
        setMobileOpen(false);
        setCampaignsMenuOpen(false);
        goTo("past-campaigns");
      },
    },
    {
      label: "Success Stories",
      desc: "Featured campaigns with strong community impact.",
      onSelect: () => {
        setMobileOpen(false);
        setCampaignsMenuOpen(false);
        goTo("success-stories");
      },
    },
  ];

  const navItems = [
    { label: "For Nonprofits", target: "nonprofits" },
    { label: "For Businesses", target: "businesses" },
    { label: "How ForkUp Works", target: "how-it-works" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* In-page nav */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-6">
          <nav className="hidden items-center gap-1 md:flex">
            {/* Campaigns dropdown — click/tap toggle (works on touch + mouse) */}
            <div className="relative" ref={campaignsMenuRef}>
              <button
                onClick={() => setCampaignsMenuOpen((v) => !v)}
                className="inline-flex items-center gap-1 rounded-full px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                aria-haspopup="true"
                aria-expanded={campaignsMenuOpen}
              >
                Campaigns
                <ChevronDown
                  className={`size-4 transition-transform ${campaignsMenuOpen ? "rotate-180" : ""}`}
                />
              </button>
              {campaignsMenuOpen && (
                <div className="absolute left-0 top-full z-50 w-72 pt-2">
                  <div className="overflow-hidden rounded-2xl border border-border bg-popover p-1.5 shadow-xl">
                    {campaignMenu.map((item) => (
                      <button
                        key={item.label}
                        onClick={item.onSelect}
                        className="block w-full rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-accent"
                      >
                        <span className="block text-sm font-semibold text-foreground">{item.label}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">{item.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

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

          <div className="flex items-center gap-2">
            {isLoggedIn && (
              <button
                type="button"
                onClick={() => goTo("nonprofit-dashboard")}
                className="rounded-full px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                My Dashboard
              </button>
            )}
            <button
              onClick={startCampaign}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-all hover:bg-primary-dark hover:-translate-y-0.5 active:scale-95"
            >
              Start a Campaign
              <ArrowRight className="size-4" />
            </button>
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="border-t border-border bg-background px-5 py-4 md:hidden">
            <p className="px-1 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Campaigns
            </p>
            <div className="mb-2 space-y-0.5">
              {campaignMenu.map((item) => (
                <button
                  key={item.label}
                  onClick={item.onSelect}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent"
                >
                  {item.label}
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{item.desc}</span>
                </button>
              ))}
            </div>
            {navItems.map((item) => (
              <button
                key={item.target}
                onClick={() => scrollTo(item.target)}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                {item.label}
              </button>
            ))}
            {isLoggedIn && (
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  goTo("nonprofit-dashboard");
                }}
                className="mt-1 block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                My Dashboard
              </button>
            )}
          </div>
        )}
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
          <div className="absolute inset-0 bg-foreground/78" />
        </div>

        <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-12 sm:px-6 md:pb-24 md:pt-16">
          <div className="mx-auto max-w-3xl space-y-5 text-center text-background animate-rise">
            <div className="flex flex-col items-center gap-2">
              <img
                src={assetSrc(forkupLogo)}
                alt="ForkUp"
                width={380}
                height={190}
                className="h-[148px] w-auto object-contain md:h-[168px]"
              />
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-background/90">
                Do good through everyday spending
              </p>
            </div>
            <h1 className="font-display text-5xl font-semibold leading-[0.98] tracking-tight md:text-6xl lg:text-7xl">
              Raise more by bringing your community and local businesses together.
            </h1>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-background/90 md:text-xl">
              ForkUp connects nonprofits, teams, schools, and community groups with local businesses and
              supporters to build campaigns, drive participation, and track the impact in one place.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={startCampaign}
                className="group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-base font-semibold text-primary-foreground shadow-xl shadow-primary/20 transition-all hover:bg-primary-dark hover:-translate-y-0.5 active:scale-95"
              >
                Start a Campaign
                <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
              </button>
              <button
                onClick={() => scrollTo("campaigns")}
                className="inline-flex items-center gap-2 rounded-full border border-background/50 bg-background/10 px-6 py-3 text-sm font-semibold text-background backdrop-blur-md transition-all hover:bg-background/20"
              >
                Explore Live Campaigns
              </button>
            </div>
            <div className="flex flex-col items-center gap-3 pt-3">
              <p className="text-sm text-background/80">
                Create a campaign in minutes. Launch when ready.
              </p>
              <button
                onClick={joinAsBusiness}
                className="text-sm font-medium text-background underline-offset-4 transition-colors hover:underline"
              >
                Local business? Learn how to join campaigns.
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Live Campaigns — real API data */}
      <section id="campaigns" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-12 sm:px-6 md:py-16">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              Live Campaigns
            </h2>
            <p className="mt-1 text-muted-foreground">
              Active campaigns happening now — join one and take part before it ends.
            </p>
          </div>
          <button
            type="button"
            onClick={exploreDirectory}
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
            <button type="button" onClick={startCampaign} className="font-semibold text-primary">
              Start the first one
            </button>
            .
          </p>
        )}

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {liveCampaigns.map((c) => (
            <CampaignDirectoryCard key={c.slug} campaign={c} />
          ))}
        </div>

        <div className="mt-6 text-center sm:hidden">
          <button type="button" onClick={exploreDirectory} className="text-sm font-semibold text-primary">
            View all campaigns →
          </button>
        </div>
      </section>

      {/* How ForkUp Works — simple process */}
      <section id="how-it-works" className="scroll-mt-24 border-t border-border bg-background">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:px-6 md:py-16">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              How ForkUp Works
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-base text-muted-foreground">
              Five simple steps from campaign idea to measurable community impact.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {HOW_IT_WORKS.map((step, i) => (
              <div
                key={step.title}
                className="flex h-full flex-col items-start rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex size-11 items-center justify-center rounded-xl bg-accent text-lg font-semibold text-primary">
                  {i + 1}
                </div>
                <h3 className="mt-4 font-display text-base font-semibold leading-tight tracking-tight text-foreground">
                  {step.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why ForkUp Works — value + real results */}
      <section id="why-forkup-works" className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:px-6 md:py-16">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              Why ForkUp Works
            </h2>
            <p className="mt-2 text-base text-muted-foreground">
              ForkUp brings the campaign, partners, supporters, promotion, tracking, and results into one
              guided system.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {WHY_LOVE.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.eyebrow}
                  className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm"
                >
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent">
                    <Icon className="size-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      {item.eyebrow}
                    </p>
                    <h3 className="mt-1 font-display text-base font-semibold leading-snug tracking-tight text-foreground">
                      {item.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Real results proof — real API data */}
          <div className="mx-auto mt-14 max-w-5xl">
            <div className="mb-10 text-center">
              <h3 className="font-display text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
                Real Campaigns. Real Local Impact.
              </h3>
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
                  <div key={r.slug} className="rounded-3xl border border-border bg-card p-7 shadow-sm">
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
        </div>
      </section>

      {/* For Nonprofits */}
      <section id="nonprofits" className="scroll-mt-24 border-t border-border bg-background">
        <div className="mx-auto max-w-3xl px-5 py-20 text-center sm:px-6 md:py-24">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            For Nonprofits
          </p>
          <h2 className="font-display text-3xl font-semibold leading-[1.05] tracking-tight text-foreground md:text-5xl">
            Fundraising built for nonprofits, schools, teams, and community groups.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
            ForkUp helps you create a campaign, invite local businesses and supporters, and track your
            progress in one place.
          </p>

          <div className="mx-auto my-8 h-px w-[60px] bg-border" />

          <button
            onClick={startCampaign}
            className="group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-base font-semibold text-primary-foreground shadow-xl shadow-primary/20 transition-all hover:bg-primary-dark hover:-translate-y-0.5 active:scale-95"
          >
            Start a Campaign
            <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </section>

      {/* For Local Businesses */}
      <section id="businesses" className="scroll-mt-24 border-t border-border bg-muted/60">
        <div className="mx-auto max-w-3xl px-5 py-20 text-center sm:px-6 md:py-24">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            For Local Businesses
          </p>
          <h2 className="font-display text-3xl font-semibold leading-[1.05] tracking-tight text-foreground md:text-5xl">
            Support local causes and bring community energy to your business.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
            Restaurants, retailers, and local businesses can join campaigns, offer givebacks, host events,
            share campaign links, and track their impact.
          </p>

          <div className="mx-auto my-8 h-px w-[60px] bg-border" />

          <button
            onClick={joinAsBusiness}
            className="group inline-flex items-center gap-2 rounded-full border border-border bg-card px-7 py-3.5 text-base font-semibold text-foreground transition-all hover:border-primary/40 hover:-translate-y-0.5"
          >
            Learn How Businesses Join
            <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-border bg-background">
        <div className="mx-auto max-w-3xl px-5 py-16 text-center sm:px-6 md:py-20">
          <h2 className="font-display text-3xl font-semibold leading-[1.05] tracking-tight text-foreground md:text-5xl">
            Ready to turn community support into impact?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
            Start a campaign, explore live campaigns, or learn how local businesses can join.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={startCampaign}
              className="group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-base font-semibold text-primary-foreground shadow-xl shadow-primary/20 transition-all hover:bg-primary-dark hover:-translate-y-0.5 active:scale-95"
            >
              Start a Campaign
              <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
            </button>
            <button
              onClick={() => scrollTo("campaigns")}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-7 py-3.5 text-base font-semibold text-foreground transition-all hover:border-primary/40 hover:-translate-y-0.5"
            >
              Explore Live Campaigns
            </button>
            <button
              onClick={joinAsBusiness}
              className="inline-flex items-center gap-1.5 rounded-full px-5 py-3.5 text-sm font-semibold text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              Local business? Learn how to join campaigns.
            </button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 text-sm text-muted-foreground sm:px-6 md:flex-row">
          <p>
            © {new Date().getFullYear()}{" "}
            <button
              type="button"
              onDoubleClick={() => goTo(getAuthToken() ? "super-admin" : "super-admin-login")}
              className="cursor-default"
              title=""
              aria-label="ForkUp"
            >
              ForkUp
            </button>
            . Do good, locally.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <button onClick={() => scrollTo("campaigns")} className="transition-colors hover:text-foreground">
              Live Campaigns
            </button>
            <button onClick={() => goTo("past-campaigns")} className="transition-colors hover:text-foreground">
              Past Campaigns
            </button>
            <button onClick={() => goTo("success-stories")} className="transition-colors hover:text-foreground">
              Success Stories
            </button>
            <button onClick={() => scrollTo("nonprofits")} className="transition-colors hover:text-foreground">
              For Nonprofits
            </button>
            <button onClick={() => scrollTo("businesses")} className="transition-colors hover:text-foreground">
              For Businesses
            </button>
            {/* Quiet staff entry — same footer row, low contrast so it isn’t a marketing CTA */}
            <button
              type="button"
              onClick={() => goTo(getAuthToken() ? "super-admin" : "super-admin-login")}
              className="text-xs text-muted-foreground/45 transition-colors hover:text-muted-foreground"
            >
              Staff
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
