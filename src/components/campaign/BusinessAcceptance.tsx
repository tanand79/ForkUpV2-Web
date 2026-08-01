import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  Handshake,
  HeartHandshake,
  Loader2,
  MapPin,
  MessageSquareText,
  Percent,
  Store,
  Utensils,
  XCircle,
} from "lucide-react";
import { AuthLogin } from "@/components/campaign/AuthLogin";
import { UsDateInput } from "@/components/campaign/UsDateInput";
import { campaignPublicPath } from "@/lib/campaign-paths";
import { useCampaign } from "@/lib/campaign-context";
import {
  acceptBusinessInvitation,
  declineBusinessInvitation,
  fetchBusinessInvitation,
  fetchCurrentUser,
  logoutUser,
  requestBusinessInvitationChanges,
  type AuthUser,
  type BusinessInvitationDetail,
} from "@/lib/api";
import { getAuthToken, setAuthToken } from "@/lib/auth-storage";

type View = "invite" | "accepted" | "declined" | "changes";

function viewFromAcceptanceStatus(status: string): View | null {
  if (status === "accepted") return "accepted";
  if (status === "declined") return "declined";
  if (status === "changes_requested") return "changes";
  return null;
}

export function BusinessAcceptance() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const apiMode = token.length > 0;

  const { state } = useCampaign();

  const [apiInvite, setApiInvite] = useState<BusinessInvitationDetail | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(apiMode);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [view, setView] = useState<View>("invite");
  const [showChanges, setShowChanges] = useState(false);
  const [authorizedRep, setAuthorizedRep] = useState("");
  const [termsOk, setTermsOk] = useState(false);
  const [reqDate, setReqDate] = useState("");
  const [reqGiveback, setReqGiveback] = useState("");
  const [reqMessage, setReqMessage] = useState("");

  const loadInvitation = useCallback(async () => {
    if (!apiMode) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchBusinessInvitation(token);
      setApiInvite(data);
      setAuthorizedRep((prev) => prev || data.business.email || "");
      const resolved = viewFromAcceptanceStatus(data.acceptanceStatus);
      if (resolved) setView(resolved);
      if (getAuthToken()) {
        try {
          setCurrentUser(await fetchCurrentUser());
        } catch {
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Invitation not found");
    } finally {
      setLoading(false);
    }
  }, [apiMode, token]);

  useEffect(() => {
    void loadInvitation();
  }, [loadInvitation]);

  useEffect(() => {
    const refresh = () => {
      void loadInvitation();
    };
    window.addEventListener("forkup-auth-change", refresh);
    window.addEventListener("forkup-partner-invitation-updated", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("forkup-auth-change", refresh);
      window.removeEventListener("forkup-partner-invitation-updated", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [loadInvitation]);

  const canRespond = !apiMode || (apiInvite?.canRespond ?? false);

  const nonprofitName = apiInvite?.campaign.nonprofit ?? "";
  const campaignTitle = apiInvite?.campaign.name ?? "";
  const dateLabel = apiInvite
    ? [apiInvite.campaign.startDate, apiInvite.campaign.endDate].filter(Boolean).join(" – ")
    : "";
  const story = apiInvite?.campaign.story ?? "";
  const givebackPercent = apiInvite?.givebackPercentage ?? 15;
  const methodLabel = apiInvite?.method.name ?? "Local Business Giveback";

  const businessName = apiInvite?.business.name ?? "";
  const businessLocation = apiInvite
    ? [apiInvite.location.name, apiInvite.location.city, apiInvite.location.state]
        .filter(Boolean)
        .join(", ")
    : "";

  const accept = async () => {
    if (apiMode) {
      if (!authorizedRep.trim()) {
        setSubmitError("Authorized representative name is required");
        return;
      }
      if (!termsOk) {
        setSubmitError("Please confirm campaign terms and ACH authorization");
        return;
      }
      setSubmitting(true);
      setSubmitError(null);
      try {
        await acceptBusinessInvitation(token, {
          authorizedRepresentative: authorizedRep.trim(),
          participationHours: apiInvite?.participationHours ?? undefined,
          eligibleSalesRules: apiInvite?.eligibleSalesRules ?? undefined,
          forkupFeeAcknowledged: true,
          net7Acknowledged: true,
          achAuthorized: true,
        });
        setView("accepted");
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "Failed to accept");
      } finally {
        setSubmitting(false);
      }
      return;
    }
  };

  const decline = async () => {
    if (apiMode) {
      setSubmitting(true);
      try {
        await declineBusinessInvitation(token);
        setView("declined");
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "Failed to decline");
      } finally {
        setSubmitting(false);
      }
      return;
    }
  };

  const submitChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    const message = [
      reqDate.trim() ? `Preferred date: ${reqDate.trim()}` : "",
      reqGiveback.trim() ? `Preferred giveback: ${reqGiveback}%` : "",
      reqMessage.trim(),
    ]
      .filter(Boolean)
      .join("\n");

    if (apiMode) {
      if (!message.trim()) {
        setSubmitError("Please describe the changes you need");
        return;
      }
      setSubmitting(true);
      try {
        await requestBusinessInvitationChanges(token, message);
        setView("changes");
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "Failed to send request");
      } finally {
        setSubmitting(false);
      }
      return;
    }
  };

  if (loading) {
    return (
      <main className="mx-auto flex min-h-[50vh] max-w-xl items-center justify-center px-5">
        <Loader2 className="size-8 animate-spin text-primary" />
      </main>
    );
  }

  if (!apiMode) {
    return (
      <main className="mx-auto max-w-lg px-5 py-12 text-center text-sm text-muted-foreground">
        Missing invitation token. Open the link from your campaign email.
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="mx-auto max-w-xl px-5 py-16 text-center">
        <p className="text-destructive">{loadError}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Use the invitation link from your campaign email, or ask the nonprofit to resend it.
        </p>
      </main>
    );
  }

  if (view !== "invite") {
    const confirm = {
      accepted: {
        icon: CheckCircle2,
        tone: "text-primary",
        ring: "bg-primary/10",
        title: "You're in.",
        body: "Your business will now appear on the campaign page once the campaign goes live.",
      },
      declined: {
        icon: XCircle,
        tone: "text-muted-foreground",
        ring: "bg-secondary",
        title: "Invitation declined.",
        body: "No problem — your business won't appear on this campaign.",
      },
      changes: {
        icon: MessageSquareText,
        tone: "text-primary",
        ring: "bg-primary/10",
        title: "Changes requested.",
        body: `We'll share your preferred terms with ${nonprofitName}. Your business stays private until everyone agrees.`,
      },
    }[view];
    const Icon = confirm.icon;
    const campaignSlug = apiInvite?.campaign.slug ?? state.campaignSlug;

    return (
      <main className="mx-auto max-w-xl px-5 py-16 sm:px-6">
        <div className="card-warm animate-rise overflow-hidden p-8 text-center sm:p-10">
          <div
            className={`mx-auto mb-5 inline-flex size-14 items-center justify-center rounded-full ${confirm.ring} ${confirm.tone}`}
          >
            <Icon className="size-7" />
          </div>
          <h1 className="font-serif text-2xl text-foreground sm:text-3xl">{confirm.title}</h1>
          <p className="mx-auto mt-3 max-w-sm text-pretty text-muted-foreground">{confirm.body}</p>
          {view === "accepted" && campaignSlug && (
            <a
              href={campaignPublicPath(campaignSlug)}
              className="btn-primary mt-8 inline-flex w-full items-center justify-center rounded-2xl py-4 text-sm"
            >
              View the campaign page
            </a>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-10 sm:px-6 sm:py-12">
      {apiMode && (
        <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-primary">
          Business invitation
        </p>
      )}

      <div className="animate-rise">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
          <HeartHandshake className="size-3.5" />
          Invitation for {businessName}
        </div>
        <h1 className="text-balance font-serif text-3xl leading-tight text-foreground sm:text-4xl">
          You've been invited to support a local campaign
        </h1>
        <p className="mt-3 text-pretty text-muted-foreground">
          <span className="font-semibold text-foreground">{nonprofitName}</span> would love{" "}
          {businessName} to take part.
        </p>
      </div>

      <div className="animate-rise mt-8 space-y-6 rounded-3xl border border-border bg-card p-6 sm:p-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <DetailRow icon={HeartHandshake} label="Nonprofit" value={nonprofitName} />
          <DetailRow icon={Handshake} label="Campaign" value={campaignTitle} />
          <DetailRow icon={Utensils} label="Fundraising method" value={methodLabel} />
          <DetailRow icon={CalendarDays} label="Campaign dates" value={dateLabel || "—"} />
          <DetailRow icon={Percent} label="Giveback" value={`${givebackPercent}% of eligible sales`} />
          <DetailRow icon={MapPin} label="Your location" value={businessLocation} />
        </div>

        <div className="h-px bg-border" />

        <InfoBlock
          icon={Store}
          title="What participation means"
          body={`During the campaign window, ${givebackPercent}% of eligible supporter spending at ${businessName} is donated to ${nonprofitName}.`}
        />

        <div className="h-px bg-border" />

        <p className="line-clamp-5 text-pretty leading-relaxed text-foreground/80">{story}</p>
      </div>

      {apiMode && !canRespond && (
        <div className="animate-rise mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/40">
          <h2 className="text-sm font-bold text-amber-950 dark:text-amber-100">
            Sign in to respond
          </h2>
          <p className="mt-2 text-sm text-amber-900 dark:text-amber-200/90">
            Anyone with this link can view the invitation. Only the business contact on file
            {apiInvite?.business.emailHint ? ` (${apiInvite.business.emailHint})` : ""} or an
            authorized business admin can accept, decline, or request changes.
          </p>
          {currentUser && !canRespond ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-amber-900 dark:text-amber-200/90">
                You are signed in as <span className="font-semibold">{currentUser.email}</span>, which
                does not match this invitation.
              </p>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await logoutUser();
                  } catch {
                    /* session may already be gone */
                  }
                  setAuthToken(null);
                }}
                className="inline-flex rounded-full border border-amber-400 px-4 py-2 text-xs font-semibold text-amber-950 dark:text-amber-100"
              >
                Sign out and use the business contact account
              </button>
            </div>
          ) : (
            <div className="mt-4">
              <AuthLogin
                intent="business"
                onSuccess={() => void loadInvitation()}
                linkOrganization={
                  apiInvite
                    ? { organizationType: "business", organizationId: apiInvite.business.id }
                    : undefined
                }
              />
            </div>
          )}
        </div>
      )}

      {apiMode && canRespond && (
        <div className="mt-6 space-y-3 rounded-2xl border border-border bg-card p-5">
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Authorized representative</span>
            <input
              value={authorizedRep}
              onChange={(e) => setAuthorizedRep(e.target.value)}
              className="h-12 w-full rounded-xl border border-border bg-background px-4 text-sm"
              placeholder="Your name"
            />
          </label>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={termsOk}
              onChange={(e) => setTermsOk(e.target.checked)}
              className="mt-1 size-4 accent-primary"
            />
            <span className="text-sm text-muted-foreground">
              I confirm the giveback percentage, Net 7 settlement terms, ForkUp platform fee, and ACH
              authorization for fee collection.
            </span>
          </label>
        </div>
      )}

      {submitError && <p className="mt-4 text-sm text-destructive">{submitError}</p>}

      {canRespond && (
      <div className="animate-rise mt-8 space-y-3">
        <button
          onClick={accept}
          disabled={submitting}
          className="btn-primary flex w-full items-center justify-center gap-2 rounded-full py-4 text-sm disabled:opacity-60"
        >
          {submitting ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          Accept Invitation
        </button>
        <button
          onClick={() => setShowChanges(true)}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card py-4 text-sm font-semibold"
        >
          <MessageSquareText className="size-4" />
          Request Changes
        </button>
        <button
          onClick={decline}
          disabled={submitting}
          className="w-full py-2 text-sm font-medium text-muted-foreground hover:text-destructive"
        >
          Decline
        </button>
      </div>
      )}

      {canRespond && showChanges && (
        <div className="animate-rise mt-6 rounded-3xl border border-border bg-card p-6 sm:p-8">
          <h2 className="font-serif text-xl">Request changes</h2>
          <form onSubmit={submitChanges} className="mt-5 space-y-4">
            <label className="block text-left text-sm font-medium text-foreground">
              Preferred start date
              <UsDateInput
                value={reqDate}
                onChange={setReqDate}
                className="mt-1.5 h-12 w-full rounded-xl border border-border px-4 text-sm"
              />
            </label>
            <input
              type="number"
              value={reqGiveback}
              onChange={(e) => setReqGiveback(e.target.value)}
              placeholder={`Preferred giveback % (current ${givebackPercent})`}
              className="h-12 w-full rounded-xl border border-border px-4 text-sm"
            />
            <textarea
              value={reqMessage}
              onChange={(e) => setReqMessage(e.target.value)}
              placeholder="Message to nonprofit"
              className="min-h-24 w-full rounded-xl border border-border p-4 text-sm"
            />
            <button type="submit" disabled={submitting} className="btn-primary w-full rounded-full py-3.5 text-sm">
              Send request
            </button>
          </form>
        </div>
      )}
    </main>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}

function InfoBlock({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof MapPin;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-4" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-pretty text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}
