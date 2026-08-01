"use client";

/**
 * Platform Super Admin UI
 * — Login / Forgot / Reset password
 * — Dashboard tabs: Verification, ForkUp Review, Profile, AI Engine, Charges, SMTP
 *
 * Inputs: campaign goTo / URL token for reset.
 * Outputs: superadmin session + settings updates via /api/superadmin/*.
 */

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  Eye,
  Loader2,
  Lock,
  Mail,
  Pencil,
  Save,
  Shield,
  Sparkles,
  X,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { setAuthToken, getAuthToken } from "@/lib/auth-storage";
import { useCampaign } from "@/lib/campaign-context";
import { formatDateTimeUs, formatDateUs, looksLikeIsoDateTime } from "@/lib/date-only";
import {
  approveSuperAdminAccessRequest,
  approveSuperAdminForkupReview,
  changeSuperAdminPassword,
  denySuperAdminAccessRequest,
  denySuperAdminForkupReview,
  fetchSuperAdminAccessRequests,
  fetchSuperAdminAiSettings,
  fetchSuperAdminCharges,
  fetchSuperAdminForkupReviewDetail,
  fetchSuperAdminForkupReviewQueue,
  fetchSuperAdminMe,
  fetchSuperAdminOrganizationDetails,
  fetchSuperAdminSmtp,
  requestChangesSuperAdminForkupReview,
  saveSuperAdminAiSettings,
  saveSuperAdminCharges,
  saveSuperAdminSmtp,
  superAdminForgotPassword,
  superAdminLogin,
  superAdminResetPassword,
  testSuperAdminSmtp,
  updateSuperAdminProfile,
  type AccessRequest,
  type ForkupReviewQueueItem,
  type SuperAdminCampaignActivity,
  type SuperAdminForkupReviewDetail,
  type SuperAdminOrganizationDetails,
  type SuperAdminUser,
} from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Tab = "verification" | "forkup-review" | "profile" | "ai" | "charges" | "smtp";

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20";
const labelClass = "text-xs font-semibold text-muted-foreground";
const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40";
const btnGhost =
  "inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground";
const btnSecondary =
  "inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-secondary disabled:opacity-40";

function formatCost(n: number) {
  return n < 0.01 ? "< $0.01" : `~$${n.toFixed(n < 0.1 ? 3 : 2)}`;
}

export function SuperAdminLogin() {
  const { goTo } = useCampaign();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await superAdminLogin(username, password);
      setAuthToken(result.token);
      goTo("super-admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-5 py-10">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-rose-800">
          <Lock className="size-3" /> Super Admin
        </span>
        <h1 className="mt-3 font-display text-2xl font-bold tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review organization verification, AI, fees, and email delivery.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4" autoComplete="off">
          <div>
            <label className={labelClass}>Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={fieldClass}
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className={labelClass}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={fieldClass}
              autoComplete="current-password"
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button type="submit" disabled={loading} className={`${btnPrimary} w-full`}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}
            Sign in
          </button>
        </form>
        <div className="mt-4 flex items-center justify-between gap-3">
          <button type="button" className={btnGhost} onClick={() => goTo("super-admin-forgot-password")}>
            Forgot password?
          </button>
          <button type="button" className={btnGhost} onClick={() => goTo("website-landing")}>
            <ArrowLeft className="size-3.5" /> Home
          </button>
        </div>
      </div>
    </main>
  );
}

export function SuperAdminForgotPassword() {
  const { goTo } = useCampaign();
  const [value, setValue] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await superAdminForgotPassword(value);
      setMessage(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-5 py-10">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h1 className="font-display text-2xl font-bold">Forgot password</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter your superadmin username or email. If we find a match, we email a reset link.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className={labelClass}>Email or username</label>
            <input value={value} onChange={(e) => setValue(e.target.value)} className={fieldClass} required />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {message && <p className="text-sm text-emerald-700">{message}</p>}
          <button type="submit" disabled={loading} className={`${btnPrimary} w-full`}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
            Send reset link
          </button>
        </form>
        <button type="button" className={`${btnGhost} mt-4`} onClick={() => goTo("super-admin-login")}>
          <ArrowLeft className="size-3.5" /> Back to login
        </button>
      </div>
    </main>
  );
}

export function SuperAdminResetPassword() {
  const { goTo } = useCampaign();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await superAdminResetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <main className="mx-auto max-w-md px-5 py-16 text-center">
        <p className="text-sm text-destructive">Missing reset token.</p>
        <button type="button" className={`${btnGhost} mt-4`} onClick={() => goTo("super-admin-login")}>
          Back to login
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-5 py-10">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h1 className="font-display text-2xl font-bold">Reset password</h1>
        {done ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-emerald-700">Password updated. You can sign in now.</p>
            <button type="button" className={btnPrimary} onClick={() => goTo("super-admin-login")}>
              Go to login
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className={labelClass}>New password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={fieldClass}
                minLength={8}
                required
              />
            </div>
            <div>
              <label className={labelClass}>Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={fieldClass}
                minLength={8}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button type="submit" disabled={loading} className={`${btnPrimary} w-full`}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : null}
              Update password
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

export function SuperAdminDashboard() {
  const { goTo } = useCampaign();
  const [tab, setTab] = useState<Tab>("verification");
  const [user, setUser] = useState<SuperAdminUser | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getAuthToken()) {
      goTo("super-admin-login");
      return;
    }
    void fetchSuperAdminMe()
      .then((r) => setUser(r.user))
      .catch((err) => {
        setBootError(err instanceof Error ? err.message : "Not authorized");
        setAuthToken(null);
        goTo("super-admin-login");
      })
      .finally(() => setLoading(false));
  }, [goTo]);

  if (loading) {
    return (
      <main className="flex justify-center py-20">
        <Loader2 className="size-6 animate-spin text-primary" />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-md px-5 py-16 text-center">
        <p className="text-sm text-destructive">{bootError ?? "Please sign in."}</p>
      </main>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "verification", label: "Verification" },
    { id: "forkup-review", label: "ForkUp Review" },
    { id: "profile", label: "Profile" },
    { id: "ai", label: "AI Engine" },
    { id: "charges", label: "Charges" },
    { id: "smtp", label: "SMTP" },
  ];

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-rose-800">
            <Shield className="size-3" /> Super Admin
          </span>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">Platform console</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Signed in as {user.username || user.email}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className={btnGhost} onClick={() => goTo("website-landing")}>
            Home
          </button>
          <button
            type="button"
            className={btnGhost}
            onClick={() => {
              setAuthToken(null);
              goTo("super-admin-login");
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
              tab === t.id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "verification" && <VerificationTab />}
        {tab === "forkup-review" && <ForkupReviewTab />}
        {tab === "profile" && <ProfileTab user={user} onUpdated={setUser} />}
        {tab === "ai" && <AiTab />}
        {tab === "charges" && <ChargesTab />}
        {tab === "smtp" && <SmtpTab />}
      </div>
    </main>
  );
}

/**
 * Nick V2 Layer 6 — campaigns with needs_forkup_review / pending forkup review.
 * Includes View details panel + Request Changes modal (not browser prompt).
 */
function ForkupReviewTab() {
  const [rows, setRows] = useState<ForkupReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [detailSlug, setDetailSlug] = useState<string | null>(null);
  const [requestChangesSlug, setRequestChangesSlug] = useState<string | null>(null);
  const [requestNotes, setRequestNotes] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchSuperAdminForkupReviewQueue());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (slug: string, action: "approve" | "deny") => {
    setActing(slug);
    setError(null);
    try {
      if (action === "approve") await approveSuperAdminForkupReview(slug);
      else await denySuperAdminForkupReview(slug);
      setDetailSlug(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action}`);
    } finally {
      setActing(null);
    }
  };

  const submitRequestChanges = async () => {
    if (!requestChangesSlug) return;
    setActing(requestChangesSlug);
    setError(null);
    try {
      await requestChangesSuperAdminForkupReview(
        requestChangesSlug,
        requestNotes.trim() || undefined,
      );
      setRequestChangesSlug(null);
      setRequestNotes("");
      setDetailSlug(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to request changes");
    } finally {
      setActing(null);
    }
  };

  if (detailSlug) {
    return (
      <>
        <ForkupReviewDetailsView
          slug={detailSlug}
          acting={acting}
          onBack={() => setDetailSlug(null)}
          onApprove={() => void act(detailSlug, "approve")}
          onDeny={() => void act(detailSlug, "deny")}
          onRequestChanges={() => {
            setRequestNotes("");
            setRequestChangesSlug(detailSlug);
          }}
        />
        <Dialog
          open={requestChangesSlug != null}
          onOpenChange={(open) => {
            if (!open) {
              setRequestChangesSlug(null);
              setRequestNotes("");
            }
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Request changes</DialogTitle>
              <DialogDescription>
                Tell the organizer what to fix. The campaign returns to draft so they can
                edit and resubmit for review.
              </DialogDescription>
            </DialogHeader>
            <label className={labelClass}>Notes for the organizer</label>
            <textarea
              value={requestNotes}
              onChange={(e) => setRequestNotes(e.target.value)}
              rows={5}
              placeholder="e.g. Please update the campaign dates and featured image…"
              className={`${fieldClass} mt-1.5 resize-y`}
            />
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className={btnSecondary}
                onClick={() => {
                  setRequestChangesSlug(null);
                  setRequestNotes("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={acting === requestChangesSlug}
                onClick={() => void submitRequestChanges()}
                className="inline-flex items-center gap-1 rounded-full bg-amber-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
              >
                {acting === requestChangesSlug ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Pencil className="size-3.5" />
                )}
                Send request
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-lg font-bold">ForkUp timing review queue</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Campaigns waiting for human ForkUp review. Open any card for full details, then
        approve, deny, or request changes.
      </p>
      {loading && (
        <div className="mt-8 flex justify-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      )}
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      {!loading && rows.length === 0 && (
        <p className="mt-6 text-sm text-muted-foreground">No campaigns in ForkUp review right now.</p>
      )}
      <ul className="mt-4 space-y-2">
        {rows.map((r) => (
          <li
            key={r.slug}
            className="rounded-2xl border border-border bg-background px-4 py-3 text-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{r.name}</p>
                <p className="text-muted-foreground">{r.nonprofit}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Timing: {r.businessTimingStatus} · Review: {r.forkupReviewStatus}
                  {r.startDate ? ` · start ${r.startDate}` : ""}
                  {r.eventDate ? ` · event ${r.eventDate}` : ""}
                </p>
                <p className="mt-1 text-xs font-medium">/{r.slug}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={acting === r.slug}
                  onClick={() => setDetailSlug(r.slug)}
                  className={btnSecondary}
                >
                  <Eye className="size-3.5" /> View details
                </button>
                <button
                  type="button"
                  disabled={acting === r.slug}
                  onClick={() => void act(r.slug, "approve")}
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                >
                  <Check className="size-3.5" /> Approve
                </button>
                <button
                  type="button"
                  disabled={acting === r.slug}
                  onClick={() => {
                    setRequestNotes("");
                    setRequestChangesSlug(r.slug);
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-amber-400/70 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 disabled:opacity-40 dark:bg-amber-950/40 dark:text-amber-200"
                >
                  <Pencil className="size-3.5" /> Request Changes
                </button>
                <button
                  type="button"
                  disabled={acting === r.slug}
                  onClick={() => void act(r.slug, "deny")}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                >
                  <X className="size-3.5" /> Deny
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => void load()}
        className="mt-4 text-xs font-semibold text-primary underline-offset-2 hover:underline"
      >
        Refresh
      </button>

      <Dialog
        open={requestChangesSlug != null}
        onOpenChange={(open) => {
          if (!open) {
            setRequestChangesSlug(null);
            setRequestNotes("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request changes</DialogTitle>
            <DialogDescription>
              Tell the organizer what to fix. The campaign returns to draft so they can
              edit and resubmit for review.
            </DialogDescription>
          </DialogHeader>
          <label className={labelClass}>Notes for the organizer</label>
          <textarea
            value={requestNotes}
            onChange={(e) => setRequestNotes(e.target.value)}
            rows={5}
            placeholder="e.g. Please update the campaign dates and featured image…"
            className={`${fieldClass} mt-1.5 resize-y`}
          />
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className={btnSecondary}
              onClick={() => {
                setRequestChangesSlug(null);
                setRequestNotes("");
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={acting === requestChangesSlug}
              onClick={() => void submitRequestChanges()}
              className="inline-flex items-center gap-1 rounded-full bg-amber-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
            >
              {acting === requestChangesSlug ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Pencil className="size-3.5" />
              )}
              Send request
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/**
 * ForkUp review campaign detail panel (View details).
 * Inputs: campaign slug + approve/deny/request-changes handlers.
 * Outputs: full campaign summary for superadmin review.
 */
function ForkupReviewDetailsView({
  slug,
  acting,
  onBack,
  onApprove,
  onDeny,
  onRequestChanges,
}: {
  slug: string;
  acting: string | null;
  onBack: () => void;
  onApprove: () => void;
  onDeny: () => void;
  onRequestChanges: () => void;
}) {
  const [details, setDetails] = useState<SuperAdminForkupReviewDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    void fetchSuperAdminForkupReviewDetail(slug)
      .then(setDetails)
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load campaign");
        setDetails(null);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <button type="button" onClick={onBack} className={btnGhost}>
          <ArrowLeft className="size-4" /> Back to queue
        </button>
        <h2 className="mt-3 text-lg font-bold">
          {details?.name ?? "Campaign details"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {details
            ? `${details.nonprofit} · ${details.status} · review ${details.forkupReviewStatus}`
            : `/${slug}`}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={acting === slug}
            onClick={onApprove}
            className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
          >
            <Check className="size-3.5" /> Approve
          </button>
          <button
            type="button"
            disabled={acting === slug}
            onClick={onRequestChanges}
            className="inline-flex items-center gap-1 rounded-full border border-amber-400/70 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-900 disabled:opacity-40 dark:bg-amber-950/40 dark:text-amber-200"
          >
            <Pencil className="size-3.5" /> Request Changes
          </button>
          <button
            type="button"
            disabled={acting === slug}
            onClick={onDeny}
            className={btnSecondary}
          >
            <X className="size-3.5" /> Deny
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-10">
          <Loader2 className="size-5 animate-spin text-primary" />
        </div>
      )}
      {error && (
        <p className="rounded-2xl border border-border bg-card p-5 text-sm text-destructive">
          {error}
        </p>
      )}

      {!loading && details && (
        <>
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-bold tracking-tight">Campaign</h3>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
              <DetailField label="Name" value={details.name} />
              <DetailField label="Slug" value={details.slug} />
              <DetailField label="Status" value={details.status} />
              <DetailField label="Goal" value={`$${Number(details.goal).toLocaleString()}`} />
              <DetailField label="Start date" value={details.startDate} />
              <DetailField label="End date" value={details.endDate} />
              <DetailField label="Event date" value={details.eventDate} />
              <DetailField label="Timing status" value={details.businessTimingStatus} />
              <DetailField label="ForkUp review" value={details.forkupReviewStatus} />
              <DetailField label="Review notes" value={details.forkupReviewReason} />
              <DetailField label="Story" value={details.story} />
              <DetailField label="Cover image" value={details.coverImageUrl} />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-bold tracking-tight">Nonprofit</h3>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
              <DetailField label="Organization" value={details.nonprofit} />
              <DetailField label="Contact name" value={details.nonprofitContactName} />
              <DetailField label="Contact email" value={details.nonprofitContactEmail} />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-bold tracking-tight">Methods</h3>
            {details.methods.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No methods listed.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {details.methods.map((m) => (
                  <li
                    key={m.methodType}
                    className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  >
                    <p className="font-semibold">{m.methodName}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.methodType} · {m.methodStatus} · timing {m.timingStatus}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function VerificationTab() {
  const [filter, setFilter] = useState<VerificationFilter>("pending");
  const [counts, setCounts] = useState({ pending: 0, approved: 0, denied: 0 });
  const [rows, setRows] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<number | null>(null);
  const [detailRequest, setDetailRequest] = useState<AccessRequest | null>(null);

  const loadCounts = useCallback(async () => {
    const [p, a, d] = await Promise.all([
      fetchSuperAdminAccessRequests("pending"),
      fetchSuperAdminAccessRequests("approved"),
      fetchSuperAdminAccessRequests("denied"),
    ]);
    setCounts({ pending: p.length, approved: a.length, denied: d.length });
    return { pending: p, approved: a, denied: d };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await loadCounts();
      setRows(all[filter]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setRows([]);
      setCounts({ pending: 0, approved: 0, denied: 0 });
    } finally {
      setLoading(false);
    }
  }, [filter, loadCounts]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (id: number, action: "approve" | "deny") => {
    setActing(id);
    try {
      if (action === "approve") await approveSuperAdminAccessRequest(id);
      else await denySuperAdminAccessRequest(id);
      setDetailRequest(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action}`);
    } finally {
      setActing(null);
    }
  };

  if (detailRequest) {
    return (
      <OrganizationDetailsView
        request={detailRequest}
        acting={acting}
        onBack={() => setDetailRequest(null)}
        onAct={act}
      />
    );
  }

  const filters: { id: VerificationFilter; label: string }[] = [
    { id: "pending", label: "Pending" },
    { id: "approved", label: "Approved" },
    { id: "denied", label: "Denied" },
  ];

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-lg font-bold">Organization verification queue</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Filter by status, then open any card for full organization details.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
              filter === f.id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
            <span className="ml-1.5 opacity-80">{counts[f.id]}</span>
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-10">
          <Loader2 className="size-5 animate-spin text-primary" />
        </div>
      )}
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      {!loading && rows.length === 0 && (
        <p className="mt-6 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No {filter} verification requests.
        </p>
      )}

      {!loading && rows.length > 0 && (
        <ul className="mt-4 space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-xl border border-border bg-background p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setDetailRequest(r)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="font-semibold hover:text-primary">{r.organizationName ?? "Unknown org"}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.organizationType} · {r.requestType} · risk {r.riskLevel}
                    {r.status !== "pending" ? ` · ${r.status}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.requesterName} · {r.requesterEmail}
                  </p>
                  {r.riskReason && <p className="mt-2 text-sm">{r.riskReason}</p>}
                  {r.reviewedAt && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Reviewed {formatDateTimeUs(r.reviewedAt)}
                    </p>
                  )}
                </button>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setDetailRequest(r)}
                    className={btnSecondary}
                  >
                    <Eye className="size-3.5" /> View details
                  </button>
                  {filter === "pending" && (
                    <>
                      <button
                        type="button"
                        disabled={acting === r.id}
                        onClick={() => void act(r.id, "approve")}
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                      >
                        <Check className="size-3.5" /> Approve
                      </button>
                      <button
                        type="button"
                        disabled={acting === r.id}
                        onClick={() => void act(r.id, "deny")}
                        className={btnSecondary}
                      >
                        <X className="size-3.5" /> Deny
                      </button>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * DetailField — one labeled value row for organization details.
 * Inputs: label + value. Outputs: compact read-only row (ISO datetimes → US format).
 */
function DetailField({ label, value }: { label: string; value: unknown }) {
  let text = "—";
  if (value == null || value === "") {
    text = "—";
  } else if (typeof value === "boolean") {
    text = value ? "Yes" : "No";
  } else if (typeof value === "string" && looksLikeIsoDateTime(value)) {
    text = formatDateTimeUs(value);
  } else if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    text = formatDateUs(value);
  } else if (value instanceof Date) {
    text = formatDateTimeUs(value);
  } else {
    text = String(value);
  }
  return (
    <div className="min-w-0 overflow-hidden rounded-xl bg-secondary/40 px-3 py-2.5">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-0.5 break-all text-sm font-medium">{text}</p>
    </div>
  );
}

const moneyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Format USD for superadmin activity KPIs. */
function fmtMoney(n: number | undefined | null): string {
  return moneyFmt.format(Number(n ?? 0));
}

/**
 * ActivityKpi — compact metric tile for superadmin org activity overview.
 * Inputs: label + value (+ optional hint). Outputs: KPI card UI.
 */
function ActivityKpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-extrabold tracking-tight">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/**
 * CampaignActivityCard — one campaign's creator-parity KPIs for superadmin.
 * Inputs: SuperAdminCampaignActivity. Outputs: campaign summary card.
 */
function CampaignActivityCard({ campaign }: { campaign: SuperAdminCampaignActivity }) {
  const goalPct =
    campaign.goal > 0
      ? Math.min(100, Math.round((campaign.raised / campaign.goal) * 100))
      : null;
  const dateLabel = campaign.eventDate
    ? `Event ${formatDateUs(campaign.eventDate)}`
    : [campaign.startDate, campaign.endDate]
        .filter(Boolean)
        .map((d) => formatDateUs(String(d)))
        .join(" – ") || "Dates TBD";
  const methodLabels = campaign.methods
    .map((m) => m.methodType.replace(/_/g, " "))
    .filter(Boolean);

  return (
    <li className="rounded-xl border border-border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold leading-snug">{campaign.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {campaign.slug} · {campaign.status.replace(/_/g, " ")} · {dateLabel}
          </p>
          {campaign.nonprofit ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{campaign.nonprofit}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {campaign.forkupReviewStatus === "pending" ||
          campaign.businessTimingStatus === "needs_forkup_review" ? (
            <span className="rounded-full border border-amber-300/70 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              Needs ForkUp Review
            </span>
          ) : null}
          {campaign.businessTimingStatus === "limited_promotion_window" ? (
            <span className="rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-[11px] font-semibold">
              Limited promotion
            </span>
          ) : null}
        </div>
      </div>

      {methodLabels.length > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Methods: {methodLabels.join(", ")}
        </p>
      ) : null}

      <p className="mt-3 text-sm">
        <span className="text-muted-foreground">Raised: </span>
        <span className="font-extrabold text-primary">{fmtMoney(campaign.raised)}</span>
        {campaign.goal > 0 ? (
          <span className="text-muted-foreground"> / {fmtMoney(campaign.goal)} goal</span>
        ) : null}
        {goalPct != null ? (
          <span className="text-muted-foreground"> ({goalPct}%)</span>
        ) : null}
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <ActivityKpi
          label="Supporters"
          value={String(campaign.receiptSupporters)}
          hint={`${campaign.supportersGoing} going · ${campaign.verifiedVisits} visits`}
        />
        <ActivityKpi
          label="Online gifts"
          value={fmtMoney(campaign.onlineDonationTotal)}
          hint={`${campaign.onlineDonationCount} donation${campaign.onlineDonationCount === 1 ? "" : "s"}`}
        />
        <ActivityKpi
          label="Giveback pool"
          value={fmtMoney(campaign.givebackPool)}
          hint={`from ${fmtMoney(campaign.eligibleSales)} eligible sales`}
        />
        <ActivityKpi
          label="Receipts"
          value={String(campaign.receiptsApproved)}
          hint={`${campaign.receiptsUploaded} uploaded · ${campaign.receiptsPending} pending · ${campaign.receiptsRejected} rejected`}
        />
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <ActivityKpi
          label="Partners"
          value={`${campaign.partnersAccepted}/${campaign.partnersInvited}`}
          hint={`${campaign.partnersPending} pending · ${campaign.partnersNeedsInfo} need info`}
        />
        <ActivityKpi
          label="Ambassadors"
          value={String(campaign.ambassadorCount)}
          hint={`${campaign.participantCount} participants total`}
        />
        <ActivityKpi
          label="Settlement fee"
          value={fmtMoney(campaign.settlementForkupFee)}
          hint={`pool ${fmtMoney(campaign.settlementDonationPool)}`}
        />
        <ActivityKpi
          label="Net to nonprofit"
          value={fmtMoney(campaign.settlementNetNonprofit)}
          hint={
            campaign.expectedGuests > 0
              ? `${campaign.expectedGuests} expected guests`
              : undefined
          }
        />
      </div>
    </li>
  );
}

/**
 * OrganizationDetailsView — full org + request detail for superadmin.
 * Inputs: access request, approve/deny handlers, back.
 * Outputs: details UI matching platform console cards + campaign activity KPIs.
 */
function OrganizationDetailsView({
  request,
  acting,
  onBack,
  onAct,
}: {
  request: AccessRequest;
  acting: number | null;
  onBack: () => void;
  onAct: (id: number, action: "approve" | "deny") => void;
}) {
  const [details, setDetails] = useState<SuperAdminOrganizationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (request.organizationId == null) {
      setError("This request has no organization id.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    void fetchSuperAdminOrganizationDetails(
      request.organizationType,
      request.organizationId,
      request.id,
    )
      .then(setDetails)
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load organization");
        setDetails(null);
      })
      .finally(() => setLoading(false));
  }, [request.id, request.organizationId, request.organizationType]);

  const org = details?.organization ?? null;
  const isNonprofit = details?.organizationType === "nonprofit";
  const summary = details?.activitySummary;
  const campaigns = details?.campaigns ?? [];

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <button type="button" onClick={onBack} className={btnGhost}>
          <ArrowLeft className="size-4" /> Back to queue
        </button>
        <h2 className="mt-3 text-lg font-bold">
          {request.organizationName ?? "Organization details"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {request.organizationType} · {request.requestType} · {request.status}
        </p>

        {request.status === "pending" && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={acting === request.id}
              onClick={() => void onAct(request.id, "approve")}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
            >
              <Check className="size-3.5" /> Approve
            </button>
            <button
              type="button"
              disabled={acting === request.id}
              onClick={() => void onAct(request.id, "deny")}
              className={btnSecondary}
            >
              <X className="size-3.5" /> Deny
            </button>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex justify-center py-10">
          <Loader2 className="size-5 animate-spin text-primary" />
        </div>
      )}
      {error && (
        <p className="rounded-2xl border border-border bg-card p-5 text-sm text-destructive">{error}</p>
      )}

      {!loading && details && (
        <>
          {summary ? (
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-bold tracking-tight">Activity overview</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Same money, supporter, and partner signals a creator sees on their campaign
                dashboard and analytics — rolled up for this organization.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <ActivityKpi
                  label="Campaigns"
                  value={String(summary.campaignCount)}
                  hint={`${summary.liveCount} live · ${summary.draftCount} draft/scheduled`}
                />
                <ActivityKpi
                  label="Total raised"
                  value={fmtMoney(summary.totalRaised)}
                  hint={
                    summary.totalGoal > 0 ? `of ${fmtMoney(summary.totalGoal)} goal` : undefined
                  }
                />
                <ActivityKpi
                  label="Online gifts"
                  value={fmtMoney(summary.onlineDonationTotal)}
                  hint={`${summary.onlineDonationCount} donation${summary.onlineDonationCount === 1 ? "" : "s"}`}
                />
                <ActivityKpi
                  label="Giveback pool"
                  value={fmtMoney(summary.givebackPool)}
                  hint={`from ${fmtMoney(summary.eligibleSales)} eligible sales`}
                />
                <ActivityKpi
                  label="Supporters"
                  value={String(summary.supporters)}
                  hint={`${summary.supportersGoing} marked going`}
                />
                <ActivityKpi
                  label="Receipts"
                  value={String(summary.receiptsApproved)}
                  hint={`${summary.receiptsUploaded} uploaded`}
                />
                <ActivityKpi
                  label="Partners"
                  value={`${summary.partnersAccepted}/${summary.partnersInvited}`}
                  hint={`${summary.ambassadorCount} ambassadors`}
                />
                <ActivityKpi
                  label="Settlement"
                  value={fmtMoney(summary.settlementNetNonprofit)}
                  hint={`fee ${fmtMoney(summary.settlementForkupFee)}`}
                />
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-bold tracking-tight">Campaigns</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Per-campaign raised, supporters, receipts, partners, and settlement — matching
              creator analytics.
            </p>
            {campaigns.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
                No campaigns linked to this organization yet.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {campaigns.map((c) => (
                  <CampaignActivityCard key={c.id} campaign={c} />
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-bold tracking-tight">Verification request</h3>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
              <DetailField label="Requester" value={request.requesterName} />
              <DetailField label="Requester email" value={request.requesterEmail} />
              <DetailField label="Risk level" value={request.riskLevel} />
              <DetailField label="Relationship" value={request.relationship} />
              <DetailField label="Risk reason" value={request.riskReason} />
              <DetailField label="Review notes" value={request.reviewNotes} />
              <DetailField
                label="Submitted"
                value={request.createdAt}
              />
              <DetailField
                label="Reviewed"
                value={request.reviewedAt}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-bold tracking-tight">
              {isNonprofit ? "Nonprofit profile" : "Business profile"}
            </h3>
            {org && (
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {isNonprofit ? (
                  <>
                    <DetailField label="Organization name" value={org.organizationName} />
                    <DetailField label="Slug" value={org.slug} />
                    <DetailField label="EIN" value={org.ein} />
                    <DetailField label="Cause category" value={org.causeCategory} />
                    <DetailField label="Contact name" value={org.contactName} />
                    <DetailField label="Contact email" value={org.contactEmail} />
                    <DetailField label="Contact phone" value={org.contactPhone} />
                    <DetailField label="Website" value={org.website} />
                    <DetailField label="City" value={org.city} />
                    <DetailField label="State" value={org.state} />
                    <DetailField label="ZIP" value={org.zip} />
                    <DetailField label="Verification status" value={org.verificationStatus} />
                    <DetailField label="Claim status" value={org.claimStatus} />
                    <DetailField label="Profile status" value={org.profileStatus} />
                    <DetailField label="Facebook" value={org.facebookUrl} />
                    <DetailField label="Instagram" value={org.instagramUrl} />
                    <DetailField label="LinkedIn" value={org.linkedinUrl} />
                    <DetailField label="TikTok" value={org.tiktokUrl} />
                    <DetailField label="YouTube" value={org.youtubeUrl} />
                    <DetailField label="Mission" value={org.mission} />
                    <DetailField label="Description" value={org.description} />
                    <DetailField label="Logo URL" value={org.logoUrl} />
                    <DetailField label="Claim date" value={org.claimDate} />
                    <DetailField label="Verification date" value={org.verificationDate} />
                    <DetailField label="Created" value={org.createdAt} />
                    <DetailField label="Updated" value={org.updatedAt} />
                  </>
                ) : (
                  <>
                    <DetailField label="Business name" value={org.businessName} />
                    <DetailField label="Slug" value={org.slug} />
                    <DetailField label="Business type" value={org.businessType} />
                    <DetailField label="Contact name" value={org.contactName} />
                    <DetailField label="Contact email" value={org.contactEmail} />
                    <DetailField label="Contact phone" value={org.contactPhone} />
                    <DetailField label="Website" value={org.website} />
                    <DetailField label="Claim status" value={org.claimStatus} />
                    <DetailField label="Business status" value={org.businessStatus} />
                    <DetailField label="Profile status" value={org.profileStatus} />
                    <DetailField label="Default giveback %" value={org.defaultGivebackPercentage} />
                    <DetailField label="Dine & donate" value={org.supportsDineAndDonate} />
                    <DetailField label="Shop & donate" value={org.supportsShopAndDonate} />
                    <DetailField label="Service giveback" value={org.supportsServiceGiveback} />
                    <DetailField label="Guest bartending" value={org.supportsGuestBartending} />
                    <DetailField label="Facebook" value={org.facebookUrl} />
                    <DetailField label="Instagram" value={org.instagramUrl} />
                    <DetailField label="LinkedIn" value={org.linkedinUrl} />
                    <DetailField label="TikTok" value={org.tiktokUrl} />
                    <DetailField label="Description" value={org.description} />
                    <DetailField label="Logo URL" value={org.logoUrl} />
                    <DetailField label="Claim date" value={org.claimDate} />
                    <DetailField label="Verification date" value={org.verificationDate} />
                    <DetailField label="Created" value={org.createdAt} />
                    <DetailField label="Updated" value={org.updatedAt} />
                  </>
                )}
              </div>
            )}
          </div>

          {!isNonprofit && details.locations && details.locations.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-bold tracking-tight">Locations</h3>
              <ul className="mt-3 space-y-3">
                {details.locations.map((loc) => (
                  <li
                    key={String(loc.id)}
                    className="rounded-xl border border-border bg-background p-4"
                  >
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      <DetailField label="Location name" value={loc.locationName} />
                      <DetailField label="Phone" value={loc.phone} />
                      <DetailField label="Address" value={loc.address} />
                      <DetailField label="City" value={loc.city} />
                      <DetailField label="State" value={loc.state} />
                      <DetailField label="ZIP" value={loc.zip} />
                      <DetailField label="Website" value={loc.websiteUrl} />
                      <DetailField label="Active" value={loc.activeStatus} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function ProfileTab({
  user,
  onUpdated,
}: {
  user: SuperAdminUser;
  onUpdated: (u: SuperAdminUser) => void;
}) {
  const [fullName, setFullName] = useState(user.fullName ?? "");
  const [email, setEmail] = useState(user.email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const saveProfile = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await updateSuperAdminProfile({ fullName, email });
      onUpdated(res.user);
      setMessage("Profile saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await changeSuperAdminPassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setMessage("Password updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password change failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold">Profile</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Username</label>
            <input value={user.username ?? ""} className={fieldClass} disabled />
          </div>
          <div>
            <label className={labelClass}>Full name</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={fieldClass} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} className={fieldClass} />
          </div>
        </div>
        <button type="button" className={`${btnPrimary} mt-4`} disabled={saving} onClick={() => void saveProfile()}>
          <Save className="size-4" /> Save profile
        </button>
      </div>
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold">Change password</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Current password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass}>New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={fieldClass}
              minLength={8}
            />
          </div>
        </div>
        <button type="button" className={`${btnPrimary} mt-4`} disabled={saving} onClick={() => void savePassword()}>
          Update password
        </button>
      </div>
      {message && <p className="text-sm text-emerald-700">{message}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  );
}

function AiTab() {
  const [selected, setSelected] = useState("");
  const [models, setModels] = useState<
    {
      id: string;
      label: string;
      vendor: string;
      tier: string;
      blurb: string;
      estimatedRunCost: number;
      pricingSource?: "aws" | "fallback";
    }[]
  >([]);
  const [pricingSource, setPricingSource] = useState<"aws" | "fallback" | "mixed" | null>(null);
  const [pricingFetchedAt, setPricingFetchedAt] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchSuperAdminAiSettings()
      .then((r) => {
        setSelected(r.selectedModelId);
        setModels(r.models);
        setPricingSource(r.pricingSource ?? null);
        setPricingFetchedAt(r.pricingFetchedAt ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setError(null);
    setMessage(null);
    try {
      await saveSuperAdminAiSettings(selected);
      setMessage("AI model saved. New drafts will use this engine.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="size-5 animate-spin text-primary" />
      </div>
    );
  }

  const pricingLabel =
    pricingSource === "aws"
      ? "Live from AWS"
      : pricingSource === "mixed"
        ? "Live from AWS (partial)"
        : "Cached estimate";
  const fetchedLabel = pricingFetchedAt
    ? ` · updated ${formatDateTimeUs(pricingFetchedAt)}`
    : "";

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <Sparkles className="size-5 text-primary" /> AI Engine
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Choose the Bedrock model used for organization and campaign drafts. Estimated run cost shown
        per typical draft (~10k in / 3.5k out tokens).
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Pricing: <span className="font-medium text-foreground">{pricingLabel}</span>
        {fetchedLabel}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {models.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setSelected(m.id)}
            className={`rounded-xl border p-4 text-left transition-colors ${
              selected === m.id ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/40"
            }`}
          >
            <p className="text-sm font-semibold">{m.label}</p>
            <p className="text-xs text-muted-foreground">
              {m.vendor} · {m.tier}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{m.blurb}</p>
            <p className="mt-2 text-xs font-semibold text-primary">
              Est. {formatCost(m.estimatedRunCost)} / run
              <span className="ml-1 font-normal text-muted-foreground">
                · {m.pricingSource === "aws" ? "Live from AWS" : "Cached estimate"}
              </span>
            </p>
          </button>
        ))}
      </div>
      <button type="button" className={`${btnPrimary} mt-4`} onClick={() => void save()}>
        Save AI selection
      </button>
      {message && <p className="mt-2 text-sm text-emerald-700">{message}</p>}
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </section>
  );
}

function ChargesTab() {
  const [fee, setFee] = useState(15);
  const [example, setExample] = useState<{
    eligibleSales: number;
    givebackPercentage: number;
    donationPool: number;
    platformFee: number;
    netNonprofitAmount: number;
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchSuperAdminCharges()
      .then((r) => {
        setFee(r.platformFeePercent);
        setExample(r.example);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  const save = async () => {
    setError(null);
    setMessage(null);
    try {
      const r = await saveSuperAdminCharges(fee);
      setFee(r.platformFeePercent);
      const refreshed = await fetchSuperAdminCharges();
      setExample(refreshed.example);
      setMessage("Platform fee saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-lg font-bold">Platform charges</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        ForkUp platform fee as a percent of the donation pool (giveback).
      </p>
      <div className="mt-4 max-w-xs">
        <label className={labelClass}>Platform fee %</label>
        <input
          type="number"
          min={0}
          max={100}
          step={0.1}
          value={fee}
          onChange={(e) => setFee(Number(e.target.value))}
          className={fieldClass}
        />
      </div>
      {example && (
        <div className="mt-4 grid gap-2 rounded-xl bg-secondary/40 p-4 text-sm sm:grid-cols-2">
          <p>Example sales: ${example.eligibleSales.toLocaleString()}</p>
          <p>Giveback: {example.givebackPercentage}%</p>
          <p>Donation pool: ${example.donationPool.toLocaleString()}</p>
          <p>Platform fee: ${example.platformFee.toLocaleString()}</p>
          <p className="sm:col-span-2 font-semibold">
            Net to nonprofit: ${example.netNonprofitAmount.toLocaleString()}
          </p>
        </div>
      )}
      <button type="button" className={`${btnPrimary} mt-4`} onClick={() => void save()}>
        Save charges
      </button>
      {message && <p className="mt-2 text-sm text-emerald-700">{message}</p>}
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </section>
  );
}

function SmtpTab() {
  const [emailProvider, setEmailProvider] = useState("smtp");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpFrom, setSmtpFrom] = useState("");
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [passSet, setPassSet] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchSuperAdminSmtp()
      .then((r) => {
        // SES is hidden — coerce legacy "ses" to SMTP.
        setEmailProvider(r.emailProvider === "noop" ? "noop" : "smtp");
        setSmtpHost(r.smtpHost);
        setSmtpPort(r.smtpPort);
        setSmtpUser(r.smtpUser);
        setSmtpFrom(r.smtpFrom);
        setSmtpSecure(r.smtpSecure);
        setPassSet(r.smtpPassSet);
        if (r.smtpPassSet) setSmtpPass("");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setError(null);
    setMessage(null);
    try {
      const provider = emailProvider === "noop" ? "noop" : "smtp";
      await saveSuperAdminSmtp({
        emailProvider: provider,
        smtpHost,
        smtpPort,
        smtpUser,
        smtpFrom,
        smtpSecure,
        ...(smtpPass.trim() ? { smtpPass } : {}),
      });
      setEmailProvider(provider);
      setMessage("SMTP settings saved.");
      setPassSet(Boolean(smtpPass.trim()) || passSet);
      setSmtpPass("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  };

  const sendTest = async () => {
    setError(null);
    setMessage(null);
    try {
      const r = await testSuperAdminSmtp(testTo || undefined);
      if (r.success) {
        setMessage(`Test email sent via ${r.result.provider}.`);
      } else {
        const detail = r.result.errorMessage?.trim();
        setMessage(
          detail
            ? `Test result: ${r.result.status} (${r.result.provider}) — ${detail}`
            : `Test result: ${r.result.status} (${r.result.provider})`,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test failed");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="size-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-lg font-bold">Email / SMTP setup</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Configure Brevo (or other) SMTP below. All system emails use these settings.
      </p>

      <div className="mt-4">
        <label className={labelClass}>Provider</label>
        <select
          value={emailProvider}
          onChange={(e) => setEmailProvider(e.target.value)}
          className={fieldClass}
        >
          <option value="smtp">SMTP</option>
          <option value="noop">No-op (log only)</option>
        </select>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelClass}>SMTP host</label>
          <input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} className={fieldClass} placeholder="smtp.example.com" />
        </div>
        <div>
          <label className={labelClass}>Port</label>
          <input
            type="number"
            value={smtpPort}
            onChange={(e) => setSmtpPort(Number(e.target.value))}
            className={fieldClass}
          />
        </div>
        <div className="flex items-end gap-2 pb-2">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={smtpSecure}
              onChange={(e) => setSmtpSecure(e.target.checked)}
            />
            TLS / secure
          </label>
        </div>
        <div>
          <label className={labelClass}>SMTP user</label>
          <input
            value={smtpUser}
            onChange={(e) => setSmtpUser(e.target.value)}
            className={fieldClass}
            placeholder="Brevo SMTP login (e.g. xxx@smtp-brevo.com)"
          />
        </div>
        <div>
          <label className={labelClass}>SMTP password {passSet ? "(saved — leave blank to keep)" : ""}</label>
          <input
            type="password"
            value={smtpPass}
            onChange={(e) => setSmtpPass(e.target.value)}
            className={fieldClass}
            placeholder={passSet ? "••••••••" : ""}
            autoComplete="new-password"
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>From address</label>
          <input
            value={smtpFrom}
            onChange={(e) => setSmtpFrom(e.target.value)}
            className={fieldClass}
            placeholder="no-reply@yourdomain.com"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={btnPrimary} onClick={() => void save()}>
          <Save className="size-4" /> Save SMTP
        </button>
      </div>

      <div className="mt-6 border-t border-border pt-4">
        <label className={labelClass}>Send test email to</label>
        <div className="mt-1.5 flex flex-wrap gap-2">
          <input
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            className={`${fieldClass} mt-0 max-w-sm`}
            placeholder="you@example.com (optional)"
          />
          <button type="button" className={btnPrimary} onClick={() => void sendTest()}>
            Send test
          </button>
        </div>
      </div>

      {message && <p className="mt-3 text-sm text-emerald-700">{message}</p>}
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </section>
  );
}
