"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Info, Lock, MessageSquareText, Save, Loader2 } from "lucide-react";
import { useCampaign } from "@/lib/campaign-context";
import type { BusinessChangeRequest } from "@/lib/campaign-context";
import { parseFlexibleDateInput, toDateOnlyString } from "@/lib/date-only";
import { displayChangeRequestFields } from "@/lib/invite-change-request";
import { usePartnerInvitation } from "@/hooks/use-partner-invitation";
import { UsDateInput } from "@/components/campaign/UsDateInput";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function readSessionPrefill(): BusinessChangeRequest | null {
  try {
    const raw = window.sessionStorage.getItem("forkup-invite-prefill");
    if (!raw) return null;
    window.sessionStorage.removeItem("forkup-invite-prefill");
    return JSON.parse(raw) as BusinessChangeRequest;
  } catch {
    return null;
  }
}

export function EditBusinessInvite() {
  const { goTo } = useCampaign();
  const {
    campaignSlug,
    invitation,
    apiDashboard,
    campaignStartDate,
    loading,
    error,
  } = usePartnerInvitation();

  const sessionPrefill = useMemo(
    () => (typeof window !== "undefined" ? readSessionPrefill() : null),
    [],
  );

  const changeRequestDisplay = displayChangeRequestFields(invitation?.changeRequestMessage);
  const changePrefill = sessionPrefill ?? changeRequestDisplay.parsed;

  const businessName = invitation?.businessName ?? "";
  const campaignName = apiDashboard?.name ?? "";
  const methodName = invitation?.methodName ?? "Dine & Donate";

  const original = useMemo(
    () => ({
      method: methodName,
      eventDate: campaignStartDate || toDateOnlyString(new Date()) || "",
      giveback: invitation?.givebackPercentage ?? 15,
      email: invitation?.businessEmail ?? "",
    }),
    [methodName, campaignStartDate, invitation?.givebackPercentage, invitation?.businessEmail],
  );

  const prefillDate =
    (changePrefill?.preferredDate
      ? parseFlexibleDateInput(changePrefill.preferredDate) || changePrefill.preferredDate
      : "") || original.eventDate;

  const [email, setEmail] = useState(original.email);
  const [method, setMethod] = useState(original.method);
  const [eventDate, setEventDate] = useState(prefillDate);
  const [giveback, setGiveback] = useState(
    changePrefill?.preferredGiveback ?? original.giveback,
  );
  const [note, setNote] = useState(
    changePrefill?.message ?? invitation?.messageToBusiness ?? "",
  );
  const [proposedTerms, setProposedTerms] = useState(invitation?.proposedTerms ?? "");

  useEffect(() => {
    if (!invitation) return;
    setEmail(invitation.businessEmail ?? "");
    setMethod(invitation.methodName ?? method);
    setGiveback(changePrefill?.preferredGiveback ?? invitation.givebackPercentage ?? 15);
    if (campaignStartDate) {
      const preferred =
        changePrefill?.preferredDate
          ? parseFlexibleDateInput(changePrefill.preferredDate) || changePrefill.preferredDate
          : "";
      setEventDate(preferred || campaignStartDate);
    }
    if (changePrefill?.message) setNote(changePrefill.message);
    else if (invitation.messageToBusiness) setNote(invitation.messageToBusiness);
    setProposedTerms(invitation.proposedTerms ?? "");
  }, [invitation, campaignStartDate, changePrefill, method]);

  const [confirmOpen, setConfirmOpen] = useState(false);

  const hasMaterialChange =
    method !== original.method ||
    eventDate !== original.eventDate ||
    Number(giveback) !== original.giveback;

  const returnToInviteFlow = (material: boolean) => {
    try {
      window.sessionStorage.setItem("forkup-invite-updated", "1");
      window.sessionStorage.setItem(
        "forkup-invite-update-type",
        material ? "material" : "safe",
      );
    } catch {
      /* ignore storage errors */
    }
    if (campaignSlug && invitation) {
      goTo("business-invite-flow", {
        statePatch: { campaignSlug },
        query: {
          campaign: campaignSlug,
          invitation: String(invitation.id),
        },
      });
      return;
    }
    goTo("business-invite-flow");
  };

  const onSave = () => {
    if (hasMaterialChange) {
      setConfirmOpen(true);
      return;
    }
    returnToInviteFlow(false);
  };

  const field =
    "h-12 w-full rounded-xl border border-border bg-card px-4 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring/30";
  const lockedField =
    "flex h-12 w-full items-center justify-between rounded-xl border border-border bg-secondary px-4 text-sm font-medium text-muted-foreground";

  if (loading) {
    return (
      <main className="mx-auto flex min-h-[50vh] max-w-2xl items-center justify-center px-5">
        <Loader2 className="size-8 animate-spin text-primary" />
      </main>
    );
  }

  if (!campaignSlug || !invitation) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-12 text-center text-sm text-muted-foreground">
        {error ?? "Open this screen from your campaign dashboard to edit a business invitation."}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-10 sm:px-6 sm:py-12">
      <button
        type="button"
        onClick={() => returnToInviteFlow(false)}
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to invite status
      </button>

      <div className="animate-rise">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Edit Business Invite
        </h1>
        <p className="mt-3 text-pretty text-muted-foreground">
          Update the details being sent to {businessName || "this business"}.
        </p>
      </div>

      <div className="animate-rise mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/40">
        <Info className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-sm text-amber-700 dark:text-amber-300">
          Changing the date, giveback percentage, fundraising method, or
          settlement terms will require the business to confirm again.
        </p>
      </div>

      {changePrefill?.message && (
        <div className="animate-rise mt-4 flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900/60 dark:bg-blue-950/30">
          <MessageSquareText className="mt-0.5 size-5 shrink-0 text-blue-600 dark:text-blue-400" />
          <div>
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
              {businessName} requested these changes
            </p>
            <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
              &ldquo;{changePrefill.message}&rdquo;
            </p>
          </div>
        </div>
      )}

      <div className="animate-rise mt-6 space-y-5 rounded-3xl border border-border bg-card p-6 sm:p-8 [animation-delay:60ms]">
        <div className="space-y-2">
          <label className="text-sm font-semibold">Business</label>
          <div className={lockedField}>
            <span className="text-foreground">{businessName}</span>
            <Lock className="size-4" />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold">Business Email</label>
          <input
            className={field}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold">Campaign</label>
          <div className={lockedField}>
            <span className="text-foreground">{campaignName}</span>
            <Lock className="size-4" />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold">Fundraising Method</label>
          <div className={lockedField}>
            <span className="text-foreground">{method}</span>
            <Lock className="size-4" />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold">Campaign Start Date</label>
          <UsDateInput
            className={field}
            value={eventDate}
            onChange={setEventDate}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold">Giveback Percentage</label>
          <div className="relative">
            <input
              className={field + " pr-10"}
              type="number"
              min={5}
              max={50}
              value={giveback}
              onChange={(e) => setGiveback(Number(e.target.value))}
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
              %
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold">Message to Business (Optional)</label>
          <textarea
            className="min-h-24 w-full rounded-xl border border-border bg-card p-4 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring/30"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a personal message explaining why you'd like this business to join your campaign."
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold">Proposed Terms (Optional)</label>
          <textarea
            className="min-h-20 w-full rounded-xl border border-border bg-card p-4 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring/30"
            value={proposedTerms}
            onChange={(e) => setProposedTerms(e.target.value)}
            placeholder="e.g. Eligible sales rules, hours, or exclusions for this partnership."
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onSave}
            className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary-dark active:scale-95"
          >
            <Save className="size-4" />
            Save Changes
          </button>
          <button
            type="button"
            onClick={() => returnToInviteFlow(false)}
            className="inline-flex h-12 items-center gap-2 rounded-full border border-border px-5 text-sm font-medium transition-colors hover:bg-secondary"
          >
            Cancel
          </button>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" />
              Business confirmation required
            </DialogTitle>
            <DialogDescription>
              This change will be sent to {businessName} for approval. They will
              not appear as confirmed on your campaign page until they accept the
              updated invitation.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              className="inline-flex h-11 items-center justify-center rounded-full border border-border px-5 text-sm font-medium transition-colors hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmOpen(false);
                returnToInviteFlow(true);
              }}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary-dark active:scale-95"
            >
              <Save className="size-4" />
              Send Updated Invitation
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
