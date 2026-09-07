"use client";

/**
 * Task 1 + 2 (minimal) — Simplified public homepage (`website-landing`).
 * Hero unchanged; live campaigns preview (4 cards) + View all. Marketing at website-marketing.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  Loader2,
  Menu,
  Store,
  X,
} from "lucide-react";
import { assetSrc } from "@/lib/utils";
import forkupLogo from "@/assets/forkup-logo-transparent.png";
import heroImage from "@/assets/events-hero.jpg";
import { useCampaign } from "@/lib/campaign-context";
import { fetchCampaigns } from "@/lib/api";
import { resolveDashboardStep, stashAccountIntent, stepForBusinessJoin } from "@/lib/campaign-auth";
import { getAuthToken } from "@/lib/auth-storage";
import { useClientMounted } from "@/lib/use-client-mounted";
import type { CampaignListItem } from "@/lib/campaign-types";
import { CampaignDirectoryCard } from "@/components/campaign/CampaignDirectoryCard";
import { CampaignDatePicker, campaignHasEnded, campaignMatchesDate } from "@/components/campaign/CampaignDatePicker";
import { NearbyLocationPills } from "@/components/campaign/NearbyLocationPills";
import { useCampaignNearby } from "@/hooks/use-campaign-nearby";
import { HOMEPAGE_LIVE_PREVIEW_LIMIT } from "@/lib/homepage-campaigns";

export function PublicHomePage() {
  const { goTo, state } = useCampaign();
  const mounted = useClientMounted();
  const isLoggedIn = mounted && Boolean(getAuthToken());
  const nearby = useCampaignNearby();

  const openMyDashboard = () => {
    const dashboard = resolveDashboardStep(
      state.accountIntent,
      state.nonprofitMemberships.length > 0,
      state.businessMemberships.length > 0,
    );
    goTo(
      dashboard === "nonprofit-claim" ||
      dashboard === "business-claim" ||
      dashboard === "business-ai-onboarding"
        ? "account-hub"
        : dashboard,
    );
  };

  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();

  useEffect(() => {
    if (!nearby.locationReady) return;
    setLoading(true);
    const request = nearby.allLocations
      ? fetchCampaigns()
      : fetchCampaigns({ nearby: nearby.nearby! });
    void request
      .then(setCampaigns)
      .catch(() => setCampaigns([]))
      .finally(() => setLoading(false));
  }, [
    nearby.locationReady,
    nearby.allLocations,
    nearby.nearby?.lat,
    nearby.nearby?.lng,
    nearby.nearby?.radiusMiles,
  ]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [menuOpen]);

  const liveCampaigns = useMemo(
    () => campaigns.filter((c) => !campaignHasEnded(c)),
    [campaigns],
  );

  const displayed = useMemo(() => {
    if (!selectedDate) return liveCampaigns;
    return liveCampaigns.filter((c) => campaignMatchesDate(c, selectedDate));
  }, [liveCampaigns, selectedDate]);

  const homepagePreview = useMemo(
    () => displayed.slice(0, HOMEPAGE_LIVE_PREVIEW_LIMIT),
    [displayed],
  );

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
    const hasBusiness =
      state.businessMemberships.length > 0 || Boolean(state.businessProfile?.id);
    goTo(stepForBusinessJoin(isLoggedIn, hasBusiness));
  };

  const scrollTo = (id: string) => {
    setMobileOpen(false);
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-6">
          <nav className="hidden items-center gap-1 md:flex" ref={menuRef}>
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="inline-flex items-center gap-1 rounded-full px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Campaigns
                <ChevronDown className={`size-4 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
              </button>
              {menuOpen && (
                <div className="absolute left-0 top-full z-50 w-72 pt-2">
                  <div className="overflow-hidden rounded-2xl border border-border bg-popover p-1.5 shadow-xl">
                    <button
                      type="button"
                      onClick={() => scrollTo("live-campaigns")}
                      className="block w-full rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-accent"
                    >
                      <span className="block text-sm font-semibold">Live Campaigns</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">Active campaigns happening now.</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        goTo("past-campaigns");
                      }}
                      className="block w-full rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-accent"
                    >
                      <span className="block text-sm font-semibold">Past Campaigns</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">Completed campaigns and results.</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        goTo("success-stories");
                      }}
                      className="block w-full rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-accent"
                    >
                      <span className="block text-sm font-semibold">Success Stories</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">Featured community impact.</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => goTo("website-marketing")}
              className="rounded-full px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              About ForkUp
            </button>
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden lg:flex">
              <NearbyLocationPills
                locationLabel={nearby.locationLabel}
                zipInput={nearby.zipInput}
                setZipInput={nearby.setZipInput}
                zipError={nearby.zipError}
                radiusMiles={nearby.radiusMiles}
                setRadiusMiles={nearby.setRadiusMiles}
                allLocations={nearby.allLocations}
                setAllLocations={nearby.setAllLocations}
              />
            </div>
            {isLoggedIn && (
              <button
                type="button"
                onClick={openMyDashboard}
                className="rounded-full px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                My Dashboard
              </button>
            )}
            <button
              type="button"
              onClick={joinAsBusiness}
              className="hidden rounded-full border border-border px-3.5 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent sm:inline-flex"
            >
              Join as Business
            </button>
            <button
              onClick={startCampaign}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-all hover:bg-primary-dark hover:-translate-y-0.5 active:scale-95"
            >
              Start a Campaign
              <ArrowRight className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent sm:hidden"
              aria-label="Menu"
            >
              {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="border-t border-border bg-background px-5 py-4 md:hidden">
            <div className="mb-3">
              <NearbyLocationPills
                locationLabel={nearby.locationLabel}
                zipInput={nearby.zipInput}
                setZipInput={nearby.setZipInput}
                zipError={nearby.zipError}
                radiusMiles={nearby.radiusMiles}
                setRadiusMiles={nearby.setRadiusMiles}
                allLocations={nearby.allLocations}
                setAllLocations={nearby.setAllLocations}
              />
            </div>
            <p className="px-1 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Campaigns
            </p>
            <button
              type="button"
              onClick={() => scrollTo("live-campaigns")}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-accent"
            >
              Live Campaigns
            </button>
            <button
              type="button"
              onClick={() => goTo("past-campaigns")}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-accent"
            >
              Past Campaigns
            </button>
            <button
              type="button"
              onClick={() => goTo("website-marketing")}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-accent"
            >
              About ForkUp
            </button>
            <button
              type="button"
              onClick={joinAsBusiness}
              className="mt-2 block w-full rounded-lg bg-primary px-3 py-2.5 text-left text-sm font-semibold text-primary-foreground"
            >
              Join as Business
            </button>
          </div>
        )}
      </header>

      {/* Hero — unchanged from marketing page */}
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

        <div className="relative mx-auto max-w-6xl px-5 pb-8 pt-4 sm:px-6 md:pb-10 md:pt-5">
          <div className="mx-auto max-w-4xl space-y-3 text-center text-background animate-rise">
            <div className="flex flex-col items-center gap-1">
              <img
                src={assetSrc(forkupLogo)}
                alt="ForkUp"
                width={380}
                height={190}
                className="h-[100px] w-auto object-contain md:h-[120px]"
              />
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-background/90">
                Do good through everyday spending
              </p>
            </div>
            <h1 className="mx-auto max-w-3xl font-display text-2xl font-semibold leading-tight tracking-tight sm:text-3xl md:max-w-4xl md:text-4xl lg:text-[2.75rem]">
              Raise more by bringing your community and
              <br />
              local businesses together.
            </h1>
            <p className="mx-auto max-w-2xl text-base leading-snug text-background/90 md:text-lg">
              ForkUp connects nonprofits, teams, schools, and community groups with local businesses and
              supporters to build campaigns, drive participation, and track the impact in one place.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={startCampaign}
                className="group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-base font-semibold text-primary-foreground shadow-xl shadow-primary/20 transition-all hover:bg-primary-dark hover:-translate-y-0.5 active:scale-95"
              >
                Start a Campaign
                <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
              </button>
              <button
                type="button"
                onClick={joinAsBusiness}
                className="inline-flex items-center gap-2 rounded-full border-2 border-background/60 bg-background/10 px-6 py-3.5 text-base font-semibold text-background backdrop-blur-md transition-all hover:bg-background/20 hover:-translate-y-0.5 active:scale-95"
              >
                <Store className="size-5" />
                Join as Business
              </button>
              <button
                onClick={() => scrollTo("live-campaigns")}
                className="inline-flex items-center gap-2 rounded-full border border-background/50 bg-background/10 px-6 py-3 text-sm font-semibold text-background backdrop-blur-md transition-all hover:bg-background/20"
              >
                Explore Live Campaigns
              </button>
            </div>
            <p className="pt-1 text-sm text-background/80">
              Create a campaign in minutes — or join one as a local business partner.
            </p>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-5 pb-12 pt-4 sm:px-6 md:pb-16 md:pt-6">
        <section id="live-campaigns" className="scroll-mt-24">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                  Live Campaigns
                </h2>
                <CampaignDatePicker
                  campaigns={liveCampaigns}
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                />
              </div>
              <p className="mt-1 text-muted-foreground">
                {!nearby.locationReady
                  ? "Loading campaigns…"
                  : nearby.allLocations
                    ? "Active campaigns everywhere — join one before it ends."
                    : `Active campaigns within ${nearby.nearby?.radiusMiles ?? nearby.radiusMiles} miles — join one before it ends.`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => goTo("campaign-directory")}
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary"
            >
              View all <ArrowRight className="size-4" />
            </button>
          </div>

          {loading && (
            <div className="flex justify-center py-12">
              <Loader2 className="size-8 animate-spin text-primary" />
            </div>
          )}

          {!loading && displayed.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No campaigns match your filters.{" "}
              {!nearby.allLocations && (
                <>
                  <button
                    type="button"
                    onClick={() => nearby.setAllLocations(true)}
                    className="font-semibold text-primary"
                  >
                    Show all locations
                  </button>
                  {", "}
                </>
              )}
              <button type="button" onClick={() => setSelectedDate(undefined)} className="font-semibold text-primary">
                Clear date
              </button>
              {" or "}
              <button type="button" onClick={startCampaign} className="font-semibold text-primary">
                start one
              </button>
              .
            </p>
          )}

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {homepagePreview.map((c) => (
              <CampaignDirectoryCard key={c.slug} campaign={c} />
            ))}
          </div>
        </section>
      </main>

      <section className="border-t border-border bg-muted/30">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-5 py-8 sm:flex-row sm:items-center sm:px-6">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Store className="size-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Local business?</p>
              <p className="text-sm text-muted-foreground">Join a campaign near you.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={joinAsBusiness}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Join as Business <ArrowRight className="size-4" />
          </button>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} ForkUp</p>
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
            <button type="button" onClick={() => goTo("past-campaigns")} className="hover:text-foreground">
              Past Campaigns
            </button>
            <button type="button" onClick={() => goTo("website-marketing")} className="hover:text-foreground">
              About ForkUp
            </button>
            <button type="button" onClick={() => goTo("success-stories")} className="hover:text-foreground">
              Success Stories
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
