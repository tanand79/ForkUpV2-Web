import { useState } from "react";
import {
  Check,
  Clock,
  Wrench,
  Radio,
  ArrowRight,
  Copy,
  ExternalLink,
  QrCode,
  Mail,
  MessageSquare,
  Facebook,
  Users,
  Wine,
  Building2,
  ClipboardList,
  Megaphone,
  Link2,
} from "lucide-react";
import { useCampaign, type StepId } from "@/lib/campaign-context";
import { campaignGivebackTerm } from "@/lib/giveback-terminology";

/**
 * ⚠️ DESIGN MODE ONLY — Campaign Success / Activation state previews.
 *
 * These are static design-review screens that illustrate each method
 * combination's success state. In production, ONE dynamic success screen is
 * rendered based on the selected campaign methods. Do not ship these as
 * separate user-facing routes.
 *
 * Every screen answers three questions at a glance:
 *   • Live Now   — what can be shared / used immediately
 *   • In Setup   — what the organizer can work on right now
 *   • Waiting On — what must happen before public promotion
 */

type GroupKind = "live" | "setup" | "waiting";

interface ActionSpec {
  label: string;
  to?: StepId;
  copy?: boolean;
}

interface SuccessSpec {
  headline: string;
  subhead?: string;
  groups: { kind: GroupKind; items: string[] }[];
  primary: ActionSpec;
  secondary: ActionSpec;
}

const SPECS: Record<string, SuccessSpec> = {
  "success-virtual": {
    headline: "Your donation campaign is live.",
    subhead: "Everything you need to start raising money is ready to share right now.",
    groups: [
      {
        kind: "live",
        items: [
          "Campaign donation page",
          "Copy campaign link",
          "QR code",
          "Facebook / email / text messages",
        ],
      },
    ],
    primary: { label: "Share Campaign", copy: true },
    secondary: { label: "Go to Campaign Dashboard", to: "dashboard" },
  },

  "success-ambassador": {
    headline: "Your ambassador campaign is live.",
    subhead: "Your supporters can start sharing right now. Add more ambassadors anytime.",
    groups: [
      {
        kind: "live",
        items: [
          "Campaign donation page",
          "Personal ambassador share links",
          "Ambassador messages",
        ],
      },
      { kind: "setup", items: ["Add more ambassadors", "Personalize ambassador messages"] },
    ],
    primary: { label: "Add Ambassadors", to: "ambassador" },
    secondary: { label: "Go to Campaign Dashboard", to: "dashboard" },
  },

  "success-bartending": {
    headline: "Your guest bartending event is live.",
    subhead: "Your bartenders can start rallying their networks and collecting tips.",
    groups: [
      {
        kind: "live",
        items: [
          "Event page",
          "Personal bartender links",
          "QR code / virtual tip jar",
          "Bartender messages",
        ],
      },
      { kind: "setup", items: ["Add more guest bartenders", "Personalize event messages"] },
    ],
    primary: { label: "Add Guest Bartenders", to: "guestBartending" },
    secondary: { label: "Go to Campaign Dashboard", to: "dashboard" },
  },

  "success-giveback-live": {
    headline: "Your campaign is live!",
    subhead: "A business has accepted — your campaign page is active and ready to promote.",
    groups: [
      {
        kind: "live",
        items: [
          "Campaign page active",
          "Copy campaign link",
          "QR code",
          "Facebook / email / text messages",
          "Success Toolkit activated",
        ],
      },
    ],
    primary: { label: "Share Campaign", copy: true },
    secondary: { label: "Go to Campaign Dashboard", to: "dashboard" },
  },

  "success-mixed": {
    headline: "Your campaign is underway.",
    subhead: "Some parts are live now while others finish setup or wait on confirmation.",
    groups: [
      { kind: "live", items: ["Virtual donation page (if enabled)", "Copy donation link", "QR code"] },
      {
        kind: "setup",
        items: ["Add ambassadors / guest bartenders", "Prepare messages"],
      },
      { kind: "waiting", items: ["First business acceptance for giveback promotion"] },
    ],
    primary: { label: "Share Donation Link", copy: true },
    secondary: { label: "Go to Campaign Dashboard", to: "dashboard" },
  },
};

const GROUP_META: Record<
  GroupKind,
  { label: string; icon: typeof Radio; chip: string; ring: string; iconColor: string }
> = {
  live: {
    label: "Live Now",
    icon: Radio,
    chip: "bg-[oklch(0.94_0.05_150)] text-[oklch(0.4_0.13_150)]",
    ring: "border-[oklch(0.6_0.13_150)]/30 bg-[oklch(0.97_0.02_150)]/60",
    iconColor: "text-[oklch(0.55_0.13_150)]",
  },
  setup: {
    label: "In Setup",
    icon: Wrench,
    chip: "bg-primary/15 text-primary",
    ring: "border-primary/25 bg-primary/5",
    iconColor: "text-primary",
  },
  waiting: {
    label: "Waiting On",
    icon: Clock,
    chip: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    ring: "border-amber-400/40 bg-amber-50/60 dark:bg-amber-950/30",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
};

function itemIcon(text: string) {
  const t = text.toLowerCase();
  if (t.includes("qr")) return QrCode;
  if (t.includes("email")) return Mail;
  if (t.includes("text")) return MessageSquare;
  if (t.includes("facebook")) return Facebook;
  if (t.includes("ambassador") || t.includes("supporter")) return Users;
  if (t.includes("bartender")) return Wine;
  if (t.includes("business")) return Building2;
  if (t.includes("message")) return Megaphone;
  if (t.includes("link")) return Link2;
  if (t.includes("review") || t.includes("invited")) return ClipboardList;
  if (t.includes("page")) return ExternalLink;
  return Check;
}

function GroupCard({ kind, items, delay }: { kind: GroupKind; items: string[]; delay: number }) {
  const meta = GROUP_META[kind];
  const GroupIcon = meta.icon;
  return (
    <div
      className={`animate-rise rounded-2xl border p-5 ${meta.ring}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="mb-3 flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${meta.chip}`}
        >
          <GroupIcon className="size-3.5" />
          {meta.label}
        </span>
      </div>
      <ul className="space-y-2">
        {items.map((item) => {
          const ItemIcon = itemIcon(item);
          return (
            <li key={item} className="flex items-start gap-2.5 text-sm">
              <ItemIcon className={`mt-0.5 size-4 shrink-0 ${meta.iconColor}`} />
              <span className="text-foreground">{item}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function SuccessState({ variant }: { variant: string }) {
  const { goTo, selectedBusinesses } = useCampaign();
  const spec = SPECS[variant];
  const [copied, setCopied] = useState(false);

  if (!spec) return null;

  // Giveback success leads with the familiar "Dine & Donate" when only
  // restaurants are involved, and the broader "Local Giveback" when mixed.
  const headline =
    variant === "success-giveback-live"
      ? `${campaignGivebackTerm(selectedBusinesses)} campaign created.`
      : spec.headline;



  const runAction = (a: ActionSpec) => {
    if (a.copy) {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        navigator.clipboard.writeText("https://forkup.org/c/your-campaign").catch(() => {});
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      return;
    }
    if (a.to) goTo(a.to);
  };

  return (
    <main className="relative mx-auto max-w-2xl px-5 py-10 sm:px-6">
      <div className="pointer-events-none fixed -left-24 top-0 size-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none fixed -right-24 bottom-0 size-96 rounded-full bg-accent/40 blur-3xl" />

      {/* Hero */}
      <div className="flex flex-col items-center text-center">
        <div className="animate-pop flex size-16 items-center justify-center rounded-full bg-[oklch(0.94_0.05_150)]">
          <div className="flex size-11 items-center justify-center rounded-full bg-[oklch(0.6_0.13_150)]">
            <Check className="size-6 text-white" strokeWidth={3} />
          </div>
        </div>
        <h1 className="animate-rise mt-5 text-balance text-3xl font-extrabold tracking-tight sm:text-4xl [animation-delay:80ms]">
          {headline}
        </h1>
        {spec.subhead && (
          <p className="animate-rise mt-3 max-w-xl text-pretty text-muted-foreground [animation-delay:140ms]">
            {spec.subhead}
          </p>
        )}
      </div>

      {/* Status groups */}
      <div className="mt-8 space-y-3">
        {spec.groups.map((g, i) => (
          <GroupCard key={g.kind} kind={g.kind} items={g.items} delay={200 + i * 60} />
        ))}
      </div>

      {/* Actions */}
      <div className="animate-rise mt-8 flex flex-col gap-3 sm:flex-row sm:items-center [animation-delay:380ms]">
        <button
          onClick={() => runAction(spec.primary)}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-dark active:scale-95"
        >
          {spec.primary.copy ? (
            copied ? (
              <>
                <Check className="size-4" />
                Link copied!
              </>
            ) : (
              <>
                <Copy className="size-4" />
                {spec.primary.label}
              </>
            )
          ) : (
            <>
              {spec.primary.label}
              <ArrowRight className="size-4" />
            </>
          )}
        </button>
        <button
          onClick={() => runAction(spec.secondary)}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-sm font-semibold transition-colors hover:bg-secondary"
        >
          {spec.secondary.label}
        </button>
      </div>
    </main>
  );
}
