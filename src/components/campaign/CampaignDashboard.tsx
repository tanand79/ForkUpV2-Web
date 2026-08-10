import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Store,
  Activity,
  Mail,
  MessageSquare,
  Share2,
  Copy,
  Check,
  ExternalLink,
  DollarSign,
  Users,
  CalendarClock,
  Sparkles,
  BarChart3,
  ClipboardCheck,
  type LucideIcon,
} from "lucide-react";
import { useCampaign, CAMPAIGN_STAGE_META, type CampaignStage } from "@/lib/campaign-context";
import type { BusinessInviteStatus } from "@/lib/campaign-context";
import { fetchCampaignDashboard, type CampaignDashboardData } from "@/lib/api";
import { toDateOnlyString, formatDateUs } from "@/lib/date-only";
import { ApiAcceptanceStatusBadge } from "@/components/campaign/BusinessStatusBadge";
import { formatRespondByLabel, SETUP_STATUS_LABEL, MARKETING_READY_LABEL, SETTLEMENT_READY_LABEL, type SetupStatus, type MarketingReadyStatus, type SettlementReadyStatus } from "@/lib/business-status";
import { campaignPublicPath } from "@/lib/campaign-paths";
import { BusinessEmailActions } from "./BusinessEmailActions";
import { CampaignVisibilityPanel } from "./CampaignVisibilityPanel";
import { SuccessEngineActionList } from "./SuccessEngineActionList";

function formatDate(d: string) {
  if (!d) return "—";
  return formatDateUs(d);
}

function daysRemaining(endDate: string): number | null {
  if (!endDate) return null;
  const end = new Date(endDate + "T00:00:00").getTime();
  const now = Date.now();
  const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

/** Compact top-line KPI tile (horizontal dashboard bar). */
function MetricCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0">
        <p className="text-lg font-extrabold leading-tight tracking-tight">{value}</p>
        <p className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function Stat({ label, value, tone = "default" }: { label: string; value: number | string; tone?: "default" | "good" | "warn" }) {
  const toneClass =
    tone === "good" ? "text-primary" : tone === "warn" ? "text-amber-600 dark:text-amber-400" : "text-foreground";
  return (
    <div className="flex items-center justify-between gap-2 rounded-full border border-border bg-background px-3 py-1.5">
      <span className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={`text-sm font-extrabold ${toneClass}`}>{value}</span>
    </div>
  );
}



/**
 * Success Engine — a simple scheduled promotion plan. ForkUp tells the
 * organizer what to send, when to send it, and where (which channel). Each
 * item shows a real date, a channel, a status, and action buttons.
 */
type EngineStatus = "ready" | "needs-review" | "posted" | "sent" | "completed";

const STATUS_PILL: Record<EngineStatus, { label: string; className: string }> = {
  // Ready = neutral. Needs Review = soft amber. Sent / Posted / Completed = soft green.
  ready: { label: "Ready", className: "bg-secondary text-secondary-foreground" },
  "needs-review": {
    label: "Needs Review",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
  posted: { label: "Posted", className: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300" },
  sent: { label: "Sent", className: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300" },
  completed: { label: "Completed", className: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300" },
};

type ActionButton = { label: string; action?: "copy" | "preview" };

/**
 * Scheduled campaign actions — the calendar/action queue. Each card is a single
 * dated prompt with a channel, a purpose, a status, and actions. ForkUp reminds
 * the organizer (by email in V1) when each action is ready.
 */
const SCHEDULED_ACTIONS: {
  id: string;
  date: string;
  channel: string;
  icon: LucideIcon;
  purpose: string;
  status: EngineStatus;
  copyText: string;
  buttons: ActionButton[];
}[] = [
  {
    id: "social-launch",
    date: "June 10",
    channel: "Social Post",
    icon: Share2,
    purpose: "Launch reminder",
    status: "ready",
    copyText:
      "🎉 Our campaign is LIVE! Support local, give back, and help us reach our goal. Donate or share today 👉 [campaign link] #ForkUp",
    buttons: [{ label: "Preview", action: "preview" }, { label: "Copy", action: "copy" }, { label: "Mark Posted" }],
  },
  {
    id: "email-supporter",
    date: "June 12",
    channel: "Email Message",
    icon: Mail,
    purpose: "Supporter reminder",
    status: "ready",
    copyText:
      "We're raising funds to support our cause and your help makes a real difference. Visit our campaign page to donate or share with friends — every bit counts!",
    buttons: [{ label: "Preview", action: "preview" }, { label: "Copy Email", action: "copy" }, { label: "Mark Sent" }],
  },
  {
    id: "text-daybefore",
    date: "June 14",
    channel: "Text Message",
    icon: MessageSquare,
    purpose: "Day-before reminder",
    status: "ready",
    copyText: "Hi! We just launched our ForkUp campaign. Tap to support and share: [campaign link]. Thank you!",
    buttons: [{ label: "Preview", action: "preview" }, { label: "Copy Text", action: "copy" }, { label: "Mark Sent" }],
  },
];

/** Participation label + date range adapt to what each accepted business supports. */
function givebackLabelFor(caps?: {
  supportsDineDonate?: boolean;
  supportsShopDonate?: boolean;
  supportsServiceGiveback?: boolean;
}): string {
  if (caps?.supportsDineDonate) return "Dine & Donate";
  if (caps?.supportsShopDonate) return "Shop & Donate";
  if (caps?.supportsServiceGiveback) return "Booking Giveback";
  return "Local Giveback";
}

const AMBASSADOR_EMAIL =
  "Hi [name],\n\n" +
  "Our nonprofit is running a ForkUp campaign and we'd love your help. " +
  "Would you become a campaign ambassador? Ambassadors share our campaign with their own " +
  "network — friends, family, neighbors, and coworkers.\n\n" +
  "ForkUp gives you a personal campaign link, ready-to-use share copy, and gentle reminders, " +
  "so helping is quick and easy. Here's the campaign: [campaign link]\n\n" +
  "Thank you so much for considering it!";

const AMBASSADOR_TEXT =
  "Hi [name]! We're running a ForkUp campaign and would love your help as a campaign ambassador — " +
  "just sharing our link with your network. We'll send you the link and share copy. Here it is: [campaign link]. Thank you!";

const BARTENDER_EMAIL =
  "Hi [name],\n\n" +
  "We're hosting a guest bartending night as part of our ForkUp campaign, and we'd love for you to be a guest bartender. " +
  "Guest bartenders help promote the event beforehand and bring their own crowd to attend, tip, and donate.\n\n" +
  "You'll get a personal guest bartender link, share copy, and reminders to invite your network. " +
  "Here are the details: [campaign link]\n\n" +
  "Would you be up for it? Thank you!";

const BARTENDER_TEXT =
  "Hi [name]! Want to be a guest bartender for our ForkUp event? You'd help promote it and bring your crowd to attend, " +
  "tip, and donate via your guest bartender link. Details: [campaign link]. Let us know!";

/** Recruitment outreach cards — organizer-to-selected-people, not a public blast. */
const RECRUITMENT = [
  {
    id: "ambassadors",
    icon: Users,
    title: "Recruit Campaign Ambassadors",
    helper:
      "Use this to ask board members, volunteers, parents, alumni, donors, or other trusted supporters to become campaign ambassadors.",
    forWho: "Board members, volunteers, parents, alumni, past donors, team leaders",
    provides: "A ready-to-send email and text message asking them to become ambassadors.",
    explainer:
      "Ambassadors are people who agree to share your campaign with their own network. ForkUp gives them campaign links, share copy, and reminders so they can help drive support.",
    email: AMBASSADOR_EMAIL,
    text: AMBASSADOR_TEXT,
  },
  {
    id: "bartenders",
    icon: Users,
    title: "Recruit Guest Bartenders",
    helper:
      "Use this to invite specific people to guest bartend, promote the event, and bring their own crowd.",
    forWho: "Board members, local personalities, parents, alumni, staff, regulars, community supporters",
    provides: "A ready-to-send invitation email and text message explaining the guest bartending opportunity.",
    explainer:
      "Guest bartenders help promote the event before it happens and encourage their network to attend, tip, donate, or support their guest bartender link.",
    email: BARTENDER_EMAIL,
    text: BARTENDER_TEXT,
  },
];

// Future receipt-tracking engine — reserved space, not yet built.
const FUTURE_METRICS = [
  "Eligible Sales",
  "Receipts Uploaded",
  "Donation Pool",
  "Average Contribution",
  "Business Leaderboard",
];

export function CampaignDashboard() {
  const { state, goTo, selectedBusinesses, campaignStage, designMode, stageOverride, setStageOverride, update } =
    useCampaign();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewIds, setPreviewIds] = useState<Record<string, boolean>>({});
  const [apiDashboard, setApiDashboard] = useState<CampaignDashboardData | null>(null);

  useEffect(() => {
    if (!state.campaignSlug) return;

    const load = () => {
      fetchCampaignDashboard(state.campaignSlug!)
        .then((data) => {
          setApiDashboard(data);
          const startDate = toDateOnlyString(data.startDate);
          const endDate = toDateOnlyString(data.endDate);
          if (
            (startDate && startDate !== state.startDate) ||
            (endDate && endDate !== state.endDate)
          ) {
            update({
              ...(startDate ? { startDate } : {}),
              ...(endDate ? { endDate } : {}),
            });
          }
        })
        .catch(() => setApiDashboard(null));
    };

    load();

    const onUpdated = () => load();
    window.addEventListener("forkup-partner-invitation-updated", onUpdated);
    return () => window.removeEventListener("forkup-partner-invitation-updated", onUpdated);
  }, [state.campaignSlug, state.startDate, state.endDate, update]);

  // ---- Stage-driven section visibility (the Command Center adapts) ----
  // The client-derived stage can lag behind on a reopened campaign (it needs
  // termsAccepted + dates in memory). Prefer the real server status when we
  // have it; a Design Mode override still wins over everything.
  const serverStage: CampaignStage | null = (() => {
    switch (apiDashboard?.status) {
      case "draft":
        return "draft";
      case "invitation_phase":
        return "invitation";
      case "ready_to_launch":
        return "ready";
      case "live":
        return "live";
      case "closed":
        return "closed";
      case "settlement":
        return "settlement";
      default:
        return null;
    }
  })();
  const stage = stageOverride ?? serverStage ?? campaignStage;
  const stageMeta = CAMPAIGN_STAGE_META[stage];
  // Invitation tracking stays available after go-live so organizers can add partners.
  const showInvitationTracking =
    stage === "draft" || stage === "invitation" || stage === "ready" || stage === "live";
  // Performance KPIs only make sense once supporters can act (live onward).
  const showPerformance = stage === "live" || stage === "closed" || stage === "settlement";
  // Success Engine messaging is generated once the business list is finalized.
  const showSuccessEngine = stage === "ready" || stage === "live";
  // Receipt & sales tracking activates at launch and drives settlement.
  const showReceiptTracking = stage === "live" || stage === "closed" || stage === "settlement";
  // Empty-state guidance is for pre-live only; live can still add partners via CTA.
  const allowBusinessEmptyState = stage !== "live";
  const canAppendBusinessInvites =
    stage === "live" || stage === "invitation" || stage === "ready";
  /** Current campaign slug for the live /campaign/{slug}/ public page link. */
  const publicSlug = state.campaignSlug ?? apiDashboard?.slug ?? "";

  const togglePreview = (id: string) =>
    setPreviewIds((prev) => ({ ...prev, [id]: !prev[id] }));

  // ---- Business partner status counts (across curated + invited) ----
  const selectedStatuses: BusinessInviteStatus[] = selectedBusinesses.map(
    (b) => state.businessStatuses[b.id] ?? "pending",
  );
  const invitedStatuses: BusinessInviteStatus[] = state.invited.map((b) => b.status ?? "pending");
  const allStatuses = [...selectedStatuses, ...invitedStatuses];

  const invited = apiDashboard?.invitations.length ?? allStatuses.length;
  const accepted =
    apiDashboard?.invitations.filter((i) => i.acceptanceStatus === "accepted").length ??
    allStatuses.filter((s) => s === "accepted").length;
  const pending =
    apiDashboard?.invitations.filter((i) =>
      ["invited", "pending", "opened", "changes_requested", "needs_info"].includes(
        i.acceptanceStatus,
      ) || i.inviteStatus === "needs_info",
    ).length ?? allStatuses.filter((s) => s === "pending").length;
  const declined =
    apiDashboard?.invitations.filter((i) => i.acceptanceStatus === "declined").length ??
    allStatuses.filter((s) => s === "declined").length;
  const changesRequested =
    apiDashboard?.invitations.filter((i) => i.acceptanceStatus === "changes_requested").length ??
    allStatuses.filter((s) => s === "changes-requested").length;

  const raised = apiDashboard
    ? `$${apiDashboard.raised.toLocaleString()}`
    : state.goal
      ? state.goal
      : "$3,250";
  const businessesValue = invited > 0 ? String(accepted || invited) : "4";
  const supportersValue = apiDashboard
    ? String(apiDashboard.supportersGoing)
    : "82";
  const displayStartDate = toDateOnlyString(apiDashboard?.startDate) || state.startDate;
  const displayEndDate = toDateOnlyString(apiDashboard?.endDate) || state.endDate;
  const days = daysRemaining(displayEndDate);
  const daysValue = days != null ? String(days) : "18";

  // ---- Participating businesses (only accepted; business-specific content) ----
  const participationDates = ["June 18", "June 20–22", "June 1–30", "June 24", "June 26", "June 28"];
  const participatingBusinesses = [
    ...selectedBusinesses
      .filter((b) => (state.businessStatuses[b.id] ?? "pending") === "accepted")
      .map((b) => ({
        id: b.id,
        name: b.name,
        type: givebackLabelFor(b),
      })),
    ...state.invited
      .filter((b) => b.status === "accepted")
      .map((b, i) => ({
        id: `invited-${i}-${b.name}`,
        name: b.name,
        type: givebackLabelFor(b.capabilities),
      })),
  ].map((r, i) => ({ ...r, date: participationDates[i % participationDates.length] }));

  // ---- Conditional recruitment tools (only when the method is selected) ----
  const showAmbassadors = state.methods.ambassador;
  const showBartenders = state.methods.guestBartending;
  const visibleRecruitment = RECRUITMENT.filter(
    (r) => (r.id === "ambassadors" && showAmbassadors) || (r.id === "bartenders" && showBartenders),
  );



  const copyToolkit = async (id: string, body: string) => {
    try {
      await navigator.clipboard.writeText(body);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <main className="mx-auto max-w-4xl px-5 py-10 pb-24 sm:px-6 sm:py-12">
      <button
        onClick={() => goTo("created")}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to success screen
      </button>

      {/* Open the live /campaign/{slug}/ page (same as success screen / business dashboard). */}
      {publicSlug ? (
        <a
          href={campaignPublicPath(publicSlug)}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-6 ml-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold transition-colors hover:bg-secondary"
        >
          <ExternalLink className="size-4 text-primary" />
          View Public Campaign Page
        </a>
      ) : null}

      <div className="animate-rise mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Campaign Command Center</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">{state.title || "Your campaign"}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
              <span className="size-1.5 rounded-full bg-primary" />
              {stageMeta.label}
            </span>
            <span className="text-sm text-muted-foreground">
              {formatDate(displayStartDate)} → {formatDate(displayEndDate)}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{stageMeta.description}</p>
        </div>
      </div>

      {/* Quick links to live-data screens — driven by the real server status so
          they appear even when the client-derived stage lags behind. */}
      {(apiDashboard?.status === "live" ||
        apiDashboard?.status === "closed" ||
        apiDashboard?.status === "settlement") && (
        <div className="animate-rise mb-8 flex flex-wrap gap-3">
          <button
            onClick={() => goTo("analytics")}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-border bg-card px-5 text-sm font-semibold transition-colors hover:bg-secondary"
          >
            <BarChart3 className="size-4" /> View Analytics
          </button>
          <button
            onClick={() => goTo("receipt-ocr")}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-border bg-card px-5 text-sm font-semibold transition-colors hover:bg-secondary"
          >
            <ClipboardCheck className="size-4" /> Review Receipts
          </button>
          <button
            onClick={() => goTo("reporting")}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-border bg-card px-5 text-sm font-semibold transition-colors hover:bg-secondary"
          >
            View Settlement Report <ArrowRight className="size-4" />
          </button>
        </div>
      )}

      {/* ⚠️ Design Mode — preview each lifecycle stage without time travel. */}
      {designMode && (
        <div className="animate-rise mb-8 rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-primary">Design Mode · Preview Stage</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["draft", "invitation", "ready", "live", "closed", "settlement"] as CampaignStage[]).map((s) => {
              const active = stage === s;
              return (
                <button
                  key={s}
                  onClick={() => setStageOverride(s)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-card text-foreground hover:bg-secondary"
                  }`}
                >
                  {CAMPAIGN_STAGE_META[s].label}
                </button>
              );
            })}
            <button
              onClick={() => setStageOverride(null)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                stageOverride === null
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card text-foreground hover:bg-secondary"
              }`}
            >
              Auto
            </button>
          </div>
        </div>
      )}

      {/* Invitation deadline banner — gives nonprofits a clear acceptance cutoff. */}
      {stage === "invitation" && state.invitationCloseDate && (
        <div className="animate-rise mb-8 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
          <CalendarClock className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
              Businesses have until {formatDate(state.invitationCloseDate)} to accept.
            </p>
            <p className="mt-0.5 text-sm text-amber-800 dark:text-amber-300/90">
              Once this date passes, your participating business list is finalized and ForkUp prepares your launch
              messaging.
            </p>
          </div>
        </div>
      )}

      {/* Nick V2 Layer 6 — ready / pending / review / business action / SE next */}
      {apiDashboard?.visibility && (
        <div className="animate-rise mb-8">
          <CampaignVisibilityPanel
            visibility={apiDashboard.visibility}
            onOpenSuccessEngine={() => goTo("success-engine")}
          />
        </div>
      )}

      {/* SECTION 1 — Campaign Performance (live onward) */}
      {showPerformance && (
        <section className="animate-rise mb-8">
          <h2 className="mb-4 flex items-center gap-2 font-bold">
            <Activity className="size-4 text-primary" />
            Campaign Performance
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard icon={DollarSign} label="Campaign Raised" value={raised} />
            <MetricCard icon={Store} label="Participating Businesses" value={businessesValue} />
            <MetricCard icon={Users} label="Supporters Participating" value={supportersValue} />
            <MetricCard icon={CalendarClock} label="Days Remaining" value={daysValue} />
          </div>
        </section>
      )}

      {/* SECTION 2 — Business Partners (invitation tracking; pre-launch only) */}
      {showInvitationTracking && (
        <section className="animate-rise mb-8 rounded-3xl border border-border bg-card p-6 [animation-delay:60ms]">
          <h2 className="flex items-center gap-2 font-bold">
            <Store className="size-4 text-primary" />
            {stage === "ready" ? "Participating Businesses" : "Business Partners"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {stage === "live"
              ? "Track partners and invite additional businesses while your campaign is live."
              : stage === "ready"
                ? "Your business list is set for launch — you can still invite more partners."
                : "Track where your partner businesses stand."}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Stat label="Invited" value={invited} />
            <Stat label="Accepted" value={accepted} tone="good" />
            <Stat label="Awaiting acceptance" value={pending} tone="warn" />
            <Stat label="Declined" value={declined} />
            <Stat label="Requested Changes" value={changesRequested} tone="warn" />
          </div>
          {apiDashboard && apiDashboard.invitations.length > 0 && (
            <div className="mt-5 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Business invitation links
              </p>
              <p className="text-xs text-muted-foreground">
                Send each link only to that business&apos;s contact on file. They must sign in with that
                email to accept — opening the link alone is not enough.
              </p>
              {apiDashboard.invitations.map((inv) => (
                <div
                  key={inv.id}
                  className="flex flex-col gap-2 rounded-xl border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{inv.businessName}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <ApiAcceptanceStatusBadge
                        status={inv.acceptanceStatus}
                        inviteStatus={inv.inviteStatus}
                      />
                      {inv.respondByDate &&
                        ["invited", "pending", "opened"].includes(inv.acceptanceStatus) && (
                          <span className="text-xs text-muted-foreground">
                            Respond by {formatRespondByLabel(inv.respondByDate)}
                          </span>
                        )}
                      {inv.setupStatus &&
                        inv.acceptanceStatus === "accepted" &&
                        inv.setupStatus !== "pending" && (
                          <span className="text-xs text-muted-foreground">
                            {SETUP_STATUS_LABEL[inv.setupStatus as SetupStatus] ??
                              inv.setupStatus}
                          </span>
                        )}
                      {inv.marketingReadyStatus &&
                        inv.acceptanceStatus === "accepted" &&
                        inv.marketingReadyStatus !== "pending" && (
                          <span className="text-xs text-muted-foreground">
                            {MARKETING_READY_LABEL[
                              inv.marketingReadyStatus as MarketingReadyStatus
                            ] ?? inv.marketingReadyStatus}
                          </span>
                        )}
                      {inv.settlementReadyStatus &&
                        inv.acceptanceStatus === "accepted" &&
                        inv.settlementReadyStatus !== "pending" && (
                          <span className="text-xs text-muted-foreground">
                            {SETTLEMENT_READY_LABEL[
                              inv.settlementReadyStatus as SettlementReadyStatus
                            ] ?? inv.settlementReadyStatus}
                          </span>
                        )}
                    </div>
                    {inv.messageToBusiness && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Message: {inv.messageToBusiness}
                      </p>
                    )}
                    {inv.proposedTerms && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Proposed terms: {inv.proposedTerms}
                      </p>
                    )}
                    {(inv.acceptanceStatus === "changes_requested" ||
                      inv.inviteStatus === "needs_info") &&
                      inv.changeRequestMessage && (
                      <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
                        {inv.changeRequestMessage}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {inv.acceptanceStatus === "changes_requested" && (
                      <button
                        type="button"
                        onClick={() => {
                          const slug =
                            state.campaignSlug ?? apiDashboard?.slug ?? "";
                          if (!slug) return;
                          goTo("business-invite-flow", {
                            statePatch: { campaignSlug: slug },
                            query: {
                              campaign: slug,
                              invitation: String(inv.id),
                            },
                          });
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full border border-primary px-3 py-1.5 text-xs font-semibold text-primary"
                      >
                        Review changes
                      </button>
                    )}
                    {inv.acceptPath && (
                    <button
                      type="button"
                      onClick={() => {
                        const url =
                          typeof window !== "undefined"
                            ? `${window.location.origin}${inv.acceptPath}`
                            : inv.acceptPath!;
                        void navigator.clipboard.writeText(url);
                        setCopiedId(`inv-${inv.id}`);
                        setTimeout(() => setCopiedId(null), 2000);
                      }}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold"
                    >
                      {copiedId === `inv-${inv.id}` ? (
                        <Check className="size-3.5" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                      Copy invite link
                    </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {canAppendBusinessInvites && (
              <button
                type="button"
                onClick={() => {
                  const slug = state.campaignSlug ?? apiDashboard?.slug ?? "";
                  goTo("businesses", {
                    query: { appendInvites: "1" },
                    statePatch: {
                      selectedBusinessIds: [],
                      invited: state.invited.filter((b) => b.persisted),
                      ...(slug ? { campaignSlug: slug } : {}),
                    },
                  });
                }}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-dark"
              >
                Invite another business <ArrowRight className="size-4" />
              </button>
            )}
            <button
              onClick={() => {
                const slug = state.campaignSlug ?? apiDashboard?.slug;
                if (!slug) {
                  goTo("business-invite-flow");
                  return;
                }
                const changes = apiDashboard?.invitations.find(
                  (i) => i.acceptanceStatus === "changes_requested",
                );
                goTo("business-invite-flow", {
                  statePatch: { campaignSlug: slug },
                  query: {
                    campaign: slug,
                    invitation: changes ? String(changes.id) : undefined,
                  },
                });
              }}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-border bg-card px-5 text-sm font-semibold transition-colors hover:bg-secondary"
            >
              Track Business Partners <ArrowRight className="size-4" />
            </button>
          </div>
        </section>
      )}

      {(state.campaignSlug || apiDashboard?.slug) && (
        <div className="animate-rise mb-8 [animation-delay:80ms]">
          <BusinessEmailActions slug={state.campaignSlug || apiDashboard?.slug || ""} />
        </div>
      )}

      {/* SUCCESS ENGINE — scheduled promotion plan (ready + live) */}
      {showSuccessEngine && (
      <>
      <section className="animate-rise mb-3 [animation-delay:100ms]">
        <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
          <Sparkles className="size-5 text-primary" />
          Success Engine
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {stage === "ready"
            ? "Your business list is finalized — ForkUp has generated your campaign-ready messaging and schedule."
            : "ForkUp reminds you when it's time to post, email, text, or share."}
        </p>
      </section>


      {/* 1 — Scheduled Campaign Actions (the calendar / action queue) */}
      <section className="animate-rise mb-8 rounded-3xl border border-border bg-card p-6 [animation-delay:120ms]">
        <h3 className="flex items-center gap-2 font-bold">
          <CalendarClock className="size-4 text-primary" />
          Scheduled Campaign Actions
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          ForkUp gives you the right message at the right time. Preview, copy, or mark each action
          complete when you send it.
        </p>
        {state.campaignSlug ? (
          <div className="mt-4">
            <SuccessEngineActionList slug={state.campaignSlug} />
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {SCHEDULED_ACTIONS.map((c) => {
              const Icon = c.icon;
              const pill = STATUS_PILL[c.status];
              return (
                <li key={c.id} className="rounded-2xl border border-border bg-background p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <span className="flex items-center gap-2.5 text-sm font-semibold">
                      <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Icon className="size-4" />
                      </span>
                      <span>
                        <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {c.date}
                        </span>
                        {c.channel}
                      </span>
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${pill.className}`}
                    >
                      {pill.label}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{c.purpose}</p>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {state.campaignSlug && (
            <button
              type="button"
              onClick={() => goTo("success-engine")}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-border bg-card px-4 text-xs font-semibold transition-colors hover:bg-secondary"
            >
              Open full Success Engine <ArrowRight className="size-3.5" />
            </button>
          )}
        </div>
        <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Mail className="size-3.5" />
          Organizer reminders are sent by email when scheduled actions are ready.
        </p>
      </section>

      {/* 2 — Support Participating Businesses (only accepted; business-specific) */}
      <section className="animate-rise mb-8 rounded-3xl border border-border bg-card p-6 [animation-delay:140ms]">
        <h3 className="flex items-center gap-2 font-bold">
          <Store className="size-4 text-primary" />
          Support Participating Businesses
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Make sure your supporters know where to dine, shop, book, and give back throughout your campaign.
        </p>
        <ul className="mt-4 space-y-3">
          {participatingBusinesses.length === 0 && allowBusinessEmptyState && (
            <li className="rounded-2xl border border-dashed border-border bg-background p-5 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">No participating businesses yet.</p>
              <p className="mt-1">
                Once a business accepts your invitation, ForkUp will create ready-to-use email, text, and social content to
                help supporters know where to go and how to participate.
              </p>
            </li>
          )}
          {participatingBusinesses.map((b) => {
            const copied = copiedId === `participation-${b.id}`;
            return (
              <li key={b.id} className="rounded-2xl border border-border bg-background p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="text-sm font-semibold">{b.name}</span>
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${STATUS_PILL.ready.className}`}>
                    Ready
                  </span>
                </div>
                <p className="mt-1 text-sm font-medium text-primary">{b.type}</p>
                <p className="text-sm text-muted-foreground">{b.date}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Help supporters discover this business and participate.
                </p>
                {previewIds[`participation-${b.id}`] && (
                  <div className="mt-3 rounded-xl border border-border bg-card p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Supporter copy
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Support {b.name} during our ForkUp campaign! Visit and give back: [campaign link]. Thank you!
                    </p>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => togglePreview(`participation-${b.id}`)}
                    className="inline-flex h-9 items-center justify-center rounded-full border border-border bg-card px-4 text-xs font-semibold transition-colors hover:bg-secondary"
                  >
                    {previewIds[`participation-${b.id}`] ? "Hide" : "Preview"}
                  </button>
                  <button
                    onClick={() =>
                      copyToolkit(
                        `participation-${b.id}`,
                        `Support ${b.name} during our ForkUp campaign! Visit and give back: [campaign link]. Thank you!`,
                      )
                    }
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-border bg-card px-4 text-xs font-semibold transition-colors hover:bg-secondary"
                  >
                    {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                  <button className="inline-flex h-9 items-center justify-center rounded-full border border-border bg-card px-4 text-xs font-semibold transition-colors hover:bg-secondary">
                    Mark Shared
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* 3 — RECRUITMENT TOOLS — only shown when the related method is selected */}
      {visibleRecruitment.length > 0 && (
        <>
          <section className="animate-rise mb-3 [animation-delay:160ms]">
            <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
              <Users className="size-5 text-primary" />
              Recruitment Tools
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Reach out to specific, trusted people and ask them to help. This is separate from your general promotion.
            </p>
          </section>

          <div className="mb-8 space-y-4">
            {visibleRecruitment.map((r) => {
              const Icon = r.icon;
              const emailCopied = copiedId === `${r.id}-email`;
              const textCopied = copiedId === `${r.id}-text`;
              return (
                <section
                  key={r.id}
                  className="animate-rise rounded-3xl border border-border bg-card p-6 [animation-delay:180ms]"
                >
                  <h3 className="flex items-center gap-2 font-bold">
                    <Icon className="size-4 text-primary" />
                    {r.title}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">{r.helper}</p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border bg-background p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Who this is for
                      </p>
                      <p className="mt-1 text-sm">{r.forWho}</p>
                    </div>
                    <div className="rounded-2xl border border-border bg-background p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        What ForkUp provides
                      </p>
                      <p className="mt-1 text-sm">{r.provides}</p>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-muted-foreground">{r.explainer}</p>

                  {previewIds[`recruit-${r.id}`] && (
                    <div className="mt-3 space-y-3">
                      <div className="rounded-xl border border-border bg-background p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Email</p>
                        <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{r.email}</p>
                      </div>
                      <div className="rounded-xl border border-border bg-background p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Text</p>
                        <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{r.text}</p>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => togglePreview(`recruit-${r.id}`)}
                      className="inline-flex h-9 items-center justify-center rounded-full border border-border bg-card px-4 text-xs font-semibold transition-colors hover:bg-secondary"
                    >
                      {previewIds[`recruit-${r.id}`] ? "Hide" : "Preview"}
                    </button>
                    <button
                      onClick={() => copyToolkit(`${r.id}-email`, r.email)}
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-border bg-card px-4 text-xs font-semibold transition-colors hover:bg-secondary"
                    >
                      {emailCopied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      {emailCopied ? "Copied" : "Copy Email"}
                    </button>
                    <button
                      onClick={() => copyToolkit(`${r.id}-text`, r.text)}
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-border bg-card px-4 text-xs font-semibold transition-colors hover:bg-secondary"
                    >
                      {textCopied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      {textCopied ? "Copied" : "Copy Text"}
                    </button>
                    <button className="inline-flex h-9 items-center justify-center rounded-full border border-border bg-card px-4 text-xs font-semibold transition-colors hover:bg-secondary">
                      Mark Sent
                    </button>
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
      </>
      )}



      {/* SECTION 6 — Receipt & Sales Tracking (live onward) */}
      {showReceiptTracking && (
      <section className="animate-rise rounded-3xl border border-border bg-card p-6 [animation-delay:240ms]">
        <h2 className="flex items-center gap-2 font-bold">
          <DollarSign className="size-4 text-primary" />
          Receipt &amp; Sales Tracking
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {stage === "live"
            ? "Supporters upload receipts, OCR reads them, and eligible sales flow into your donation pool and leaderboard in real time."
            : "Final receipts and eligible sales for your campaign. Receipt uploads are now closed."}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {FUTURE_METRICS.map((label) => (
            <div key={label} className="rounded-xl border border-border bg-background p-3 text-center">
              <p className="text-xl font-extrabold text-foreground">—</p>
              <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </section>
      )}

      {/* SECTION 7 — Settlement Reporting (settlement stage; preparation when closed) */}
      {(stage === "closed" || stage === "settlement") && (
      <section className="animate-rise mt-8 rounded-3xl border border-border bg-card p-6 [animation-delay:260ms]">
        <h2 className="flex items-center gap-2 font-bold">
          <DollarSign className="size-4 text-primary" />
          {stage === "settlement" ? "Settlement Report" : "Settlement Preparation"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {stage === "settlement"
            ? "Your campaign is finalized. This is a read-only summary of donations, fees, and payout to your nonprofit."
            : "Your campaign has ended. ForkUp is reconciling final receipts and donations to prepare your settlement."}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Final Donation Amount", value: stage === "settlement" ? raised : "—" },
            { label: "Platform Fee", value: "—" },
            { label: "Net to Nonprofit", value: "—" },
            { label: "Payment Status", value: stage === "settlement" ? "Pending" : "—" },
          ].map((m) => (
            <div key={m.label} className="rounded-xl border border-border bg-background p-3 text-center">
              <p className="text-xl font-extrabold text-foreground">{m.value}</p>
              <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{m.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={() => goTo("reporting")}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-border bg-card px-5 text-sm font-semibold transition-colors hover:bg-secondary"
          >
            View Settlement Report <ArrowRight className="size-4" />
          </button>
          <button
            onClick={() => goTo("analytics")}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-border bg-card px-5 text-sm font-semibold transition-colors hover:bg-secondary"
          >
            <BarChart3 className="size-4" /> View Analytics
          </button>
        </div>
      </section>
      )}
    </main>
  );
}
