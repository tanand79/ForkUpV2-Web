import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  RotateCcw,
  ArrowRight,
  Mail,
  MessageSquare,
  Facebook,
  Megaphone,
  Download,
  QrCode,
  Wine,
  Sparkles,
  Link2,
  CalendarClock,
  Lightbulb,
  Flag,
  BarChart3,
  FileText,
  Eye,
  Clock,
  Building2,
  Share2,
  UserPlus,
  Users,
  ClipboardList,
  Settings2,
} from "lucide-react";
import { useCampaign } from "@/lib/campaign-context";
import { campaignPublicPath, campaignPublicUrl } from "@/lib/campaign-paths";
import { campaignGivebackLabel } from "@/lib/giveback-terminology";
import { formatDateUs } from "@/lib/date-only";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export function CampaignCreated() {
  const { state, reset, goTo, selectedBusinesses } = useCampaign();

  const slug = state.campaignSlug
    ?? state.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
  const campaignPath = campaignPublicPath(slug);
  const link = slug || "your-campaign";
  const fullLink =
    typeof window !== "undefined" && slug
      ? campaignPublicUrl(slug)
      : `https://forkup.org${campaignPublicPath(slug || "your-campaign")}`;
  const campaignName = state.title || "our campaign";

  // ── Pre-generated shareable content ──────────────────────────────────────
  // Messages are drafted from the real campaign details so the nonprofit can
  // review and personalize, then share without writing from scratch.
  const story =
    state.description ||
    "We're raising support for a cause close to our hearts, and we'd love for you to be part of it.";

  const businessNames = selectedBusinesses.map((b) => b.name);
  const businessLine =
    businessNames.length === 0
      ? ""
      : businessNames.length === 1
        ? businessNames[0]
        : businessNames.length === 2
          ? `${businessNames[0]} and ${businessNames[1]}`
          : `${businessNames.slice(0, -1).join(", ")}, and ${businessNames[businessNames.length - 1]}`;

  const fmtDate = (d: string) => {
    if (!d) return "";
    const label = formatDateUs(d);
    return label === "—" ? "" : label;
  };
  const startLabel = fmtDate(state.startDate);
  const endLabel = fmtDate(state.endDate);
  const dateLine =
    startLabel && endLabel
      ? startLabel === endLabel
        ? `Join us on ${startLabel}.`
        : `Running ${startLabel}–${endLabel}.`
      : "";

  const givebackLine =
    state.methods.giveback && state.giveback > 0
      ? `${state.giveback}% of every purchase${businessLine ? ` at ${businessLine}` : ""} goes straight to our cause.`
      : "";

  const waysToHelp: string[] = [];
  if (state.methods.giveback) waysToHelp.push("dine out and give back");
  if (state.methods.donations) waysToHelp.push("make a direct donation");
  if (state.methods.guestBartending) waysToHelp.push("come out to a guest bartending night");
  if (state.methods.ambassador) waysToHelp.push("share with your circle as an ambassador");
  const waysLine =
    waysToHelp.length > 0
      ? `Here's how you can help: ${
          waysToHelp.length === 1
            ? waysToHelp[0]
            : `${waysToHelp.slice(0, -1).join(", ")}, or ${waysToHelp[waysToHelp.length - 1]}`
        }.`
      : "There are so many easy ways to help — give, share, or join us in person.";

  const facebookPost = [
    `🎉 ${campaignName} is live!`,
    "",
    story,
    "",
    [givebackLine, dateLine].filter(Boolean).join(" "),
    "",
    `${waysLine} Every bit helps us reach our goal. 💛`,
    "",
    `👉 ${fullLink}`,
  ]
    .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
    .join("\n")
    .trim();

  const emailSubject = `Help us rally support for ${campaignName}`;
  const emailBody = [
    "Hi friends,",
    "",
    `I'm thrilled to share that ${campaignName} is now live! ${story}`,
    "",
    [givebackLine, dateLine].filter(Boolean).join(" "),
    "",
    `${waysLine} Every action makes a difference.`,
    "",
    `Check out our campaign page and join the movement: ${fullLink}`,
    "",
    "Thank you for being part of our community.",
    "",
    "With gratitude,",
  ]
    .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
    .join("\n")
    .trim();

  const emailMessage = `Subject: ${emailSubject}\n\n${emailBody}`;

  const textMessage =
    `${campaignName} is live! 🎉 ${
      givebackLine || "We'd love your support."
    } ${dateLine} Give, share, or join in: ${fullLink}`
      .replace(/\s+/g, " ")
      .trim();


  const ambassadorMessage = `You're invited to be an ambassador for ${campaignName}! 💛

Help us spread the word by sharing our campaign with your friends, family, and network. Every share brings us closer to our goal.

Here's your link to share: ${fullLink}

Thank you for helping our community succeed!`;

  const guestBartenderMessage = `Come see me behind the bar for ${campaignName}! 🍸 I'm guest bartending to raise support for our cause. Stop by, grab a drink, and every tip goes to a great cause. Details: ${fullLink}`;

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=0&data=${encodeURIComponent(
    fullLink,
  )}`;




  // Which "ready to send" message modal is open (null = none).
  const [openMessage, setOpenMessage] = useState<"facebook" | "email" | "text" | null>(null);

  // ── Created vs. ready-to-promote logic ───────────────────────────────────
  const requiresPartner = state.methods.giveback || state.methods.guestBartending;
  const partnersReady =
    (state.lockedBusinessPartners?.length ?? 0) > 0 ||
    selectedBusinesses.length > 0 ||
    !requiresPartner;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startReached = state.startDate
    ? new Date(`${state.startDate}T00:00:00`).getTime() <= today.getTime()
    : true;
  const isLive = partnersReady && startReached;
  const isScheduled = partnersReady && !startReached && state.termsAccepted;




  return (
    <main className="relative mx-auto max-w-3xl px-5 py-10 sm:px-6">
      <div className="pointer-events-none fixed -left-24 top-0 size-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none fixed -right-24 bottom-0 size-96 rounded-full bg-accent/40 blur-3xl" />

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center text-center">
        <div className="animate-pop flex size-20 items-center justify-center rounded-full bg-[oklch(0.94_0.05_150)]">
          <div className="flex size-14 items-center justify-center rounded-full bg-[oklch(0.6_0.13_150)]">
            <Check className="size-8 text-white" strokeWidth={3} />
          </div>
        </div>

        {state.methods.giveback && (
          <span className="animate-rise mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary [animation-delay:60ms]">
            {campaignGivebackLabel(selectedBusinesses)} created
          </span>
        )}



        {isLive ? (
          <>
            <h1 className="animate-rise mt-6 text-balance text-4xl font-extrabold tracking-tight sm:text-5xl [animation-delay:100ms]">
              Your campaign is live!
            </h1>
            <p className="animate-rise mt-3 max-w-xl text-pretty text-muted-foreground [animation-delay:160ms]">
              Your campaign page is ready to share. Start inviting supporters, volunteers, donors,
              friends, family, and your community.
            </p>
          </>
        ) : isScheduled ? (
          <>
            <div className="animate-rise mt-6 flex flex-wrap items-center justify-center gap-2 [animation-delay:80ms]">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
                <Check className="size-3.5" strokeWidth={3} />
                Launch complete
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                <Clock className="size-3.5" />
                {startLabel ? `Goes live ${startLabel}` : "Scheduled"}
              </span>
            </div>
            <h1 className="animate-rise mt-4 text-balance text-4xl font-extrabold tracking-tight sm:text-5xl [animation-delay:100ms]">
              Your campaign is scheduled.
            </h1>
            <p className="animate-rise mt-3 max-w-xl text-pretty text-muted-foreground [animation-delay:160ms]">
              Setup is complete and your business partner is confirmed. Your campaign will appear in
              the public directory on {startLabel || "the start date"}, or you can publish it early
              from your dashboard.
            </p>
          </>
        ) : (
          <>
            <div className="animate-rise mt-6 flex flex-wrap items-center justify-center gap-2 [animation-delay:80ms]">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
                <Check className="size-3.5" strokeWidth={3} />
                Campaign Created
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                <Clock className="size-3.5" />
                Partner confirmation in progress
              </span>
            </div>
            <h1 className="animate-rise mt-4 text-balance text-4xl font-extrabold tracking-tight sm:text-5xl [animation-delay:100ms]">
              Your campaign is underway.
            </h1>
            <p className="animate-rise mt-3 max-w-xl text-pretty text-muted-foreground [animation-delay:160ms]">
              We're reaching out to your invited businesses now. As soon as the first business
              accepts, your campaign page will be ready to promote.
            </p>
          </>
        )}
      </div>

      {/* ── Share your campaign (only once publicly promotable) ─────────── */}
      {isLive && (
        <Section
          delay={220}
          icon={<Link2 className="size-4 text-primary" />}
          title="Your campaign is ready to share."
          compact
        >
          <p className="text-sm text-muted-foreground">
            The more people who see it, the more support your cause can generate.
          </p>

          <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Your first goal
            </p>
            <p className="mt-1 text-base font-bold">Build your first wave of momentum.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Share your campaign with 10 people today through:
            </p>
            <p className="mt-1 text-sm font-medium">
              Facebook &bull; Instagram &bull; Email &bull; Text &bull; Community Groups &bull;
              Supporter Outreach
            </p>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <CopyButton
              primary
              large
              text={fullLink}
              label="Copy Campaign Link"
              copiedLabel="Link copied!"
            />
            <a
              href={fullLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-sm font-semibold transition-colors hover:bg-secondary"
            >
              <ExternalLink className="size-4" />
              View Campaign
            </a>
          </div>

          <p className="mt-3 text-[11px] text-muted-foreground/70">{link}</p>
        </Section>
      )}

      {/* ── Pre-promotion sections (while partners confirm) ─────────────── */}
      {!isLive && (
        <>
          {/* Partner confirmation */}
          <Section
            delay={220}
            icon={<Building2 className="size-4 text-primary" />}
            title="We're confirming your business partners."
          >
            <p className="text-sm text-muted-foreground">
              Your invited businesses are being contacted now.
            </p>
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-amber-400/50 bg-amber-50/70 p-4 dark:bg-amber-950/30">
              <Clock className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                Waiting on first business acceptance.
              </p>
            </div>
          </Section>

          {/* While we confirm partners, you can: */}
          <Section
            delay={280}
            icon={<Sparkles className="size-4 text-primary" />}
            title="While we confirm partners, you can:"
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <MomentumCard
                icon={<Megaphone className="size-5 text-primary" />}
                title="Prepare Your Messages"
                description="Preview and edit Facebook, email, and text messages so they're ready when your campaign goes live."
                buttonLabel="Prepare Messages"
                onClick={() => setOpenMessage("facebook")}
              />
              <MomentumCard
                icon={<Users className="size-5 text-primary" />}
                title="Add Supporters"
                description="Add ambassadors, volunteers, board members, parents, donors, or guest bartenders you'll want to notify."
                buttonLabel="Add Supporters"
                onClick={() => goTo("ambassador")}
              />
              <MomentumCard
                icon={<Building2 className="size-5 text-primary" />}
                title="Invite Another Business"
                description="Add another local business to increase your chances of a strong launch."
                buttonLabel="Invite Business"
                onClick={() => goTo("businesses")}
              />
            </div>
          </Section>
        </>
      )}


      {/* ── Ready messages (post-promotion only) ───────────────────────── */}
      {isLive && (
        <Section
          delay={300}
          icon={<Megaphone className="size-4 text-primary" />}
          title="Messages ready to send"
        >
          <p className="text-sm text-muted-foreground">
            Preview, personalize, and copy ready-to-send messages for Facebook, email, and text.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <MessageCard
              icon={<Facebook className="size-5 text-primary" />}
              title="Facebook Post"
              helper="Preview a ready-to-post message for social media."
              actionLabel="Preview & Copy"
              onClick={() => setOpenMessage("facebook")}
            />
            <MessageCard
              icon={<Mail className="size-5 text-primary" />}
              title="Email Message"
              helper="Preview a supporter email with subject line and campaign link."
              actionLabel="Preview & Copy"
              onClick={() => setOpenMessage("email")}
            />
            <MessageCard
              icon={<MessageSquare className="size-5 text-primary" />}
              title="Text Message"
              helper="Preview a short message made for quick sharing."
              actionLabel="Preview & Copy"
              onClick={() => setOpenMessage("text")}
            />
          </div>
        </Section>
      )}



      {/* ── Message preview / edit modals ──────────────────────────────── */}
      <SimpleMessageModal
        open={openMessage === "facebook"}
        onClose={() => setOpenMessage(null)}
        title="Facebook Post"
        description="Review and personalize your post. The campaign link is already included."
        initialText={facebookPost}
        link={link}
        copyLabel="Copy Facebook Post"
      />
      <EmailMessageModal
        open={openMessage === "email"}
        onClose={() => setOpenMessage(null)}
        initialSubject={emailSubject}
        initialBody={emailBody}
        link={link}
      />
      <SimpleMessageModal
        open={openMessage === "text"}
        onClose={() => setOpenMessage(null)}
        title="Text Message"
        description="Review and personalize your message. The campaign link is already included."
        initialText={textMessage}
        link={link}
        copyLabel="Copy Text Message"
        showCharCount
      />


      {/* ── Ambassador toolkit (conditional, post-promotion) ───────────── */}
      {isLive && state.methods.ambassador && (
        <Section
          delay={320}
          icon={<Megaphone className="size-4 text-primary" />}
          title="Ambassador Toolkit"
        >
          <p className="text-sm text-muted-foreground">
            Give board members, volunteers, parents, advocates, and supporters everything they need
            to help spread the word.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <CopyButton text={ambassadorMessage} label="Copy Ambassador Message" copiedLabel="Copied" />
            <DownloadButton
              filename={`${slug || "campaign"}-ambassador-toolkit.txt`}
              content={`AMBASSADOR TOOLKIT — ${campaignName}\n\nCAMPAIGN LINK\n${fullLink}\n\nAMBASSADOR MESSAGE\n${ambassadorMessage}\n\nSUGGESTED SOCIAL POST\n${facebookPost}\n\nSUGGESTED EMAIL\n${emailMessage}\n\nSUGGESTED TEXT\n${textMessage}`}
              label="Download Ambassador Toolkit"
            />
          </div>
        </Section>
      )}

      {/* ── Guest bartender toolkit (conditional, post-promotion) ──────── */}
      {isLive && state.methods.guestBartending && (
        <Section
          delay={360}
          icon={<Wine className="size-4 text-primary" />}
          title="Guest Bartender Toolkit"
        >
          <p className="text-sm text-muted-foreground">
            Give guest bartenders the event copy, QR code, and share tools they need to bring people
            out and collect support.
          </p>
          <div className="mt-4 space-y-3">
            <ContentRow
              title="Bartender announcement copy"
              text={`Come see me behind the bar for ${campaignName}! 🍸 I'm guest bartending to raise support for our cause. Stop by, grab a drink, and every tip goes to a great cause. Details: ${fullLink}`}
            />
            <ContentRow
              title="Social media copy"
              text={`I'm guest bartending for ${campaignName}! 💛 Come hang out, grab a drink, and help us make an impact. All tips support our cause. ${fullLink}`}
            />
            <ContentRow
              title="Email copy"
              text={`Hi! I'm guest bartending to support ${campaignName}. I'd love for you to stop by — every drink and tip helps our cause. Find all the details here: ${fullLink}`}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <CopyButton
              text={guestBartenderMessage}
              label="Copy Guest Bartender Message"
              copiedLabel="Copied"
            />
            <DownloadButton
              filename={`${slug || "campaign"}-guest-bartender-toolkit.txt`}
              content={`GUEST BARTENDER TOOLKIT — ${campaignName}\n\nCAMPAIGN LINK\n${fullLink}\n\nGUEST BARTENDER MESSAGE\n${guestBartenderMessage}\n\nANNOUNCEMENT COPY\nCome see me behind the bar for ${campaignName}! Stop by, grab a drink, and every tip goes to a great cause. Details: ${fullLink}\n\nSOCIAL MEDIA COPY\nI'm guest bartending for ${campaignName}! Come hang out, grab a drink, and help us make an impact. All tips support our cause. ${fullLink}`}
              label="Download Guest Bartender Toolkit"
            />
          </div>
          <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-border bg-background p-4 sm:flex-row sm:items-center">
            <img
              src={qrUrl}
              alt="Guest bartender campaign QR code"
              className="size-28 shrink-0 self-center rounded-xl border border-border bg-white p-2"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Campaign link &amp; QR code</p>
              <p className="mt-1 break-all text-xs text-muted-foreground">{link}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <CopyButton compact text={fullLink} label="Copy Link" copiedLabel="Copied" />
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* ── QR code (public promotion only) ────────────────────────────── */}
      {isLive && (
        <Section delay={400} icon={<QrCode className="size-4 text-primary" />} title="Campaign QR Code">
          <p className="text-sm text-muted-foreground">
            Use this QR code on flyers, posters, table cards, and event materials. It links directly
            to your public campaign page.
          </p>
          <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-center">
            <img
              src={qrUrl}
              alt="Campaign QR code"
              className="size-36 shrink-0 rounded-2xl border border-border bg-white p-3"
            />
            <div className="flex flex-wrap gap-3">
              <a
                href={qrUrl}
                download={`${slug || "campaign"}-qr-code.png`}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary-dark active:scale-95"
              >
                <Download className="size-4" />
                Download QR Code
              </a>
              <CopyButton text={fullLink} label="Copy Campaign Link" copiedLabel="Link copied" />
            </div>
          </div>
        </Section>
      )}


      {/* ── CTAs ───────────────────────────────────────────────────────── */}
      <div className="animate-rise mt-8 flex flex-col items-center gap-4 [animation-delay:500ms]">
        <button
          onClick={() => goTo("dashboard")}
          className="inline-flex h-12 w-full max-w-md items-center justify-center gap-2 rounded-full bg-primary px-8 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary-dark active:scale-95"
        >
          Go to Campaign Dashboard
          <ArrowRight className="size-4" />
        </button>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          {isLive && (
            <a
              href={fullLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              <ExternalLink className="size-4" />
              View Campaign
            </a>
          )}
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <RotateCcw className="size-3.5" />
            Create Another Campaign
          </button>
        </div>
      </div>
    </main>
  );
}

// ── Building blocks ────────────────────────────────────────────────────────

function Section({
  icon,
  title,
  children,
  delay,
  compact = false,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  delay: number;
  compact?: boolean;
}) {
  return (
    <section
      className={`animate-rise mt-6 rounded-3xl border border-border bg-card shadow-sm ${
        compact ? "p-4 sm:p-5" : "p-6 sm:p-8"
      }`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function useCopy(text: string) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };
  return { copied, copy };
}

function CopyButton({
  text,
  label,
  copiedLabel,
  primary = false,
  compact = false,
  large = false,
}: {
  text: string;
  label: string;
  copiedLabel: string;
  primary?: boolean;
  compact?: boolean;
  large?: boolean;
}) {
  const { copied, copy } = useCopy(text);
  const base = compact
    ? "px-4 py-2 text-xs"
    : large
      ? "px-7 py-3.5 text-base"
      : "px-5 py-2.5 text-sm";
  const style = primary
    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary-dark"
    : "border border-border bg-card hover:bg-secondary";
  return (
    <button
      onClick={copy}
      className={`inline-flex items-center gap-2 rounded-full font-semibold transition-all active:scale-95 ${base} ${style}`}
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      {copied ? copiedLabel : label}
    </button>
  );
}

function DownloadButton({
  content,
  filename,
  label,
}: {
  content: string;
  filename: string;
  label: string;
}) {
  const download = () => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <button
      onClick={download}
      className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-secondary"
    >
      <Download className="size-4" />
      {label}
    </button>
  );
}


function ContentRow({ title, text }: { title: string; text: string }) {
  const { copied, copy } = useCopy(text);
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background p-3.5">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{text}</p>
      </div>
      <button
        onClick={copy}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold transition-colors hover:bg-secondary"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

// ── Message preview cards & modals ──────────────────────────────────────────

function MessageCard({
  icon,
  title,
  helper,
  onClick,
  actionLabel = "Preview & Copy",
}: {
  icon: React.ReactNode;
  title: string;
  helper: string;
  onClick: () => void;
  actionLabel?: string;
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-background p-4">
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-sm font-semibold">{title}</p>
      </div>
      <p className="mt-1 flex-1 text-xs text-muted-foreground">{helper}</p>
      <button
        onClick={onClick}
        className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition-transform active:scale-95"
      >
        <Eye className="size-3.5" />
        {actionLabel}
      </button>
    </div>
  );
}

function MomentumCard({
  icon,
  title,
  description,
  buttonLabel,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  buttonLabel: string;
  onClick: () => void;
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-background p-4">
      <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
        {icon}
      </span>
      <p className="mt-3 text-sm font-semibold">{title}</p>
      <p className="mt-1 flex-1 text-xs text-muted-foreground">{description}</p>
      <button
        onClick={onClick}
        className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition-transform active:scale-95"
      >
        {buttonLabel}
      </button>
    </div>
  );
}



function ModalCopyButton({ text, label }: { text: string; label: string }) {
  const { copied, copy } = useCopy(text);
  return (
    <button
      onClick={copy}
      className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary-dark active:scale-95"
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      {copied ? "Copied!" : label}
    </button>
  );
}

function SimpleMessageModal({
  open,
  onClose,
  title,
  description,
  initialText,
  link,
  copyLabel,
  showCharCount = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  initialText: string;
  link: string;
  copyLabel: string;
  showCharCount?: boolean;
}) {
  const [text, setText] = useState(initialText);

  // Reset the editable copy whenever a fresh modal opens.
  useEffect(() => {
    if (open) setText(initialText);
  }, [open, initialText]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={showCharCount ? 4 : 9}
          className="w-full resize-y rounded-xl border border-border bg-background p-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {showCharCount ? (
              <span>{text.length} characters</span>
            ) : (
              <span>
                Campaign link included:{" "}
                <span className="font-medium text-foreground">{link}</span>
              </span>
            )}
          </p>
          <ModalCopyButton text={text} label={copyLabel} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmailMessageModal({
  open,
  onClose,
  initialSubject,
  initialBody,
  link,
}: {
  open: boolean;
  onClose: () => void;
  initialSubject: string;
  initialBody: string;
  link: string;
}) {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);

  useEffect(() => {
    if (open) {
      setSubject(initialSubject);
      setBody(initialBody);
    }
  }, [open, initialSubject, initialBody]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Email Message</DialogTitle>
          <DialogDescription>
            Review and personalize your email. The campaign link is already included.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">
              Subject line
            </label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-xl border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">
              Email body
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={9}
              className="w-full resize-y rounded-xl border border-border bg-background p-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Campaign link included:{" "}
            <span className="font-medium text-foreground">{link}</span>
          </p>
          <ModalCopyButton text={`Subject: ${subject}\n\n${body}`} label="Copy Email" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

