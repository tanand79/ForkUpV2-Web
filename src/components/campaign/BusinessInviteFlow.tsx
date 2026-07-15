import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Bell,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  Heart,
  Loader2,
  Megaphone,
  MessageSquareText,
  Pencil,
  Percent,
  Send,
  XCircle,
} from "lucide-react";

import { useCampaign } from "@/lib/campaign-context";
import type { BusinessChangeRequest } from "@/lib/campaign-context";
import { formatDateOnlyLabel } from "@/lib/date-only";
import { displayChangeRequestFields } from "@/lib/invite-change-request";
import { usePartnerInvitation } from "@/hooks/use-partner-invitation";
import { acceptPartnerInvitationChanges } from "@/lib/api";
import { invalidateNonprofitDashboardCache } from "@/lib/nonprofit-dashboard-cache";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Business Invite Status — a focused status page that answers one question:
 * "Where does this invitation stand?" It shows who was invited, to which
 * campaign, the current status, and the actions available for that status.
 *
 * Statuses surfaced (driven by the `BusinessInviteStatus` model):
 *   • Awaiting Response            — waiting on the business. Send reminder / edit.
 *   • Updated — Awaiting Confirmation — material edit resent for re-confirmation.
 *   • Changes Requested            — business replied asking for different terms.
 *                                    Shows what they asked for + accept / edit.
 *   • Accepted                     — now appears on the public campaign page.
 *   • Declined                     — will not appear publicly.
 */

type InviteView =
  | "awaiting"
  | "updated"
  | "changes-requested"
  | "accepted"
  | "declined";

function mapStatusToView(status: string | undefined): InviteView {
  switch (status) {
    case "accepted":
      return "accepted";
    case "declined":
      return "declined";
    case "changes-requested":
    case "changes_requested":
      return "changes-requested";
    default:
      return "awaiting";
  }
}

export function BusinessInviteFlow() {
  const { state, goTo, setInvitedStatus } = useCampaign();
  const {
    campaignSlug,
    invitation: apiInvitation,
    apiDashboard,
    loading,
    error,
    reload,
  } = usePartnerInvitation();

  const targetIndex = useMemo(() => {
    const email = apiInvitation?.businessEmail?.trim().toLowerCase();
    if (email) {
      const byEmail = state.invited.findIndex(
        (b) => b.email?.trim().toLowerCase() === email,
      );
      if (byEmail >= 0) return byEmail;
    }
    return -1;
  }, [state.invited, apiInvitation?.businessEmail]);

  const businessName = apiInvitation?.businessName ?? "";
  const campaign = apiDashboard?.name ?? "";
  const method = apiInvitation?.methodName ?? "";
  const inviteSentLabel = apiInvitation?.invitedAt
    ? formatDateOnlyLabel(String(apiInvitation.invitedAt), {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "recently";
  const changeRequestDisplay = displayChangeRequestFields(
    apiInvitation?.changeRequestMessage,
  );
  const changeRequest = changeRequestDisplay.parsed;

  const [view, setView] = useState<InviteView>(() =>
    mapStatusToView(apiInvitation?.acceptanceStatus),
  );
  useEffect(() => {
    setView(mapStatusToView(apiInvitation?.acceptanceStatus));
  }, [apiInvitation?.acceptanceStatus]);

  const [statusMessage, setStatusMessage] = useState(
    `Invitation sent ${inviteSentLabel}. No action is required right now. You can send a reminder at any time.`,
  );

  useEffect(() => {
    setStatusMessage(
      `Invitation sent ${inviteSentLabel}. No action is required right now. You can send a reminder at any time.`,
    );
  }, [inviteSentLabel]);

  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderSent, setReminderSent] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  const changesRef = useRef<HTMLDivElement | null>(null);

  // If we just returned from the Edit Business Invite screen, surface the right
  // confirmation depending on whether the change was safe or material.
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem("forkup-invite-updated") === "1") {
        const kind = window.sessionStorage.getItem("forkup-invite-update-type");
        window.sessionStorage.removeItem("forkup-invite-updated");
        window.sessionStorage.removeItem("forkup-invite-update-type");

        if (kind === "material") {
          setView("updated");
          setStatusMessage(
            `${businessName} has been sent updated campaign details.`,
          );
          setSuccessMessage("Updated invitation sent for confirmation.");
        } else {
          setSuccessMessage("Invitation updated.");
        }
        setShowSuccess(true);
      }
    } catch {
      /* ignore storage errors */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirmReminder = () => {
    setReminderSent(true);
    setReminderOpen(false);
    setSuccessMessage(`Reminder sent to ${businessName}.`);
    setShowSuccess(true);
  };

  // Accept the business-requested terms: persist to API and refresh dashboards.
  const acceptChanges = async () => {
    if (!campaignSlug || !apiInvitation) return;
    setAccepting(true);
    setAcceptError(null);
    try {
      await acceptPartnerInvitationChanges(campaignSlug, apiInvitation.id);
      const nonprofitId = state.nonprofitProfile?.id;
      if (nonprofitId) invalidateNonprofitDashboardCache(nonprofitId);
      if (targetIndex >= 0) setInvitedStatus(targetIndex, "accepted");
      reload();
      setView("accepted");
      setSuccessMessage(`Changes accepted. ${businessName} is now confirmed.`);
      setShowSuccess(true);
      window.dispatchEvent(new CustomEvent("forkup-partner-invitation-updated"));
    } catch (err) {
      setAcceptError(err instanceof Error ? err.message : "Failed to accept changes");
    } finally {
      setAccepting(false);
    }
  };

  const navigateToEditInvite = () => {
    if (campaignSlug && apiInvitation) {
      goTo("edit-invite", {
        statePatch: { campaignSlug },
        query: {
          campaign: campaignSlug,
          invitation: String(apiInvitation.id),
        },
      });
      return;
    }
    goTo("edit-invite");
  };

  // Edit & Resend: hand the business-requested terms to the edit screen so the
  // nonprofit can review and adjust before sending an updated invitation.
  const editAndResend = () => {
    try {
      if (changeRequest) {
        window.sessionStorage.setItem(
          "forkup-invite-prefill",
          JSON.stringify(changeRequest),
        );
      }
    } catch {
      /* ignore storage errors */
    }
    navigateToEditInvite();
  };

  const reviewChanges = () => {
    if (
      view !== "changes-requested" &&
      apiInvitation?.acceptanceStatus === "changes_requested"
    ) {
      setView("changes-requested");
    }
    window.requestAnimationFrame(() => {
      changesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  useEffect(() => {
    if (apiInvitation?.acceptanceStatus !== "changes_requested") return;
    const timer = window.setTimeout(() => {
      changesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [apiInvitation?.id, apiInvitation?.acceptanceStatus]);

  const backTarget = campaignSlug ? "dashboard" : "businesses";

  // ---- Status chip styling per view ----
  const statusChip = {
    awaiting: {
      label: "Awaiting Response",
      cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
      icon: Bell,
    },
    updated: {
      label: "Updated — Awaiting Confirmation",
      cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
      icon: Bell,
    },
    "changes-requested": {
      label: "Changes Requested",
      cls: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
      icon: MessageSquareText,
    },
    accepted: {
      label: "Accepted",
      cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
      icon: CheckCircle2,
    },
    declined: {
      label: "Declined",
      cls: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
      icon: XCircle,
    },
  }[view];

  const ChipIcon = statusChip.icon;

  const preferredDate = changeRequestDisplay.preferredDateLabel;

  if (!campaignSlug) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-16 text-center text-sm text-muted-foreground">
        Open this screen from your campaign dashboard to review a business invitation.
      </main>
    );
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-[50vh] max-w-3xl items-center justify-center px-5">
        <Loader2 className="size-8 animate-spin text-primary" />
      </main>
    );
  }

  if (!apiInvitation) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-16 text-center">
        <p className="text-sm text-destructive">
          {error ?? "Invitation not found for this campaign."}
        </p>
        <button
          type="button"
          onClick={() => goTo("dashboard")}
          className="mt-4 text-sm font-medium text-primary hover:underline"
        >
          Back to campaign
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 pb-24 sm:px-6 sm:py-12">
      <button
        onClick={() => goTo(backTarget)}
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {campaignSlug ? "Back to campaign" : "Back to businesses"}
      </button>

      <div className="animate-rise mb-8">
        <h1 className="font-display text-3xl font-bold leading-[1.12] tracking-tight sm:text-4xl">
          Invitation Status
        </h1>
        <p className="mt-3 max-w-[60ch] text-pretty text-base text-muted-foreground">
          {loading
            ? "Loading invitation details…"
            : error
              ? error
              : !campaignSlug
              ? "Open this screen from your campaign dashboard to review a business partner invitation."
              : view === "changes-requested"
                ? "This business replied with requested changes. Review what they asked for below and choose how to respond."
                : "We’ll update the status automatically as this business responds to your invitation."}
        </p>
      </div>

      {/* Primary status card */}
      <div className="animate-rise rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Business
            </p>
            <h2 className="mt-1 text-2xl font-bold leading-tight">{businessName}</h2>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${statusChip.cls}`}
          >
            <ChipIcon className="size-3.5" />
            {statusChip.label}
          </span>
        </div>

        <div className="mt-6 divide-y divide-border rounded-2xl border border-border bg-background px-4">
          <DetailRow icon={Megaphone} label="Campaign" value={campaign} />
          <DetailRow icon={Heart} label="Fundraising method" value={method} />
          <DetailRow icon={Send} label="Invitation sent" value={inviteSentLabel} />
          <DetailRow
            icon={Bell}
            label="Reminder sent"
            value={reminderSent ? "Yes" : "No"}
          />
        </div>

        {view === "accepted" ? (
          <p className="mt-5 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            This business now appears on your campaign page.
          </p>
        ) : view === "declined" ? (
          <p className="mt-5 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            This business will not appear publicly on your campaign page.
          </p>
        ) : (
          <p className="mt-5 rounded-2xl bg-secondary px-4 py-3 text-sm font-medium text-muted-foreground">
            Once {businessName} confirms participation, they’ll automatically
            appear on your campaign page for supporters to discover and support.
          </p>
        )}
      </div>

      {/* Changes-requested detail section */}
      {view === "changes-requested" && (
        <div
          ref={changesRef}
          className="animate-rise mt-4 rounded-3xl border border-blue-200 bg-blue-50/70 p-6 dark:border-blue-900/60 dark:bg-blue-950/30 sm:p-8"
        >
          <div className="flex items-start gap-3">
            <MessageSquareText className="mt-0.5 size-5 shrink-0 text-blue-600 dark:text-blue-400" />
            <div>
              <h3 className="text-lg font-bold text-blue-900 dark:text-blue-200">
                Business requested changes
              </h3>
              <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                {businessName} requested changes to this invitation.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <RequestRow
              icon={CalendarClock}
              label="Preferred Date / Time"
              value={preferredDate ?? "No preference provided"}
            />
            <RequestRow
              icon={Percent}
              label="Preferred Giveback"
              value={
                changeRequestDisplay.preferredGivebackLabel ?? "No preference provided"
              }
            />
            <RequestRow
              icon={MessageSquareText}
              label="Message"
              value={
                changeRequestDisplay.messageLabel
                  ? `“${changeRequestDisplay.messageLabel}”`
                  : "No message provided"
              }
            />
          </div>
        </div>
      )}

      {/* Status banner — awaiting / updated only */}
      {(view === "awaiting" || view === "updated") && (
        <div className="animate-rise mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/40">
          <Clock className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              {statusChip.label}
            </p>
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
              {statusMessage}
            </p>
          </div>
        </div>
      )}

      {showSuccess && (
        <p className="animate-rise mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
          <Check className="size-4" />
          {successMessage}
        </p>
      )}

      {acceptError && (
        <p className="animate-rise mt-4 text-sm text-destructive">{acceptError}</p>
      )}

      {/* Actions — vary by status */}
      <div className="mt-7 flex flex-wrap items-center gap-3">
        {view === "changes-requested" ? (
          <>
            <button
              type="button"
              onClick={() => void acceptChanges()}
              disabled={accepting}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary-dark active:scale-95 disabled:opacity-60"
            >
              {accepting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              Accept Changes
            </button>
            <button
              onClick={editAndResend}
              className="inline-flex h-12 items-center gap-2 rounded-full border border-border px-5 text-sm font-medium transition-colors hover:bg-secondary"
            >
              <Pencil className="size-4" />
              Edit & Resend
            </button>
            <button
              onClick={reviewChanges}
              className="inline-flex h-12 items-center gap-2 rounded-full border border-border px-5 text-sm font-medium transition-colors hover:bg-secondary"
            >
              <MessageSquareText className="size-4" />
              Review Changes
            </button>
          </>
        ) : view === "accepted" || view === "declined" ? (
          <button
            onClick={() => goTo(backTarget)}
            className="inline-flex h-12 items-center gap-2 rounded-full border border-border px-5 text-sm font-medium transition-colors hover:bg-secondary"
          >
            <ArrowLeft className="size-4" />
            {campaignSlug ? "Back to campaign" : "Back to businesses"}
          </button>
        ) : (
          <>
            <button
              onClick={() => setReminderOpen(true)}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary-dark active:scale-95"
            >
              <Bell className="size-4" />
              Send Reminder
            </button>
            <button
              onClick={navigateToEditInvite}
              className="inline-flex h-12 items-center gap-2 rounded-full border border-border px-5 text-sm font-medium transition-colors hover:bg-secondary"
            >
              <Pencil className="size-4" />
              Edit Invitation
            </button>
          </>
        )}
      </div>

      {/* Send Reminder confirmation modal */}
      <Dialog open={reminderOpen} onOpenChange={setReminderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send reminder?</DialogTitle>
            <DialogDescription>
              We’ll send {businessName} a friendly reminder to review this
              campaign invitation.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setReminderOpen(false)}
              className="inline-flex h-11 items-center justify-center rounded-full border border-border px-5 text-sm font-medium transition-colors hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              onClick={confirmReminder}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary-dark active:scale-95"
            >
              <Bell className="size-4" />
              Send Reminder
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Heart;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4 shrink-0" />
        {label}
      </span>
      <span className="text-right text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

function RequestRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Heart;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-blue-200/70 bg-card/70 p-4 dark:border-blue-900/50">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
        <Icon className="size-3.5" />
        {label}
      </p>
      <p className="mt-1.5 text-pretty text-sm font-medium text-foreground">
        {value}
      </p>
    </div>
  );
}
