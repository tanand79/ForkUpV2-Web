"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Heart,
  Loader2,
  MapPin,
  Share2,
  Store,
  Users,
} from "lucide-react";
import { formatCurrency } from "@/data/campaigns";
import { resolveCampaignImage } from "@/lib/campaign-images";
import type { CampaignDetail, ParticipatingLocation } from "@/lib/campaign-types";
import { submitParticipation } from "@/lib/api";
import { DonationModal } from "@/components/campaign/DonationModal";
import { HeaderPillLink, SiteHeader } from "@/components/campaign/SiteHeader";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

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

function LocationCard({ loc, campaignSlug }: { loc: ParticipatingLocation; campaignSlug: string }) {
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
    </li>
  );
}

export function PublicCampaignView({ campaign }: { campaign: CampaignDetail }) {
  const [donateOpen, setDonateOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const showDonations = campaign.methods.some((m) => m.methodType === "virtual_donations");
  const showLocations = campaign.participatingLocations.length > 0;

  const scrollToLocations = () => {
    document.getElementById("locations")?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  const pct =
    campaign.goal > 0 ? Math.min(100, Math.round((campaign.raised / campaign.goal) * 100)) : 0;

  return (
    <div className="min-h-screen bg-background">
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

      <section className="relative border-b border-border bg-muted">
        <div className="relative mx-auto w-full">
          <img
            src={resolveCampaignImage(campaign.image)}
            alt={campaign.name}
            className="mx-auto block w-full max-h-[min(520px,70vh)] object-contain object-center"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/85 via-foreground/45 to-transparent pt-20 sm:pt-28">
            <div className="mx-auto max-w-3xl px-5 pb-8 text-background">
              <p className="text-xs font-medium uppercase tracking-wider text-background/80">
                {campaign.nonprofit}
                {campaign.nonprofitVerified && " · Verified"}
              </p>
              <h1 className="font-display mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
                {campaign.name}
              </h1>
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-background/90">
                <Calendar className="size-4" />
                {campaign.dateRange}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-5 py-10">
        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="font-display text-3xl font-semibold text-primary">
            {formatCurrency(campaign.raised)}
          </p>
          <p className="text-sm text-muted-foreground">
            raised{campaign.goal > 0 ? ` of ${formatCurrency(campaign.goal)} goal` : ""}
          </p>
          {campaign.goal > 0 && (
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-4" />
              {campaign.supportersGoing} supporters going
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Store className="size-4" />
              {campaign.participatingLocationCount} locations
            </span>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            {showDonations && (
              <button
                type="button"
                onClick={() => setDonateOpen(true)}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                <Heart className="size-4" />
                Donate
              </button>
            )}
            {showLocations && (
              <button
                type="button"
                onClick={scrollToLocations}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-secondary/60"
              >
                <MapPin className="size-4" />
                Where to participate
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleShare()}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-secondary/60"
            >
              {copied ? <CheckCircle2 className="size-4 text-primary" /> : <Share2 className="size-4" />}
              {copied ? "Link copied" : "Share"}
            </button>
          </div>
        </div>

        <section className="mt-10">
          <h2 className="text-xl font-bold">About this campaign</h2>
          <p className="mt-3 whitespace-pre-line text-lg leading-relaxed text-foreground/90">
            {campaign.description}
          </p>
        </section>

        {showLocations && (
          <section id="locations" className="mt-10 scroll-mt-20">
            <h2 className="text-xl font-bold">Participating businesses</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Visit these locations during the campaign window. A portion of eligible sales supports{" "}
              {campaign.nonprofit}.
            </p>
            <ul className="mt-6 space-y-4">
              {campaign.participatingLocations.map((loc) => (
                <LocationCard
                  key={`${loc.businessId}-${loc.locationId}-${loc.methodId}`}
                  loc={loc}
                  campaignSlug={campaign.slug}
                />
              ))}
            </ul>
          </section>
        )}

        {campaign.methods.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-bold">Fundraising methods</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {campaign.methods.map((m) => (
                <li
                  key={m.id}
                  className="rounded-full border border-border bg-secondary/50 px-3 py-1 text-sm font-medium"
                >
                  {m.methodName}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <DonationModal
        open={donateOpen}
        onOpenChange={setDonateOpen}
        campaignSlug={campaign.slug}
        nonprofitName={campaign.nonprofit}
      />
    </div>
  );
}
