"use client";

/**
 * Task 1 + 2 (minimal) — Simplified public homepage (`website-landing`).
 * Pass A: Join Us three-door hero; live campaigns section unchanged. Marketing at website-marketing.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ChevronDown, Loader2, Menu, X } from "lucide-react";
import { assetSrc } from "@/lib/utils";
import forkupLogo from "@/assets/forkup-logo-header.png";
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
import { JoinUsThreeDoorsHero } from "@/components/campaign/JoinUsThreeDoorsHero";
import { stashBusinessDoor } from "@/lib/business-door";

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
      dashboard === "business-ai-onboarding" ||
      dashboard === "business-giveback-join"
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

  const startCampaign = () => {
    if (state.nonprofitMemberships.length > 0 || state.nonprofitProfile) {
      stashAccountIntent("nonprofit");
      goTo("start");
      return;
    }
    // Pass 1: primary path is create via NPO (search org), not fundraiser-by-default.
    stashAccountIntent("nonprofit");
    goTo("ai-find-org");
  };

  const joinAsBusiness = () => {
    const hasBusiness =
      state.businessMemberships.length > 0 || Boolean(state.businessProfile?.id);
    goTo(stepForBusinessJoin(isLoggedIn, hasBusiness));
  };

  const joinAsRestaurant = () => {
    stashBusinessDoor("restaurant");
    joinAsBusiness();
  };

  const joinAsLocalBusiness = () => {
    stashBusinessDoor("local");
    joinAsBusiness();
  };

  const scrollTo = (id: string) => {
    setMobileOpen(false);
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => scrollTo("hero")}
              className="flex shrink-0 items-center rounded-lg"
              aria-label="ForkUp home"
            >
              <img
                src={assetSrc(forkupLogo)}
                alt="ForkUp"
                width={160}
                height={80}
                className="h-10 w-auto object-contain"
              />
            </button>
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
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          Active campaigns happening now.
                        </span>
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
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          Completed campaigns and results.
                        </span>
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
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          Featured community impact.
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => scrollTo("how-it-works")}
                className="rounded-full px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                How It Works
              </button>
              <button
                type="button"
                onClick={() => goTo("success-stories")}
                className="rounded-full px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Impact
              </button>
              <button
                type="button"
                onClick={() => goTo("website-marketing")}
                className="rounded-full px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                About Us
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-2">
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
              onClick={startCampaign}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-all hover:bg-primary-dark hover:-translate-y-0.5 active:scale-95"
            >
              Start a Campaign
              <ArrowRight className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent md:hidden"
              aria-label="Menu"
            >
              {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="border-t border-border bg-background px-5 py-4 md:hidden">
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
              onClick={() => scrollTo("how-it-works")}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-accent"
            >
              How It Works
            </button>
            <button
              type="button"
              onClick={() => goTo("success-stories")}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-accent"
            >
              Impact
            </button>
            <button
              type="button"
              onClick={() => goTo("website-marketing")}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-accent"
            >
              About Us
            </button>
            <button
              type="button"
              onClick={startCampaign}
              className="mt-2 block w-full rounded-lg bg-primary px-3 py-2.5 text-left text-sm font-semibold text-primary-foreground"
            >
              I&apos;m a Nonprofit or Charity
            </button>
            <button
              type="button"
              onClick={joinAsRestaurant}
              className="mt-1 block w-full rounded-lg border border-border px-3 py-2.5 text-left text-sm font-semibold"
            >
              I&apos;m a Restaurant
            </button>
            <button
              type="button"
              onClick={joinAsLocalBusiness}
              className="mt-1 block w-full rounded-lg border border-border px-3 py-2.5 text-left text-sm font-semibold"
            >
              I&apos;m a Local Business
            </button>
          </div>
        )}
      </header>

      <JoinUsThreeDoorsHero
        onNonprofit={startCampaign}
        onRestaurant={joinAsRestaurant}
        onLocalBusiness={joinAsLocalBusiness}
      />

      <main className="mx-auto max-w-6xl px-5 pb-12 pt-4 sm:px-6 md:pb-16 md:pt-6">
        <section id="live-campaigns" className="scroll-mt-24">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                  Live Campaigns
                </h2>
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
                  <button
                    type="button"
                    onClick={() => nearby.setRadiusMiles(50)}
                    className="font-semibold text-primary"
                  >
                    Widen to 50 mi
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
            {displayed.map((c) => (
              <CampaignDirectoryCard key={c.slug} campaign={c} />
            ))}
          </div>
        </section>
      </main>

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
            {/* Quiet staff entry — same pattern as About / website-marketing footer */}
            <button
              type="button"
              onClick={() => goTo(getAuthToken() ? "super-admin" : "super-admin-login")}
              className="text-xs text-muted-foreground/45 transition-colors hover:text-muted-foreground"
            >
              Staff Login
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
