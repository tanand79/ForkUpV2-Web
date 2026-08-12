"use client";

/**
 * Public live campaign — "Choose where to participate" carousel.
 * Layout matches Ui LocationsSection; data from ParticipatingLocation + submitParticipation.
 */

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Heart,
  Loader2,
  MapPin,
  Receipt,
  Scissors,
  ShoppingBag,
  Sparkles,
  Users,
  Utensils,
} from "lucide-react";
import { assetSrc } from "@/lib/utils";
import { submitParticipation } from "@/lib/api";
import type { ParticipatingLocation } from "@/lib/campaign-types";
import { ScrollReveal } from "@/components/ScrollReveal";
import forkupLogo from "@/assets/forkup-logo-header.png";
import bizFallback from "@/assets/biz-restaurant.jpg";
import coffeeImg from "@/assets/campaign-coffee.jpg";
import marketImg from "@/assets/campaign-market.jpg";

type BusinessType = "dine" | "shop" | "service" | "event" | "other";

const TYPE_CONFIG: Record<
  BusinessType,
  { label: string; icon: typeof Utensils; emoji: string; ctaCollapsed: string; image: string }
> = {
  dine: {
    label: "Dine",
    icon: Utensils,
    emoji: "🍽",
    ctaCollapsed: "Reserve Your Table",
    image: assetSrc(bizFallback),
  },
  shop: {
    label: "Shop",
    icon: ShoppingBag,
    emoji: "🛍",
    ctaCollapsed: "Visit Store",
    image: assetSrc(marketImg),
  },
  service: {
    label: "Service",
    icon: Scissors,
    emoji: "💇",
    ctaCollapsed: "Book Appointment",
    image: assetSrc(coffeeImg),
  },
  event: {
    label: "Event",
    icon: Users,
    emoji: "🎉",
    ctaCollapsed: "Attend Event",
    image: assetSrc(bizFallback),
  },
  other: {
    label: "Participate",
    icon: MapPin,
    emoji: "📍",
    ctaCollapsed: "Participate",
    image: assetSrc(bizFallback),
  },
};

const PARTY_SIZES = [1, 2, 3, 4, "5+"] as const;

const STORAGE_KEY = "forkup_participant";

interface Participant {
  firstName: string;
  email: string;
  partySize: number | string;
  returning: boolean;
}

interface ConfirmedParticipation extends Participant {
  reservationUrl: string | null;
}

const CAPTURE_COPY = {
  header: "Let us know you're supporting this campaign",
  subtext:
    "This helps ForkUp track participation and show participating businesses the community support they helped create.",
  takes: "It only takes a few seconds.",
  cta: "Continue to Reservation",
  helper:
    "You'll be redirected to complete your reservation or booking directly with the business.",
};

const inputClassName =
  "w-full h-12 px-4 rounded-xl bg-secondary/60 border border-border focus:bg-card focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-base placeholder:text-muted-foreground transition-all";

function locKey(loc: ParticipatingLocation): string {
  return `${loc.businessId}-${loc.locationId}-${loc.methodId}`;
}

function businessTypeFromLoc(loc: ParticipatingLocation): BusinessType {
  if (loc.cta === "reserve" || loc.cta === "visit") return "dine";
  if (loc.cta === "shop") return "shop";
  if (loc.cta === "book") return "service";
  if (loc.cta === "attend") return "event";
  const t = (loc.businessType || "").toLowerCase();
  if (t.includes("restaurant") || t.includes("dine") || t.includes("food") || t.includes("cafe")) {
    return "dine";
  }
  if (t.includes("shop") || t.includes("retail") || t.includes("boutique")) return "shop";
  if (t.includes("salon") || t.includes("spa") || t.includes("service")) return "service";
  return "other";
}

function actionLine(type: BusinessType): string {
  if (type === "dine") return "Dine In or Takeout";
  if (type === "shop") return "Shop In Store";
  if (type === "service") return "Book an Appointment";
  if (type === "event") return "Attend Event";
  return "Participate";
}

function givebackScope(type: BusinessType): string {
  if (type === "dine") return "dine-in and takeout";
  if (type === "shop") return "all purchases";
  if (type === "service") return "booked services";
  return "your visit";
}

function CaptureForm({
  businessName,
  fieldIdPrefix,
  onComplete,
}: {
  businessName: string;
  fieldIdPrefix: string;
  onComplete: (p: Participant) => Promise<void>;
}) {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [partySize, setPartySize] = useState<number | string | null>(null);
  const [returning, setReturning] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const trimmedName = firstName.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) return setError("Please enter your first name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return setError("Please enter a valid email address.");
    }
    if (trimmedName.length > 50 || trimmedEmail.length > 100) return setError("Input too long.");
    if (partySize === null) return setError("Please select your party size.");
    if (returning === null) return setError("Please let us know if this is your first visit.");

    setError(null);
    setSubmitting(true);
    try {
      const participant: Participant = {
        firstName: trimmedName,
        email: trimmedEmail,
        partySize,
        returning,
      };
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(participant));
      } catch {
        /* ignore */
      }
      await onComplete(participant);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your visit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-5" onClick={(e) => e.stopPropagation()}>
      <div className="text-center space-y-1.5">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary mb-1">
          <Heart size={18} />
        </div>
        <h4 className="font-serif text-xl text-foreground leading-tight text-balance">
          {CAPTURE_COPY.header}
        </h4>
        <p className="text-sm text-muted-foreground text-pretty">{CAPTURE_COPY.subtext}</p>
        <p className="text-xs text-muted-foreground/70">{CAPTURE_COPY.takes}</p>
      </div>

      <div className="space-y-3">
        <div>
          <label htmlFor={`${fieldIdPrefix}-first-name`} className="sr-only">
            First name
          </label>
          <input
            id={`${fieldIdPrefix}-first-name`}
            type="text"
            autoComplete="given-name"
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            maxLength={50}
            className={inputClassName}
          />
        </div>
        <div>
          <label htmlFor={`${fieldIdPrefix}-email`} className="sr-only">
            Email address
          </label>
          <input
            id={`${fieldIdPrefix}-email`}
            type="email"
            autoComplete="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={100}
            className={inputClassName}
          />
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-foreground mb-3">Party size</p>
        <div className="flex gap-2">
          {PARTY_SIZES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setPartySize(s)}
              className={`w-11 h-11 rounded-xl text-sm font-medium transition-all duration-200 active:scale-95 ${
                partySize === s
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary text-secondary-foreground hover:bg-warm-sand"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-foreground mb-3">
          Is this your first visit to {businessName}?
        </p>
        <div className="flex gap-2">
          {[
            { label: "First Time", value: false },
            { label: "Returning Guest", value: true },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => setReturning(opt.value)}
              className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 active:scale-95 ${
                returning === opt.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary text-secondary-foreground hover:bg-warm-sand"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-destructive text-center">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full btn-primary text-base py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {submitting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Saving…
          </>
        ) : (
          CAPTURE_COPY.cta
        )}
      </button>

      <p className="text-[11px] text-muted-foreground/70 text-center">{CAPTURE_COPY.helper}</p>
    </form>
  );
}

function ReusePrompt({
  participant,
  nonprofitName,
  onContinue,
  onUseDifferent,
  continuing,
}: {
  participant: Participant;
  nonprofitName: string;
  onContinue: () => void;
  onUseDifferent: () => void;
  continuing: boolean;
}) {
  return (
    <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
      <div className="text-center space-y-1.5">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary mb-1">
          <Heart size={18} />
        </div>
        <h4 className="font-serif text-xl text-foreground leading-tight text-balance">
          Continue supporting {nonprofitName}
        </h4>
        <p className="text-sm text-muted-foreground text-pretty">
          You already entered your details for another participating business. Reuse them for this
          visit?
        </p>
      </div>
      <div className="space-y-2.5">
        <button
          type="button"
          onClick={onContinue}
          disabled={continuing}
          className="w-full btn-primary text-base py-4 rounded-2xl text-left px-5 disabled:opacity-60"
        >
          <span className="block font-semibold">
            {continuing ? "Saving…" : `Continue as ${participant.firstName}`}
          </span>
          <span className="block text-xs font-normal opacity-80 truncate">{participant.email}</span>
        </button>
        <button
          type="button"
          onClick={onUseDifferent}
          disabled={continuing}
          className="w-full bg-secondary hover:bg-warm-sand text-foreground text-sm font-medium py-3 rounded-xl transition-colors"
        >
          Use different details
        </button>
      </div>
    </div>
  );
}

function LocationCard({
  loc,
  isExpanded,
  participation,
  defaultParticipant,
  liveSupporterCount,
  isMostPopular,
  nonprofitName,
  campaignSlug,
  previewOnly,
  onToggle,
  onConfirmParticipation,
}: {
  loc: ParticipatingLocation;
  isExpanded: boolean;
  participation: ConfirmedParticipation | null;
  defaultParticipant: Participant | null;
  liveSupporterCount: number;
  isMostPopular: boolean;
  nonprofitName: string;
  campaignSlug: string;
  previewOnly: boolean;
  onToggle: () => void;
  onConfirmParticipation: (key: string, p: Participant) => Promise<ConfirmedParticipation>;
}) {
  const type = businessTypeFromLoc(loc);
  const config = TYPE_CONFIG[type];
  const key = locKey(loc);
  const [forceFreshForm, setForceFreshForm] = useState(false);
  const [reuseSubmitting, setReuseSubmitting] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);

  const cityLine = [loc.city, loc.state].filter(Boolean).join(", ");

  const handleCapture = async (p: Participant) => {
    setForceFreshForm(false);
    setCardError(null);
    await onConfirmParticipation(key, p);
  };

  const handleContinueAs = async () => {
    if (!defaultParticipant) return;
    setReuseSubmitting(true);
    setCardError(null);
    try {
      await onConfirmParticipation(key, defaultParticipant);
    } catch (err) {
      setCardError(err instanceof Error ? err.message : "Could not save your visit");
    } finally {
      setReuseSubmitting(false);
    }
  };

  const showConfirmed = !!participation;
  const showReusePrompt = !showConfirmed && !!defaultParticipant && !forceFreshForm && !previewOnly;
  const showCaptureForm = !showConfirmed && !previewOnly && (!defaultParticipant || forceFreshForm);

  return (
    <div
      className={`card-warm overflow-hidden transition-all duration-300 ${
        isExpanded ? "ring-2 ring-primary/30 shadow-lg shadow-primary/[0.08]" : ""
      }`}
    >
      <div className="cursor-pointer" onClick={onToggle}>
        <div className="relative">
          <img
            src={config.image}
            alt={loc.businessName}
            className={`w-full object-cover transition-all duration-500 ${
              isExpanded ? "h-56 sm:h-64" : "h-44 sm:h-48"
            }`}
          />
          <div className="absolute top-3 right-3 flex items-center gap-1.5">
            {isMostPopular && (
              <span className="bg-primary text-primary-foreground text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1">
                <Sparkles size={11} /> Most popular
              </span>
            )}
            <span className="bg-card/90 backdrop-blur-sm text-foreground text-xs font-semibold px-3 py-1.5 rounded-full shadow-sm">
              {config.emoji} {config.label}
            </span>
          </div>
          <img
            src={assetSrc(forkupLogo)}
            alt="ForkUp"
            className="absolute bottom-3 left-3 h-7 opacity-70"
          />
        </div>

        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between mb-1">
            <h3 className="font-serif text-xl sm:text-2xl text-foreground leading-tight">
              {loc.businessName}
            </h3>
            <ChevronDown
              size={20}
              className={`text-muted-foreground mt-1 flex-shrink-0 transition-transform duration-300 ${
                isExpanded ? "rotate-180" : ""
              }`}
            />
          </div>

          {cityLine ? (
            <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1.5">
              <MapPin size={13} className="flex-shrink-0" /> {cityLine}
            </p>
          ) : null}

          <p className="text-sm text-foreground mb-3 flex items-center gap-1.5 tabular-nums">
            <Users size={13} className="flex-shrink-0 text-primary" />
            <span className="font-semibold">{liveSupporterCount}</span>
            <span className="text-muted-foreground">Supporters Going</span>
          </p>

          <p className="text-sm font-semibold text-foreground mb-1.5">{actionLine(type)}</p>

          <p className="text-xs text-muted-foreground">
            {loc.givebackPercentage}% of {givebackScope(type)} will be donated
          </p>

          {!isExpanded && !previewOnly && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              className="mt-4 w-full btn-primary py-3.5 text-sm rounded-xl"
            >
              {config.ctaCollapsed}
            </button>
          )}

          {!isExpanded && previewOnly && (
            <p className="mt-4 text-sm font-medium text-muted-foreground">
              Participation opens when the campaign goes live.
            </p>
          )}
        </div>
      </div>

      <div
        className={`overflow-hidden transition-all duration-500 ease-out ${
          isExpanded ? "max-h-[900px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-5 sm:px-6 pb-6 space-y-5">
          <div className="h-px bg-border" />

          {previewOnly && (
            <p className="text-sm font-medium text-muted-foreground">
              Participation opens when the campaign goes live.
            </p>
          )}

          {showCaptureForm && (
            <CaptureForm
              businessName={loc.businessName}
              fieldIdPrefix={key}
              onComplete={handleCapture}
            />
          )}

          {showReusePrompt && defaultParticipant && (
            <ReusePrompt
              participant={defaultParticipant}
              nonprofitName={nonprofitName}
              onContinue={() => void handleContinueAs()}
              onUseDifferent={() => setForceFreshForm(true)}
              continuing={reuseSubmitting}
            />
          )}

          {cardError && <p className="text-xs text-destructive text-center">{cardError}</p>}

          {showConfirmed && participation && (
            <>
              <p className="text-sm text-foreground">
                Welcome, <span className="font-semibold">{participation.firstName}</span>
              </p>

              {cityLine ? (
                <p className="text-sm text-muted-foreground flex items-start gap-2">
                  <MapPin size={14} className="mt-0.5 flex-shrink-0 text-primary" />
                  {loc.locationName}
                  {cityLine ? ` · ${cityLine}` : ""}
                </p>
              ) : null}

              <div className="bg-secondary/60 rounded-xl p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  How your visit gives back
                </p>
                <p className="text-sm text-foreground">
                  {loc.givebackPercentage}% of your{" "}
                  {type === "dine"
                    ? "dine-in or takeout order"
                    : type === "shop"
                      ? "purchase"
                      : type === "service"
                        ? "appointment"
                        : "visit"}{" "}
                  at {loc.businessName} will be donated to support {nonprofitName}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 font-medium text-secondary-foreground">
                  <Users size={12} /> Party of {participation.partySize}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 font-medium text-secondary-foreground">
                  {participation.returning ? "Returning guest" : "First visit"}
                </span>
              </div>

              {participation.reservationUrl ? (
                <a
                  href={participation.reservationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full btn-primary text-base py-4 rounded-2xl flex items-center justify-center gap-3 no-underline"
                >
                  <span className="font-semibold">Continue to Reservation</span>
                  <ExternalLink size={16} />
                </a>
              ) : (
                <p className="text-sm text-muted-foreground text-center">
                  Mention the campaign when you visit, and save your receipt for giveback tracking.
                </p>
              )}

              <a
                href={`/?step=receipt-upload&campaign=${encodeURIComponent(campaignSlug)}`}
                className="inline-flex w-full items-center justify-center gap-1.5 text-sm font-semibold text-primary hover:underline"
              >
                <Receipt className="size-4" />
                Already have your receipt? Upload it
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function PublicCampaignLocationsSection({
  id = "locations",
  locations,
  nonprofitName,
  campaignSlug,
  supportersGoing,
  previewOnly = false,
}: {
  id?: string;
  locations: ParticipatingLocation[];
  nonprofitName: string;
  campaignSlug: string;
  supportersGoing: number;
  previewOnly?: boolean;
}) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [participations, setParticipations] = useState<Record<string, ConfirmedParticipation>>({});
  const [lastParticipant, setLastParticipant] = useState<Participant | null>(null);
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    loop: false,
    skipSnaps: false,
    containScroll: "trimSnaps",
  });

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) setLastParticipant(JSON.parse(raw) as Participant);
    } catch {
      /* ignore */
    }
  }, []);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  const toggle = (key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key));
  };

  const handleConfirmParticipation = async (key: string, p: Participant) => {
    const loc = locations.find((l) => locKey(l) === key);
    if (!loc) throw new Error("Location not found");

    const guests = p.partySize === "5+" ? 5 : Number(p.partySize);
    const result = await submitParticipation(campaignSlug, {
      firstName: p.firstName,
      email: p.email,
      partySize: guests,
      isFirstVisit: !p.returning,
      businessId: loc.businessId,
      locationId: loc.locationId,
      methodId: loc.methodId,
    });

    const confirmed: ConfirmedParticipation = {
      ...p,
      reservationUrl: result.reservationUrl ?? loc.reservationUrl,
    };
    setParticipations((prev) => ({ ...prev, [key]: confirmed }));
    setLastParticipant(p);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    } catch {
      /* ignore */
    }
    return confirmed;
  };

  const baseline = Math.max(0, supportersGoing);
  const liveCounts = locations.reduce<Record<string, number>>((acc, loc) => {
    const key = locKey(loc);
    acc[key] = baseline + (participations[key] ? 1 : 0);
    return acc;
  }, {});

  const mostPopularKey =
    locations.length > 0
      ? locations.reduce((top, loc) => {
          const key = locKey(loc);
          return liveCounts[key] > liveCounts[top] ? key : top;
        }, locKey(locations[0]))
      : "";

  const percentHint =
    locations.length > 0
      ? (() => {
          const percents = locations.map((l) => l.givebackPercentage);
          const min = Math.min(...percents);
          const max = Math.max(...percents);
          return min === max ? `${min}%` : `${min}%–${max}%`;
        })()
      : "10%–20%";

  if (locations.length === 0) return null;

  return (
    <section id={id} className="mt-4 scroll-mt-24 pt-2 pb-4 md:mt-6 md:pb-6">
      <div className="px-0">
        <ScrollReveal>
          <p className="text-center text-sm sm:text-base text-foreground font-medium mb-1 text-pretty max-w-2xl mx-auto">
            Just show up — a portion of your purchase will be donated to this cause.
          </p>
          <p className="text-center text-sm text-muted-foreground mb-3 text-pretty">
            No extra cost — just support a local business.
          </p>
          <h2 className="font-serif text-2xl sm:text-3xl text-center text-foreground mb-2 text-balance leading-[1.15]">
            Choose where to participate
          </h2>
          <p className="text-center text-xs text-muted-foreground/70 mb-5">
            Participating businesses are donating {percentHint} of your visit to {nonprofitName}
          </p>
        </ScrollReveal>
      </div>

      <div className="relative max-w-6xl mx-auto">
        <button
          type="button"
          onClick={scrollPrev}
          className="absolute -left-1 sm:left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-card shadow-md border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:shadow-lg transition-all duration-200 active:scale-95"
          aria-label="Previous location"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          onClick={scrollNext}
          className="absolute -right-1 sm:right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-card shadow-md border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:shadow-lg transition-all duration-200 active:scale-95"
          aria-label="Next location"
        >
          <ChevronRight size={18} />
        </button>

        <div ref={emblaRef} className="overflow-hidden mx-6 sm:mx-12">
          <div className="flex gap-5">
            {locations.map((loc, i) => {
              const key = locKey(loc);
              return (
                <div
                  key={key}
                  className="flex-[0_0_85%] sm:flex-[0_0_48%] lg:flex-[0_0_32%] min-w-0"
                >
                  <ScrollReveal delay={i * 80}>
                    <LocationCard
                      loc={loc}
                      isExpanded={expandedKey === key}
                      participation={participations[key] ?? null}
                      defaultParticipant={lastParticipant}
                      liveSupporterCount={liveCounts[key]}
                      isMostPopular={key === mostPopularKey}
                      nonprofitName={nonprofitName}
                      campaignSlug={campaignSlug}
                      previewOnly={previewOnly}
                      onToggle={() => toggle(key)}
                      onConfirmParticipation={handleConfirmParticipation}
                    />
                  </ScrollReveal>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
