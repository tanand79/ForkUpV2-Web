"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BadgeCheck,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Heart,
  Loader2,
  MapPin,
  Receipt,
} from "lucide-react";
import { resolveCampaignImage } from "@/lib/campaign-images";
import type { CampaignDetail, ParticipatingLocation } from "@/lib/campaign-types";
import { submitParticipation, fetchCampaignDonations, fetchCampaignImages } from "@/lib/api";
import { DonationModal } from "@/components/campaign/DonationModal";
import { OrganizationAvatar } from "@/components/campaign/OrganizationAvatar";
import { PublicCampaignDonationsFeed } from "@/components/campaign/PublicCampaignDonationsFeed";
import { PublicCampaignFundraisingPanel } from "@/components/campaign/PublicCampaignFundraisingPanel";
import { PublicCampaignGuestBartendingSection } from "@/components/campaign/PublicCampaignGuestBartendingSection";
import { PublicCampaignImageSlider } from "@/components/campaign/PublicCampaignImageSlider";
import { PublicCampaignLeaderboard } from "@/components/campaign/PublicCampaignLeaderboard";
import { HeaderPillLink, SiteHeader } from "@/components/campaign/SiteHeader";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

function isGuestBartendingLocation(loc: ParticipatingLocation): boolean {
  return loc.cta === "attend" || loc.participationMethod === "Guest Bartender";
}

function ctaLabel(loc: ParticipatingLocation): string {
  if (loc.cta === "reserve") return loc.reservationUrl ? "Reserve a table" : "Plan your visit";
  if (loc.cta === "visit") return "Plan your visit";
  if (loc.cta === "shop") return "Visit store";
  if (loc.cta === "book") return "Book appointment";
  if (loc.cta === "attend") return "Attend event";
  return "Participate";
}

const ctaButtonClass =
  "mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90";

function ParticipateModal({
  open,
  onOpenChange,
  campaignSlug,
  loc,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignSlug: string;
  loc: ParticipatingLocation;
}) {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [partySize, setPartySize] = useState("2");
  const [isFirstVisit, setIsFirstVisit] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [reservationUrl, setReservationUrl] = useState<string | null>(null);

  const reset = () => {
    setFirstName("");
    setEmail("");
    setPartySize("2");
    setIsFirstVisit(true);
    setError(null);
    setSuccess(false);
    setReservationUrl(null);
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    const guests = Number(partySize);
    if (!firstName.trim() || !email.includes("@") || !Number.isFinite(guests) || guests < 1) {
      setError("Enter your name, email, and party size.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitParticipation(campaignSlug, {
        firstName: firstName.trim(),
        email: email.trim(),
        partySize: guests,
        isFirstVisit,
        businessId: loc.businessId,
        locationId: loc.locationId,
        methodId: loc.methodId,
      });
      setReservationUrl(result.reservationUrl ?? loc.reservationUrl);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your visit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        {success ? (
          <div className="py-2 text-center">
            <CheckCircle2 className="mx-auto size-10 text-primary" />
            <DialogTitle className="mt-4 text-xl font-bold">You&apos;re counted!</DialogTitle>
            <DialogDescription className="mt-2 text-sm">
              Visit <span className="font-medium text-foreground">{loc.businessName}</span> in{" "}
              {loc.city}
              {loc.state ? `, ${loc.state}` : ""} during the campaign.
              {loc.participationHours ? ` Hours: ${loc.participationHours}.` : ""}
            </DialogDescription>
            <p className="mt-3 text-sm text-muted-foreground">
              {reservationUrl
                ? "Continue to the business booking platform to complete your reservation. ForkUp does not manage reservations."
                : "Mention the campaign when you visit, and save your receipt for giveback tracking."}
            </p>
            {reservationUrl ? (
              <a
                href={reservationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary mt-6 inline-flex w-full items-center justify-center gap-2"
              >
                Continue to {ctaLabel(loc)} <ExternalLink className="size-4" />
              </a>
            ) : (
              <button type="button" onClick={() => handleClose(false)} className="btn-primary mt-6 w-full">
                Done
              </button>
            )}
            {reservationUrl && (
              <button
                type="button"
                onClick={() => handleClose(false)}
                className="mt-3 w-full text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Done — I&apos;ll book later
              </button>
            )}
            <a
              href={`/?step=receipt-upload&campaign=${encodeURIComponent(campaignSlug)}`}
              className="mt-4 inline-flex w-full items-center justify-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              <Receipt className="size-4" />
              Already have your receipt? Upload it
            </a>
          </div>
        ) : (
          <>
            <DialogTitle className="text-xl font-bold">{ctaLabel(loc)}</DialogTitle>
            <DialogDescription>
              {loc.businessName} · {loc.locationName} · {loc.participationMethod}
              {loc.reservationUrl && (
                <span className="mt-1 block text-xs">
                  After confirming, you&apos;ll be directed to the business booking platform.
                </span>
              )}
            </DialogDescription>
            <div className="mt-5 space-y-3">
              <input
                type="text"
                placeholder="Your first name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm"
              />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm"
              />
              <input
                type="number"
                min={1}
                max={50}
                placeholder="Party size"
                value={partySize}
                onChange={(e) => setPartySize(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm"
              />
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={isFirstVisit}
                  onChange={(e) => setIsFirstVisit(e.target.checked)}
                  className="rounded border-border"
                />
                This is my first visit to this business
              </label>
            </div>
            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting}
              className="btn-primary mt-5 flex w-full items-center justify-center gap-2 disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Count me in"
              )}
            </button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Participating location card on the public campaign page.
 * When previewOnly is true (ready_to_launch), CTAs stay locked until go-live.
 */
function LocationCard({
  loc,
  campaignSlug,
  previewOnly = false,
}: {
  loc: ParticipatingLocation;
  campaignSlug: string;
  previewOnly?: boolean;
}) {
  const [participateOpen, setParticipateOpen] = useState(false);

  return (
    <li className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{loc.businessName}</p>
          <p className="text-sm text-muted-foreground">{loc.locationName}</p>
        </div>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
          {loc.givebackPercentage}% giveback
        </span>
      </div>
      <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <MapPin className="size-3.5" />
        {loc.city}
        {loc.state ? `, ${loc.state}` : ""}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{loc.participationMethod}</p>
      {loc.participationHours && (
        <p className="mt-1 text-xs text-muted-foreground">Hours: {loc.participationHours}</p>
      )}
      {previewOnly ? (
        <p className="mt-4 text-sm font-medium text-muted-foreground">
          Participation opens when the campaign goes live.
        </p>
      ) : (
        <>
          <button type="button" onClick={() => setParticipateOpen(true)} className={ctaButtonClass}>
            {ctaLabel(loc)}
            {loc.reservationUrl && <ExternalLink className="size-3.5" />}
          </button>
          <ParticipateModal
            open={participateOpen}
            onOpenChange={setParticipateOpen}
            campaignSlug={campaignSlug}
            loc={loc}
          />
        </>
      )}
    </li>
  );
}

function CampaignStory({ description }: { description: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = description.length > 480 || description.split("\n").length > 6;

  return (
    <section className="mt-10">
      <div className="relative">
        <p
          className={`whitespace-pre-line text-base leading-relaxed text-foreground/90 md:text-lg ${
            !expanded && isLong ? "max-h-[280px] overflow-hidden" : ""
          }`}
        >
          {description}
        </p>
        {!expanded && isLong && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" />
        )}
      </div>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
        >
          {expanded ? "Show less" : "Read more"}
          <ChevronDown className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      )}
    </section>
  );
}

export function PublicCampaignView({ campaign }: { campaign: CampaignDetail }) {
  const [donateOpen, setDonateOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [donationRefreshKey, setDonationRefreshKey] = useState(0);

  /** Scheduled approved campaign — show preview, block donate/participate. */
  const isPreviewNotLive = campaign.campaignStatus === "ready_to_launch";
  const showDonations = campaign.methods.some((m) => m.methodType === "virtual_donations");
  const showGuestBartending = campaign.methods.some(
    (m) => m.methodType === "guest_bartending_event",
  );
  const guestVenues = campaign.participatingLocations.filter(isGuestBartendingLocation);
  const givebackVenues = campaign.participatingLocations.filter(
    (loc) => !isGuestBartendingLocation(loc),
  );
  const showLocations = givebackVenues.length > 0;
  const showParticipateTarget = showLocations || guestVenues.length > 0;

  const { data: donationsData } = useQuery({
    queryKey: ["campaign-donations", campaign.slug, donationRefreshKey],
    queryFn: () => fetchCampaignDonations(campaign.slug),
    enabled: showDonations && !isPreviewNotLive,
    staleTime: 30_000,
  });

  const { data: galleryData } = useQuery({
    queryKey: ["campaign-images", campaign.slug],
    queryFn: () => fetchCampaignImages(campaign.slug),
    staleTime: 60_000,
  });

  const imagePlaceholder = resolveCampaignImage(null);

  /**
   * Resolve every gallery / cover URL so /uploads/… targets the API host
   * (not Amplify), and known seed filenames map to bundled assets.
   */
  const galleryUrls = (() => {
    const fromApi = (galleryData?.images ?? [])
      .map((i) => resolveCampaignImage(i.imageUrl))
      .filter(Boolean);
    if (fromApi.length > 0) return fromApi;
    return [resolveCampaignImage(campaign.image)];
  })();

  const scrollToLocations = () => {
    const targetId = showLocations ? "locations" : showGuestBartending ? "guest-bartending" : "locations";
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({
          title: campaign.name,
          text: `Support ${campaign.nonprofit} — ${campaign.name}`,
          url,
        });
        return;
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this campaign link:", url);
    }
  };

  const panelProps = {
    raised: campaign.raised,
    goal: campaign.goal,
    supportersGoing: campaign.supportersGoing,
    participatingLocationCount: campaign.participatingLocationCount,
    donationCount: donationsData?.totalCount,
    showDonate: showDonations && !isPreviewNotLive,
    showLocations: showParticipateTarget && !isPreviewNotLive,
    copied,
    onDonate: () => setDonateOpen(true),
    onShare: () => void handleShare(),
    onParticipate: scrollToLocations,
  };

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-12">
      <SiteHeader
        trailing={
          <>
            <span className="hidden text-sm font-semibold text-foreground sm:inline">Campaign</span>
            <HeaderPillLink href="/?step=campaign-directory">
              <ArrowLeft className="size-3.5" />
              Back to campaigns
            </HeaderPillLink>
            <HeaderPillLink href="/">
              <ArrowLeft className="size-3.5" />
              Back to home
            </HeaderPillLink>
          </>
        }
      />

      {isPreviewNotLive && (
        <div className="border-b border-amber-300/60 bg-amber-50/95 px-4 py-3 text-center text-sm font-semibold text-amber-900">
          This campaign is not live yet.
          {campaign.dateRange ? ` It is scheduled for ${campaign.dateRange}.` : ""} You can
          preview the page below.
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:py-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_380px]">
          {/* Main column — GoFundMe-style content flow */}
          <div className="min-w-0">
            <PublicCampaignImageSlider
              urls={galleryUrls}
              alt={campaign.name}
              placeholderSrc={imagePlaceholder}
            />

            <h1 className="font-display mt-6 text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl md:text-4xl">
              {campaign.name}
            </h1>

            <div className="mt-5 flex items-center gap-3">
              <OrganizationAvatar
                organizationName={campaign.nonprofit}
                className="size-11 rounded-full"
              />
              <div>
                <p className="text-sm text-foreground">
                  <span className="font-semibold">{campaign.nonprofit}</span> is organizing
                </p>
                {campaign.nonprofitVerified && (
                  <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-primary">
                    <BadgeCheck className="size-3.5" />
                    Verified nonprofit
                  </p>
                )}
              </div>
            </div>

            {/* Mobile fundraising summary */}
            <div className="mt-6 lg:hidden">
              <PublicCampaignFundraisingPanel {...panelProps} compact />
            </div>

            <CampaignStory description={campaign.description} />

            {!isPreviewNotLive && (
              <PublicCampaignLeaderboard
                slug={campaign.slug}
                refreshKey={donationRefreshKey}
              />
            )}

            {showDonations && !isPreviewNotLive && (
              <section className="mt-10">
                <PublicCampaignDonationsFeed
                  slug={campaign.slug}
                  refreshKey={donationRefreshKey}
                  data={donationsData}
                />
              </section>
            )}

            {showGuestBartending && (
              <PublicCampaignGuestBartendingSection
                eventDate={campaign.eventDate}
                nonprofitName={campaign.nonprofit}
                hasVenues={guestVenues.length > 0}
              >
                {guestVenues.map((loc) => (
                  <LocationCard
                    key={`gb-${loc.businessId}-${loc.locationId}-${loc.methodId}`}
                    loc={loc}
                    campaignSlug={campaign.slug}
                    previewOnly={isPreviewNotLive}
                  />
                ))}
              </PublicCampaignGuestBartendingSection>
            )}

            {showLocations && (
              <section id="locations" className="mt-10 scroll-mt-24">
                <h2 className="text-xl font-bold">Participating businesses</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Visit these locations during the campaign window. A portion of eligible sales
                  supports {campaign.nonprofit}.
                </p>
                <ul className="mt-6 space-y-4">
                  {givebackVenues.map((loc) => (
                    <LocationCard
                      key={`${loc.businessId}-${loc.locationId}-${loc.methodId}`}
                      loc={loc}
                      campaignSlug={campaign.slug}
                      previewOnly={isPreviewNotLive}
                    />
                  ))}
                </ul>
              </section>
            )}

            {campaign.methods.length > 0 && (
              <section className="mt-10 border-t border-border pt-8">
                <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                  <li className="inline-flex items-center gap-1.5">
                    <Calendar className="size-4" />
                    {campaign.dateRange}
                  </li>
                  {campaign.methods.map((m) => (
                    <li
                      key={m.id}
                      className="rounded-full border border-border bg-secondary/40 px-3 py-1 text-xs font-medium text-foreground"
                    >
                      {m.methodName}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {/* Sticky sidebar — desktop */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-6">
              <PublicCampaignFundraisingPanel {...panelProps} />

              <div className="rounded-2xl border border-border bg-card p-5">
                <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  Organizer
                </h3>
                <div className="mt-4 flex items-center gap-3">
                  <OrganizationAvatar
                    organizationName={campaign.nonprofit}
                    className="size-12 rounded-full"
                  />
                  <div>
                    <p className="font-semibold">{campaign.nonprofit}</p>
                    <p className="text-sm text-muted-foreground">Nonprofit organizer</p>
                  </div>
                </div>
                <p className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Calendar className="size-4" />
                  {campaign.dateRange}
                </p>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Mobile sticky donate bar — GoFundMe pattern (hidden in not-yet-live preview) */}
      {!isPreviewNotLive && (showDonations || showParticipateTarget) && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 p-4 backdrop-blur-md lg:hidden">
          <div className="mx-auto flex max-w-lg gap-2">
            {showDonations && (
              <button
                type="button"
                onClick={() => setDonateOpen(true)}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-bold text-primary-foreground"
              >
                <Heart className="size-4" />
                Donate
              </button>
            )}
            {showParticipateTarget && !showDonations && (
              <button
                type="button"
                onClick={scrollToLocations}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-bold text-primary-foreground"
              >
                <MapPin className="size-4" />
                Participate
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleShare()}
              className="inline-flex items-center justify-center rounded-full border border-border px-4 py-3 text-sm font-semibold"
            >
              {copied ? <CheckCircle2 className="size-4 text-primary" /> : "Share"}
            </button>
          </div>
        </div>
      )}

      {!isPreviewNotLive && (
        <DonationModal
          open={donateOpen}
          onOpenChange={(open) => {
            setDonateOpen(open);
            if (!open) setDonationRefreshKey((k) => k + 1);
          }}
          campaignSlug={campaign.slug}
          nonprofitName={campaign.nonprofit}
        />
      )}
    </div>
  );
}
