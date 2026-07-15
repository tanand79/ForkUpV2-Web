import { useState, useCallback, useEffect } from "react";
import { assetSrc } from "@/lib/utils";
import { ChevronDown, MapPin, Users, Utensils, ShoppingBag, Scissors, ChevronLeft, ChevronRight, Heart, Sparkles } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import { ScrollReveal } from "@/components/ScrollReveal";
import { useCampaign } from "@/lib/campaign-context";
import { getNonprofitName, getPublicLocations } from "@/lib/campaign-display";
import forkupLogo from "@/assets/forkup-logo.png";

type BusinessType = "dine" | "shop" | "service" | "event" | "other";

interface Location {
  id: number;
  name: string;
  image: string;
  city: string;
  address: string;
  type: BusinessType;
  description: string;
  actionLine: string;
  donationPercent: number;
  supporterCount: number;
  booking: {
    platform: "resy" | "opentable" | "walkin" | "store" | "appointment";
    label: string;
    url: string | null;
  };
}

const TYPE_CONFIG: Record<BusinessType, { label: string; icon: typeof Utensils; emoji: string; ctaCollapsed: string }> = {
  dine: { label: "Dine", icon: Utensils, emoji: "🍽", ctaCollapsed: "Reserve Your Table" },
  shop: { label: "Shop", icon: ShoppingBag, emoji: "🛍", ctaCollapsed: "Visit Store" },
  service: { label: "Service", icon: Scissors, emoji: "💇", ctaCollapsed: "Book Appointment" },
  event: { label: "Event", icon: Users, emoji: "🎉", ctaCollapsed: "Attend Event" },
  other: { label: "Participate", icon: MapPin, emoji: "📍", ctaCollapsed: "Participate" },
};

const PARTY_SIZES = [1, 2, 3, 4, "5+"] as const;

const BookingButton = ({ booking }: { booking: Location["booking"] }) => {
  const isPlatform = booking.platform === "resy" || booking.platform === "opentable";

  if (!isPlatform) {
    return (
      <button className="w-full btn-primary text-base py-4 rounded-2xl flex items-center justify-center gap-3">
        {booking.label}
      </button>
    );
  }

  return (
    <a
      href={booking.url || "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="w-full btn-primary text-base py-4 rounded-2xl flex items-center justify-center gap-3 no-underline"
    >
      <span className="font-semibold">Book Now</span>
      <span className="text-primary-foreground/40">|</span>
      <span className="font-bold tracking-wide uppercase text-sm">
        {booking.platform === "resy" ? "RESY" : "OpenTable"}
      </span>
    </a>
  );
};

const STORAGE_KEY = "forkup_participant";

interface Participant {
  firstName: string;
  email: string;
  partySize: number | string;
  returning: boolean;
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

const CaptureForm = ({
  onComplete,
  businessName,
}: {
  onComplete: (p: Participant) => void;
  businessName: string;
}) => {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [partySize, setPartySize] = useState<number | string | null>(null);
  const [returning, setReturning] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const trimmedName = firstName.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) return setError("Please enter your first name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) return setError("Please enter a valid email address.");
    if (trimmedName.length > 50 || trimmedEmail.length > 100) return setError("Input too long.");
    if (partySize === null) return setError("Please select your party size.");
    if (returning === null) return setError("Please let us know if this is your first visit.");
    setError(null);
    const participant: Participant = {
      firstName: trimmedName,
      email: trimmedEmail,
      partySize,
      returning,
    };
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(participant));
    } catch {}
    if (typeof onComplete === "function") {
      onComplete(participant);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5" onClick={(e) => e.stopPropagation()}>
      <div className="text-center space-y-1.5">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary mb-1">
          <Heart size={18} />
        </div>
        <h4 className="font-serif text-xl text-foreground leading-tight text-balance">
          {CAPTURE_COPY.header}
        </h4>
        <p className="text-sm text-muted-foreground text-pretty">
          {CAPTURE_COPY.subtext}
        </p>
        <p className="text-xs text-muted-foreground/70">
          {CAPTURE_COPY.takes}
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label htmlFor="capture-first-name" className="sr-only">First name</label>
          <input
            id="capture-first-name"
            type="text"
            autoComplete="given-name"
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            maxLength={50}
            className="w-full h-12 px-4 rounded-xl bg-secondary/60 border border-border focus:bg-card focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-base placeholder:text-muted-foreground transition-all"
          />
        </div>
        <div>
          <label htmlFor="capture-email" className="sr-only">Email address</label>
          <input
            id="capture-email"
            type="email"
            autoComplete="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={100}
            className="w-full h-12 px-4 rounded-xl bg-secondary/60 border border-border focus:bg-card focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-base placeholder:text-muted-foreground transition-all"
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
              className={`w-11 h-11 rounded-xl text-sm font-medium transition-all duration-200 active:scale-95
                ${partySize === s
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
              className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 active:scale-95
                ${returning === opt.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary text-secondary-foreground hover:bg-warm-sand"
                }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-xs text-destructive text-center">{error}</p>
      )}

      <button type="submit" className="w-full btn-primary text-base py-4 rounded-2xl">
        {CAPTURE_COPY.cta}
      </button>

      <p className="text-[11px] text-muted-foreground/70 text-center">
        {CAPTURE_COPY.helper}
      </p>
    </form>
  );
};

interface ReuseCopyConfig {
  header: string;
  subtext: string;
}

const makeReuseCopy = (nonprofitName: string): Record<BusinessType, ReuseCopyConfig> => ({
  dine: {
    header: `Continue supporting ${nonprofitName}`,
    subtext: "You already entered your details for another participating business. Reuse them for this reservation?",
  },
  shop: {
    header: `Continue supporting ${nonprofitName}`,
    subtext: "You already entered your details for another participating business. Reuse them for this visit?",
  },
  service: {
    header: `Continue supporting ${nonprofitName}`,
    subtext: "You already entered your details for another participating business. Reuse them for this appointment?",
  },
  event: {
    header: `Continue supporting ${nonprofitName}`,
    subtext: "You already entered your details for another participating business. Reuse them for this event?",
  },
  other: {
    header: `Continue supporting ${nonprofitName}`,
    subtext: "You already entered your details for another participating business. Reuse them here?",
  },
});

const ReusePrompt = ({
  participant,
  businessType,
  nonprofitName,
  onContinue,
  onUseDifferent,
}: {
  participant: Participant;
  businessType: BusinessType;
  nonprofitName: string;
  onContinue: () => void;
  onUseDifferent: () => void;
}) => {
  const copy = makeReuseCopy(nonprofitName)[businessType];
  return (
    <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
      <div className="text-center space-y-1.5">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary mb-1">
          <Heart size={18} />
        </div>
        <h4 className="font-serif text-xl text-foreground leading-tight text-balance">
          {copy.header}
        </h4>
        <p className="text-sm text-muted-foreground text-pretty">
          {copy.subtext}
        </p>
      </div>
      <div className="space-y-2.5">
        <button
          onClick={onContinue}
          className="w-full btn-primary text-base py-4 rounded-2xl text-left px-5"
        >
          <span className="block font-semibold">Continue as {participant.firstName}</span>
          <span className="block text-xs font-normal opacity-80 truncate">{participant.email}</span>
        </button>
        <button
          onClick={onUseDifferent}
          className="w-full bg-secondary hover:bg-warm-sand text-foreground text-sm font-medium py-3 rounded-xl transition-colors"
        >
          Use different details
        </button>
      </div>
    </div>
  );
};

const LocationCard = ({
  loc,
  isExpanded,
  participation,
  defaultParticipant,
  liveSupporterCount,
  isMostPopular,
  nonprofitName,
  onToggle,
  onConfirmParticipation,
}: {
  loc: Location;
  isExpanded: boolean;
  participation: Participant | null;
  defaultParticipant: Participant | null;
  liveSupporterCount: number;
  isMostPopular: boolean;
  nonprofitName: string;
  onToggle: () => void;
  onConfirmParticipation: (locId: number, p: Participant) => void;
}) => {
  const config = TYPE_CONFIG[loc.type];
  // Local: when user clicks "Use different details", force the form for this card.
  const [forceFreshForm, setForceFreshForm] = useState(false);

  const handleCapture = (p: Participant) => {
    setForceFreshForm(false);
    onConfirmParticipation(loc.id, p);
  };

  const handleContinueAs = () => {
    if (defaultParticipant) {
      onConfirmParticipation(loc.id, defaultParticipant);
    }
  };

  // Decide which view to show in the expanded body
  const showConfirmed = !!participation;
  const showReusePrompt = !showConfirmed && !!defaultParticipant && !forceFreshForm;
  const showCaptureForm = !showConfirmed && (!defaultParticipant || forceFreshForm);

  return (
    <div
      className={`card-warm overflow-hidden transition-all duration-300 ${
        isExpanded ? "ring-2 ring-primary/30 shadow-lg shadow-primary/[0.08]" : ""
      }`}
    >
      {/* Collapsed state — always visible */}
      <div className="cursor-pointer" onClick={onToggle}>
        <div className="relative">
          <img
            src={loc.image}
            alt={loc.name}
            className={`w-full object-cover transition-all duration-500 ${
              isExpanded ? "h-56 sm:h-64" : "h-44 sm:h-48"
            }`}
          />
          {/* Type badge + Most popular */}
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
          {/* ForkUp logo watermark */}
          <img
            src={assetSrc(forkupLogo)}
            alt="ForkUp"
            className="absolute bottom-3 left-3 h-7 opacity-70"
          />
        </div>

        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between mb-1">
            <h3 className="font-serif text-xl sm:text-2xl text-foreground leading-tight">
              {loc.name}
            </h3>
            <ChevronDown
              size={20}
              className={`text-muted-foreground mt-1 flex-shrink-0 transition-transform duration-300 ${
                isExpanded ? "rotate-180" : ""
              }`}
            />
          </div>

          <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1.5">
            <MapPin size={13} className="flex-shrink-0" /> {loc.city}
          </p>

          <p className="text-sm text-foreground mb-3 flex items-center gap-1.5 tabular-nums">
            <Users size={13} className="flex-shrink-0 text-primary" />
            <span className="font-semibold">{liveSupporterCount}</span>
            <span className="text-muted-foreground">Supporters Going</span>
          </p>


          <p className="text-sm font-semibold text-foreground mb-1.5">
            {loc.actionLine}
          </p>

          <p className="text-xs text-muted-foreground">
            {loc.donationPercent}% of {loc.type === "dine" ? "dine-in and takeout" : loc.type === "shop" ? "all purchases" : "booked services"} will be donated
          </p>

          {/* CTA only in collapsed */}
          {!isExpanded && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              className="mt-4 w-full btn-primary py-3.5 text-sm rounded-xl"
            >
              {config.ctaCollapsed}
            </button>
          )}
        </div>
      </div>

      {/* Expanded state */}
      <div
        className={`overflow-hidden transition-all duration-500 ease-out ${
          isExpanded ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-5 sm:px-6 pb-6 space-y-5">
          <div className="h-px bg-border" />

          {showCaptureForm && (
            <CaptureForm onComplete={handleCapture} businessName={loc.name} />
          )}

          {showReusePrompt && defaultParticipant && (
            <ReusePrompt
              participant={defaultParticipant}
              businessType={loc.type}
              nonprofitName={nonprofitName}
              onContinue={handleContinueAs}
              onUseDifferent={() => setForceFreshForm(true)}
            />
          )}

          {showConfirmed && participation && (
            <>
              {/* Welcome line */}
              <p className="text-sm text-foreground">
                Welcome, <span className="font-semibold">{participation.firstName}</span> 👋
              </p>

              {/* Full address */}
              <p className="text-sm text-muted-foreground flex items-start gap-2">
                <MapPin size={14} className="mt-0.5 flex-shrink-0 text-primary" />
                {loc.address}
              </p>

              {/* Description */}
              <p className="text-sm text-foreground/80 text-pretty leading-relaxed">
                {loc.description}
              </p>

              {/* Give back section */}
              <div className="bg-secondary/60 rounded-xl p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  How your visit gives back
                </p>
                <p className="text-sm text-foreground">
                  {loc.donationPercent}% of your {loc.type === "dine" ? "dine-in or takeout order" : loc.type === "shop" ? "purchase" : loc.type === "service" ? "appointment" : "visit"} at {loc.name} will be donated to support {nonprofitName}
                </p>
              </div>

              {/* Captured participation summary */}
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 font-medium text-secondary-foreground">
                  <Users size={12} /> Party of {participation.partySize}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 font-medium text-secondary-foreground">
                  {participation.returning ? "Returning guest" : "First visit"}
                </span>
              </div>

              {/* Booking CTA */}
              <BookingButton booking={loc.booking} />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export const LocationsSection = ({ id }: { id?: string }) => {
  const { state } = useCampaign();
  const nonprofitName = getNonprofitName(state);

  const accepted = getPublicLocations(state) as Location[];
  const display: Location[] = accepted;
  const showEmptyState = display.length === 0;
  const [expandedId, setExpandedId] = useState<number | null>(null);
  // Per-business participation events. Each entry = one independent participation.
  const [participations, setParticipations] = useState<Record<number, Participant>>({});
  // Most recently entered participant — offered for reuse on other businesses.
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
      if (raw) setLastParticipant(JSON.parse(raw));
    } catch {}
  }, []);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  const toggle = (locId: number) => {
    setExpandedId((prev) => (prev === locId ? null : locId));
  };

  const handleConfirmParticipation = (locId: number, p: Participant) => {
    // Independent participation event per business.
    setParticipations((prev) => ({ ...prev, [locId]: p }));
    setLastParticipant(p);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    } catch {}
  };

  // Live supporter count = baseline + any new participations confirmed this session.
  const liveCounts = display.reduce<Record<number, number>>((acc, loc) => {
    acc[loc.id] = loc.supporterCount + (participations[loc.id] ? 1 : 0);
    return acc;
  }, {});
  const mostPopularId = display.length
    ? display.reduce(
        (topId, loc) => (liveCounts[loc.id] > liveCounts[topId] ? loc.id : topId),
        display[0].id,
      )
    : -1;

  return (
    <section id={id} className="py-20 md:py-28">
      <div className="section-padding">
        <ScrollReveal>
          <p className="text-center text-base sm:text-lg text-foreground font-medium mb-1.5 text-pretty max-w-2xl mx-auto">
            Just show up — a portion of your purchase will be donated to this cause.
          </p>
          <p className="text-center text-sm text-muted-foreground mb-8 text-pretty">
            No extra cost — just support a local business.
          </p>
          <h2 className="font-serif text-3xl sm:text-4xl text-center text-foreground mb-3 text-balance leading-[1.1]">
            Choose where to participate
          </h2>
          <p className="text-center text-xs text-muted-foreground/70 mb-12">
            Participating businesses are donating 10%–20% of your visit to {nonprofitName}
          </p>
        </ScrollReveal>
      </div>

      {showEmptyState ? (
        <div className="section-padding">
          <div className="max-w-md mx-auto text-center bg-card border border-border rounded-2xl px-6 py-12 shadow-sm">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary mb-4">
              <MapPin size={20} />
            </div>
            <p className="text-base font-medium text-foreground">
              Businesses are being added to this campaign.
            </p>
            <p className="text-sm text-muted-foreground mt-1">Check back soon.</p>
          </div>
        </div>
      ) : (
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
          {/* Navigation arrows */}
          <button
            onClick={scrollPrev}
            className="absolute -left-1 sm:left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-card shadow-md border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:shadow-lg transition-all duration-200 active:scale-95"
            aria-label="Previous location"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={scrollNext}
            className="absolute -right-1 sm:right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-card shadow-md border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:shadow-lg transition-all duration-200 active:scale-95"
            aria-label="Next location"
          >
            <ChevronRight size={18} />
          </button>

          <div ref={emblaRef} className="overflow-hidden mx-6 sm:mx-12">
            <div className="flex gap-5">
              {display.map((loc, i) => (
                <div key={loc.id} className="flex-[0_0_85%] sm:flex-[0_0_48%] lg:flex-[0_0_32%] min-w-0">
                  <ScrollReveal delay={i * 80}>
                    <LocationCard
                      loc={loc}
                      isExpanded={expandedId === loc.id}
                      participation={participations[loc.id] ?? null}
                      defaultParticipant={lastParticipant}
                      liveSupporterCount={liveCounts[loc.id]}
                      isMostPopular={loc.id === mostPopularId}
                      nonprofitName={nonprofitName}
                      onToggle={() => toggle(loc.id)}
                      onConfirmParticipation={handleConfirmParticipation}
                    />
                  </ScrollReveal>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
