"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  ArrowRight,
  Megaphone,
  PlayCircle,
  ClipboardList,
  Store,
  CalendarClock,
  CheckCircle2,
  Loader2,
  Settings2,
  Trash2,
  ShieldCheck,
  Clock,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useCampaign } from "@/lib/campaign-context";
import { loadUserSession, syncAuthSession } from "@/lib/auth-session";
import { getAuthToken } from "@/lib/auth-storage";
import { useClientMounted } from "@/lib/use-client-mounted";
import { formatDateUs, formatDateTimeUs, looksLikeIsoDateTime } from "@/lib/date-only";
import {
  deleteManageCampaign,
  fetchManageCampaigns,
  fetchNonprofitPartnerUpdates,
  fetchNonprofitPendingInvites,
  publishCampaignNow,
  type ManageCampaignSummary,
  type NonprofitPartnerUpdate,
  type NonprofitPendingInvite,
} from "@/lib/api";
import {
  resolveDashboardDrafts,
  type CampaignTab,
} from "@/lib/nonprofit-dashboard-campaigns";
import {
  invalidateNonprofitDashboardCache,
  readNonprofitDashboardCache,
  writeNonprofitDashboardCache,
} from "@/lib/nonprofit-dashboard-cache";

type StatusTone = "live" | "draft" | "completed";

const STATUS_TONE: Record<StatusTone, string> = {
  live: "bg-primary/15 text-primary",
  draft: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  completed: "bg-secondary text-secondary-foreground",
};

function formatDateRange(start: string | null, end: string | null): string | undefined {
  const fmt = (d: string) =>
    looksLikeIsoDateTime(d) ? formatDateTimeUs(d) : formatDateUs(d);
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return `From ${fmt(start)}`;
  return undefined;
}

function statusTone(status: string): StatusTone {
  if (status === "live") return "live";
  if (status === "closed" || status === "settlement") return "completed";
  if (status === "ready_to_launch" || status === "invitation_phase") return "live";
  return "draft";
}

function statusLabel(status: string, startDate?: string | null): string {
  if (status === "ready_to_launch" && startDate) {
    const start = new Date(`${String(startDate).slice(0, 10)}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (start.getTime() > today.getTime()) {
      return `Scheduled · ${formatDateUs(String(startDate).slice(0, 10))}`;
    }
  }
  const labels: Record<string, string> = {
    live: "Live",
    draft: "Draft",
    invitation_phase: "Inviting businesses",
    ready_to_launch: "Scheduled",
    closed: "Completed",
    settlement: "Settlement",
  };
  return labels[status] ?? status;
}

function StatusPill({ label, tone }: { label: string; tone: StatusTone }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_TONE[tone]}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

function accountDisplayName(): string | null {
  const session = loadUserSession();
  if (!session?.email) return null;
  return session.email.split("@")[0];
}

export function NonprofitDashboard() {
  const {
    goTo,
    resumeCampaignBuilder,
    nonprofitName,
    state,
    update,
    discardLocalDraft,
    refreshServerDrafts,
    startNewCampaign,
    setNonprofitProfile,
  } = useCampaign();
  const [tab, setTab] = useState<CampaignTab>("active");
  const [campaigns, setCampaigns] = useState<ManageCampaignSummary[]>([]);
  const [pendingInvites, setPendingInvites] = useState<NonprofitPendingInvite[]>([]);
  const [partnerUpdates, setPartnerUpdates] = useState<NonprofitPartnerUpdate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishingSlug, setPublishingSlug] = useState<string | null>(null);
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);

  const nonprofitId = state.nonprofitProfile?.id;

  // Refresh verification / access-request status from the server on each visit.
  useEffect(() => {
    if (!getAuthToken()) return;
    void syncAuthSession(undefined, { force: true }).then((session) => {
      if (!session?.nonprofitProfile) return;
      setNonprofitProfile(session.nonprofitProfile);
    });
  }, [setNonprofitProfile]);

  const refreshCampaigns = useCallback(() => {
    if (!nonprofitId) return;
    invalidateNonprofitDashboardCache(nonprofitId);
    setLoading(true);
    void fetchManageCampaigns(nonprofitId)
      .then((camps) => {
        setCampaigns(camps);
        setLoading(false);
        void refreshServerDrafts();
        void fetchNonprofitPendingInvites(nonprofitId)
          .then((invites) => {
            setPendingInvites(invites);
            writeNonprofitDashboardCache(nonprofitId, { campaigns: camps, invites });
          })
          .catch(() => setPendingInvites([]));
        void fetchNonprofitPartnerUpdates(nonprofitId)
          .then(setPartnerUpdates)
          .catch(() => setPartnerUpdates([]));
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load campaigns");
        setLoading(false);
      });
  }, [nonprofitId, refreshServerDrafts]);

  const publishNow = useCallback(
    async (slug: string) => {
      setPublishingSlug(slug);
      setError(null);
      try {
        await publishCampaignNow(slug);
        refreshCampaigns();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to publish campaign");
      } finally {
        setPublishingSlug(null);
      }
    },
    [refreshCampaigns],
  );

  const deleteCampaign = useCallback(
    async (campaign: ManageCampaignSummary) => {
      const tabLabel = tab === "active" ? "active" : tab === "completed" ? "completed" : "draft";
      const liveWarning =
        campaign.status === "live" || campaign.status === "invitation_phase"
          ? " This campaign is live or in progress."
          : "";
      const message = `Delete "${campaign.name}"? This ${tabLabel} campaign and all related data will be permanently removed.${liveWarning}`;
      if (!window.confirm(message)) return;

      setDeletingSlug(campaign.slug);
      setError(null);
      try {
        await deleteManageCampaign(campaign.slug);
        setCampaigns((prev) => prev.filter((c) => c.slug !== campaign.slug));
        if (nonprofitId) {
          const cached = readNonprofitDashboardCache(nonprofitId);
          if (cached) {
            writeNonprofitDashboardCache(nonprofitId, {
              campaigns: cached.campaigns.filter((c) => c.slug !== campaign.slug),
              invites: cached.invites,
            });
          }
        }
        discardLocalDraft({ slug: campaign.slug, force: true });
        await refreshServerDrafts();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete campaign");
      } finally {
        setDeletingSlug(null);
      }
    },
    [tab, nonprofitId, discardLocalDraft, refreshServerDrafts],
  );

  const mounted = useClientMounted();
  const isSignedIn = mounted && Boolean(getAuthToken());
  const accountName = mounted ? accountDisplayName() : null;
  const orgName = nonprofitName || state.nonprofitProfile?.organizationName || "Your organization";
  const greetingName =
    accountName ?? (state.nonprofitProfile?.contactName?.trim() || orgName);

  useEffect(() => {
    if (!nonprofitId) {
      setCampaigns([]);
      setPendingInvites([]);
      setPartnerUpdates([]);
      setLoading(false);
      setError(null);
      return;
    }

    const cached = readNonprofitDashboardCache(nonprofitId);
    if (cached) {
      setCampaigns(cached.campaigns);
      setPendingInvites(cached.invites);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);

    let cancelled = false;

    void fetchManageCampaigns(nonprofitId)
      .then((camps) => {
        if (cancelled) return;
        setCampaigns(camps);
        setLoading(false);
        void refreshServerDrafts();
        writeNonprofitDashboardCache(nonprofitId, { campaigns: camps, invites: [] });

        void fetchNonprofitPendingInvites(nonprofitId)
          .then((invites) => {
            if (cancelled) return;
            setPendingInvites(invites);
            writeNonprofitDashboardCache(nonprofitId, { campaigns: camps, invites });
          })
          .catch(() => {
            if (!cancelled) setPendingInvites([]);
          });
        void fetchNonprofitPartnerUpdates(nonprofitId)
          .then((updates) => {
            if (!cancelled) setPartnerUpdates(updates);
          })
          .catch(() => {
            if (!cancelled) setPartnerUpdates([]);
          });
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load campaigns");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [nonprofitId, refreshServerDrafts]);

  useEffect(() => {
    if (!nonprofitId) return;
    const refresh = () => {
      invalidateNonprofitDashboardCache(nonprofitId);
      void fetchManageCampaigns(nonprofitId)
        .then((camps) => {
          setCampaigns(camps);
          writeNonprofitDashboardCache(nonprofitId, {
            campaigns: camps,
            invites: pendingInvites,
          });
        })
        .catch(() => {});
      void fetchNonprofitPartnerUpdates(nonprofitId)
        .then(setPartnerUpdates)
        .catch(() => setPartnerUpdates([]));
    };
    window.addEventListener("forkup-partner-invitation-updated", refresh);
    return () => window.removeEventListener("forkup-partner-invitation-updated", refresh);
  }, [nonprofitId, pendingInvites]);

  const openCampaign = useCallback(
    (slug: string, step: "dashboard" | "reporting" | "builder" = "dashboard") => {
      if (step === "builder") {
        void resumeCampaignBuilder(slug).catch((err) => {
          setError(err instanceof Error ? err.message : "Failed to open campaign setup");
        });
        return;
      }
      update({ campaignSlug: slug });
      goTo(step);
    },
    [update, goTo, resumeCampaignBuilder],
  );

  const { grouped, draftItems, draftCount } = useMemo(
    () => resolveDashboardDrafts(campaigns),
    [campaigns],
  );

  useEffect(() => {
    if (loading) return;
    if (tab !== "active") return;
    if (grouped.active.length > 0) return;
    if (draftCount > 0) setTab("drafts");
  }, [loading, tab, grouped.active.length, draftCount]);

  const changesRequested = useMemo(
    () => partnerUpdates.filter((p) => p.acceptanceStatus === "changes_requested"),
    [partnerUpdates],
  );

  const awaitingPartners = useMemo(
    () =>
      partnerUpdates.filter((p) =>
        ["invited", "pending"].includes(p.acceptanceStatus),
      ),
    [partnerUpdates],
  );

  const summary = useMemo(
    () => [
      { label: "Active Campaigns", value: String(grouped.active.length), icon: PlayCircle },
      { label: "Draft Campaigns", value: String(draftCount), icon: ClipboardList },
      {
        label: "Pending Invites",
        value: String(pendingInvites.length + partnerUpdates.length),
        icon: Store,
      },
    ],
    [grouped.active.length, draftCount, pendingInvites.length],
  );

  const nextSteps = useMemo(() => {
    const items: {
      id: string;
      icon: LucideIcon;
      campaign: string;
      label: string;
      cta: string;
      action: () => void;
    }[] = [];

    for (const inv of pendingInvites.slice(0, 2)) {
      items.push({
        id: `pending-invite-${inv.token}`,
        icon: Store,
        campaign: inv.campaignName,
        label: `${inv.businessName} invited you to ${inv.methodName}`,
        cta: "Review invitation",
        action: () => {
          window.location.href = inv.acceptPath;
        },
      });
    }

    for (const partnerUpdate of changesRequested.slice(0, 2)) {
      if (items.length >= 3) break;
      items.push({
        id: `changes-${partnerUpdate.id}`,
        icon: Store,
        campaign: partnerUpdate.campaignName,
        label: `${partnerUpdate.businessName} requested changes to your invitation`,
        cta: "Review changes",
        action: () => {
          goTo("business-invite-flow", {
            statePatch: { campaignSlug: partnerUpdate.campaignSlug },
            query: {
              campaign: partnerUpdate.campaignSlug,
              invitation: String(partnerUpdate.id),
            },
          });
        },
      });
    }

    for (const partnerUpdate of awaitingPartners.slice(0, 2)) {
      if (items.length >= 3) break;
      if (changesRequested.some((c) => c.campaignSlug === partnerUpdate.campaignSlug)) continue;
      items.push({
        id: `awaiting-${partnerUpdate.id}`,
        icon: Store,
        campaign: partnerUpdate.campaignName,
        label: `Waiting on ${partnerUpdate.businessName} to accept your invitation`,
        cta: "Track partners",
        action: () => openCampaign(partnerUpdate.campaignSlug, "dashboard"),
      });
    }

    const preLaunch = grouped.active.find(
      (c) => c.status === "invitation_phase" || c.status === "ready_to_launch",
    );
    if (preLaunch && items.length < 3) {
      items.push({
        id: `prelaunch-${preLaunch.slug}`,
        icon: Megaphone,
        campaign: preLaunch.name,
        label:
          preLaunch.status === "invitation_phase"
            ? "Waiting on business partners to accept"
            : `Scheduled for ${formatDateRange(preLaunch.startDate, preLaunch.endDate) ?? "start date"} — publish early or wait`,
        cta: preLaunch.status === "invitation_phase" ? "Track partners" : "Go live now",
        action: () =>
          preLaunch.status === "invitation_phase"
            ? openCampaign(preLaunch.slug, "dashboard")
            : void publishNow(preLaunch.slug),
      });
    }

    for (const draft of draftItems) {
      if (items.length >= 3) break;
      items.push({
        id: `draft-${draft.campaign.slug}`,
        icon: ClipboardList,
        campaign: draft.campaign.name,
        label: "Complete campaign details and launch",
        cta: "Open draft",
        action: () => openCampaign(draft.campaign.slug, "builder"),
      });
    }

    return items.slice(0, 3);
  }, [pendingInvites, partnerUpdates, changesRequested, awaitingPartners, draftItems, grouped.active, openCampaign, publishNow, update, goTo]);

  const renderCampaignCard = (
    c: ManageCampaignSummary,
    options: { isDraftTab: boolean; isCompleted: boolean },
  ) => {
    const tone = statusTone(c.status);
    const dates = formatDateRange(c.startDate, c.endDate);
    return (
      <div key={c.slug} className="flex flex-col rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-base font-bold leading-snug">{c.name}</h3>
          <div className="flex shrink-0 items-center gap-2">
            <StatusPill label={statusLabel(c.status, c.startDate)} tone={tone} />
            <button
              type="button"
              aria-label={`Delete ${c.name}`}
              disabled={deletingSlug === c.slug || publishingSlug === c.slug}
              onClick={() => void deleteCampaign(c)}
              className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
            >
              {deletingSlug === c.slug ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
            </button>
          </div>
        </div>
        {dates && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarClock className="size-3.5" />
            {dates}
          </p>
        )}
        {(c.partnersInvited ?? 0) > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Business partners: {c.partnersInvited} invited
            {(c.partnersPending ?? 0) > 0 ? ` · ${c.partnersPending} awaiting` : ""}
            {(c.partnersChangesRequested ?? 0) > 0
              ? ` · ${c.partnersChangesRequested} requested changes`
              : ""}
          </p>
        )}
        <p className="mt-3 text-sm">
          <span className="text-muted-foreground">Raised: </span>
          <span className="font-extrabold text-primary">${Number(c.raised).toLocaleString()}</span>
          {c.goal > 0 && (
            <span className="text-muted-foreground">
              {" "}
              / ${Number(c.goal).toLocaleString()} goal
            </span>
          )}
        </p>
        {c.status === "ready_to_launch" && (
          <p className="mt-2 text-xs text-muted-foreground">
            Setup is complete. Your campaign will appear in the public directory on the start date,
            or you can publish it now.
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {c.status === "ready_to_launch" && (
            <button
              type="button"
              disabled={publishingSlug === c.slug}
              onClick={() => void publishNow(c.slug)}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-dark active:scale-95 disabled:opacity-60"
            >
              {publishingSlug === c.slug ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  Go live now <ArrowRight className="size-4" />
                </>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              openCampaign(
                c.slug,
                options.isDraftTab ? "builder" : options.isCompleted ? "reporting" : "dashboard",
              )
            }
            className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-5 text-sm font-semibold transition-all active:scale-95 ${
              c.status === "ready_to_launch"
                ? "border border-border bg-card font-semibold text-foreground hover:bg-secondary"
                : "bg-primary text-primary-foreground hover:bg-primary-dark"
            }`}
          >
            {options.isDraftTab
              ? "Continue setup"
              : options.isCompleted
                ? "View results"
                : "View dashboard"}{" "}
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    );
  };

  const tabIsEmpty =
    tab === "drafts" ? draftItems.length === 0 : grouped[tab].length === 0;

  if (!nonprofitId) {
    return (
      <main className="mx-auto max-w-lg px-5 py-12 text-center">
        <p className="text-muted-foreground">
          {isSignedIn
            ? accountName
              ? `Hi ${accountName} — set up your nonprofit organization to see your dashboard.`
              : "Set up your nonprofit organization to see your dashboard."
            : "Sign in and set up your nonprofit profile to see your dashboard."}
        </p>
        <button
          type="button"
          onClick={() => goTo(isSignedIn ? "nonprofit-claim" : "auth-login")}
          className="mt-4 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
        >
          {isSignedIn ? "Set up organization" : "Sign in"}
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 pb-24 sm:px-6 sm:py-12">
      <div className="animate-rise flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Your fundraising home base
          </p>
          <h1 className="font-display mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Welcome back, {greetingName}
          </h1>
          {state.nonprofitProfile?.verificationStatus === "verified" ? (
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <ShieldCheck className="size-3.5" />
              Verified organization
            </span>
          ) : state.nonprofitProfile?.accessRequestStatus === "denied" ? (
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-800 dark:bg-rose-950 dark:text-rose-300">
              <XCircle className="size-3.5" />
              Verification denied
            </span>
          ) : state.nonprofitProfile?.verificationStatus === "needs_review" ||
            state.nonprofitProfile?.accessRequestStatus === "pending" ? (
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              <Clock className="size-3.5" />
              Verification pending
            </span>
          ) : null}
          {accountName && orgName && orgName !== greetingName && (
            <p className="mt-1 text-base font-medium text-foreground/80">{orgName}</p>
          )}
          <p className="mt-2 max-w-xl text-muted-foreground">
            {accountName && orgName !== greetingName
              ? `Track campaigns for ${orgName}, respond to business invitations, and keep momentum moving.`
              : "Track your campaigns, respond to business invitations, and keep momentum moving."}
          </p>
          <div className="mt-4 flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-2">
            <button
              type="button"
              onClick={() => goTo("nonprofit-claim")}
              className="inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-primary-dark"
            >
              <Settings2 className="size-4 shrink-0" />
              Edit organization profile
            </button>
            <span className="hidden h-4 w-px bg-border sm:block" aria-hidden />
            <button
              type="button"
              onClick={() => goTo("account-hub")}
              className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-primary"
            >
              Switch role — add business or supporter
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            startNewCampaign();
          }}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-dark active:scale-95"
        >
          <Plus className="size-4" />
          Create New Campaign
        </button>
      </div>

      {loading && (
        <div className="mt-12 flex justify-center py-8">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      )}

      {error && <p className="mt-6 text-sm text-destructive">{error}</p>}

      {!loading && (
        <>
          {pendingInvites.length > 0 && (
            <section className="animate-rise mt-8 rounded-3xl border border-primary/30 bg-primary/5 p-6">
              <h2 className="font-display text-lg font-bold tracking-tight">
                Invitations from businesses
              </h2>
              <ul className="mt-4 space-y-3">
                {pendingInvites.map((inv) => (
                  <li
                    key={inv.token}
                    className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-semibold">{inv.campaignName}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {inv.businessName} · {inv.methodName} · {inv.givebackPercentage}% giveback
                      </p>
                    </div>
                    <a
                      href={inv.acceptPath}
                      className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
                    >
                      Review <ArrowRight className="size-3.5" />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {partnerUpdates.length > 0 && (
            <section className="animate-rise mt-8 rounded-3xl border border-amber-500/30 bg-amber-500/5 p-6">
              <h2 className="font-display text-lg font-bold tracking-tight">
                Business partner updates
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Track invitations you sent and respond when a business requests changes.
              </p>
              <ul className="mt-4 space-y-3">
                {partnerUpdates.map((p) => (
                  <li
                    key={`${p.campaignSlug}-${p.id}`}
                    className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold">{p.businessName}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {p.campaignName} · {p.methodName} · {p.givebackPercentage}% giveback
                      </p>
                      {p.acceptanceStatus === "changes_requested" && p.changeRequestMessage && (
                        <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">
                          &ldquo;{p.changeRequestMessage}&rdquo;
                        </p>
                      )}
                      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {p.acceptanceStatus === "changes_requested"
                          ? "Changes requested"
                          : "Awaiting acceptance"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (p.acceptanceStatus === "changes_requested") {
                          goTo("business-invite-flow", {
                            statePatch: { campaignSlug: p.campaignSlug },
                            query: {
                              campaign: p.campaignSlug,
                              invitation: String(p.id),
                            },
                          });
                        } else {
                          openCampaign(p.campaignSlug, "dashboard");
                        }
                      }}
                      className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
                    >
                      {p.acceptanceStatus === "changes_requested" ? "Review changes" : "View campaign"}{" "}
                      <ArrowRight className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="animate-rise mt-8 rounded-3xl border border-border bg-card p-6">
            <h2 className="font-display text-lg font-bold tracking-tight">Next Steps</h2>
            {nextSteps.length > 0 ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {nextSteps.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.id}
                      className="flex flex-col rounded-2xl border border-border bg-background p-4"
                    >
                      <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Icon className="size-4" />
                      </span>
                      <p className="mt-3 text-sm font-semibold leading-snug">{item.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{item.campaign}</p>
                      <button
                        type="button"
                        onClick={item.action}
                        className="mt-3 inline-flex items-center gap-1.5 self-start text-sm font-semibold text-primary transition-colors hover:text-primary-dark"
                      >
                        {item.cta} <ArrowRight className="size-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                <CheckCircle2 className="size-4" />
                You&apos;re all caught up.
              </p>
            )}
          </section>

          <section className="animate-rise mt-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-2xl font-extrabold tracking-tight">My Campaigns</h2>
              <div className="inline-flex rounded-full border border-border bg-card p-1">
                {(
                  [
                    { id: "active" as const, label: "Active" },
                    {
                      id: "drafts" as const,
                      label: draftCount > 0 ? `Drafts (${draftCount})` : "Drafts",
                    },
                    { id: "completed" as const, label: "Completed" },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                      tab === t.id
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {tab === "drafts"
                ? draftItems.map((item) =>
                    renderCampaignCard(item.campaign, { isDraftTab: true, isCompleted: false }),
                  )
                : grouped[tab].map((c) =>
                    renderCampaignCard(c, {
                      isDraftTab: false,
                      isCompleted: tab === "completed",
                    }),
                  )}
              {tabIsEmpty && (
                <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground sm:col-span-2">
                  No campaigns in this tab yet.{" "}
                  <button
                    type="button"
                    onClick={() => startNewCampaign()}
                    className="font-semibold text-primary"
                  >
                    Create one
                  </button>
                </div>
              )}
            </div>
          </section>

          <section className="animate-rise mt-10">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              At a Glance
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {summary.map(({ label, value, icon: Icon }) => (
                <div
                  key={label}
                  className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5"
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-base font-bold leading-tight">{value}</p>
                    <p className="truncate text-[11px] font-medium text-muted-foreground">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
