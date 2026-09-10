"use client";

/**
 * User email verification screen (after signup or from email link).
 *
 * Purpose: Confirm email via 6-digit code or URL token; allow soft Continue.
 * Inputs: ?email= and/or ?token= query; campaign goTo.
 * Outputs: POST /api/auth/verify-email, /api/auth/resend-verification.
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { resendVerification, verifyEmail } from "@/lib/api";
import { setAuthToken } from "@/lib/auth-storage";
import { clearAuthAndSession } from "@/lib/auth-session";
import { useCampaign } from "@/lib/campaign-context";
import { isValidEmail, normalizeEmail } from "@/lib/email-validation";

const fieldClass =
  "h-12 w-full rounded-xl border border-border bg-card px-4 text-sm outline-none focus:border-primary/50";
const btnPrimary =
  "inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-dark disabled:opacity-60";
const btnLink =
  "font-semibold text-primary underline-offset-4 hover:underline";

const PENDING_INTENT_KEY = "forkup-post-verify-intent";
const AWAITING_KEY = "forkup-awaiting-email-verify";
const RUN_FINISH_KEY = "forkup-run-post-verify-finish";
const PENDING_AUTH_TOKEN_KEY = "forkup-pending-auth-token";

/**
 * After soft-gate verify Continue, AuthLoginScreen finishes post-auth navigation.
 */
export function markPostVerifyFinish() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(RUN_FINISH_KEY, "1");
  sessionStorage.removeItem(AWAITING_KEY);
}

export function stashPostVerifyIntent(intent: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(PENDING_INTENT_KEY, intent);
  sessionStorage.setItem(AWAITING_KEY, "1");
}

/** Hold register session token until email verify/continue (do not treat as signed-in yet). */
export function stashPendingAuthToken(token: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(PENDING_AUTH_TOKEN_KEY, token);
}

/** Move pending register token into real auth storage. Returns true if a token was applied. */
export function promotePendingAuthToken(): boolean {
  if (typeof window === "undefined") return false;
  const token = sessionStorage.getItem(PENDING_AUTH_TOKEN_KEY);
  sessionStorage.removeItem(PENDING_AUTH_TOKEN_KEY);
  if (!token) return false;
  setAuthToken(token);
  return true;
}

/** Clear abandoned signup session so Sign in is not half-signed-in. */
export function clearPendingSignupAuth() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(PENDING_AUTH_TOKEN_KEY);
  sessionStorage.removeItem(PENDING_INTENT_KEY);
  sessionStorage.removeItem(AWAITING_KEY);
  sessionStorage.removeItem(RUN_FINISH_KEY);
  clearAuthAndSession();
}

export function consumePostVerifyFinishIntent(): string | null {
  if (typeof window === "undefined") return null;
  if (sessionStorage.getItem(RUN_FINISH_KEY) !== "1") return null;
  const intent = sessionStorage.getItem(PENDING_INTENT_KEY);
  sessionStorage.removeItem(RUN_FINISH_KEY);
  sessionStorage.removeItem(PENDING_INTENT_KEY);
  sessionStorage.removeItem(AWAITING_KEY);
  return intent;
}

export function isAwaitingEmailVerify(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(AWAITING_KEY) === "1";
}

/**
 * Mask an email for display: keep first 2 local chars + domain (jo***@gmail.com).
 * Inputs: email string. Outputs: masked string (or original if invalid).
 */
function maskEmail(email: string): string {
  const normalized = normalizeEmail(email);
  const at = normalized.indexOf("@");
  if (at < 1) return normalized;
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

/**
 * Step auth-verify-email: verify via token (link) or email + code.
 */
export function AuthVerifyEmail() {
  const { goTo } = useCampaign();
  const params = useSearchParams();
  /** Only treat long hex tokens as email-link verification (ignore stale short/empty tokens). */
  const rawToken = (params.get("token") ?? "").trim();
  const tokenFromUrl = /^[a-f0-9]{32,}$/i.test(rawToken) ? rawToken : "";
  const emailFromUrl = (params.get("email") ?? "").trim();

  const [email] = useState(() => normalizeEmail(emailFromUrl));
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Button / resend only — never tied to URL-token auto-verify. */
  const [submitting, setSubmitting] = useState(false);
  const [tokenVerifying, setTokenVerifying] = useState(Boolean(tokenFromUrl));
  const [done, setDone] = useState(false);

  const knownEmail = isValidEmail(email);
  const displayEmail = knownEmail ? maskEmail(email) : "";

  const completeAfterVerify = (sessionToken?: string) => {
    if (sessionToken) {
      setAuthToken(sessionToken);
    } else {
      promotePendingAuthToken();
    }
    markPostVerifyFinish();
    goTo("auth-login", { query: { token: undefined, email: undefined } });
  };

  useEffect(() => {
    if (!tokenFromUrl) {
      setTokenVerifying(false);
      setSubmitting(false);
      return;
    }
    let cancelled = false;
    setTokenVerifying(true);
    setError(null);
    (async () => {
      try {
        const res = await verifyEmail({ token: tokenFromUrl });
        if (cancelled) return;
        setDone(true);
        setMessage("Email verified. Continuing…");
        completeAfterVerify(res.token);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Verification failed");
        setTokenVerifying(false);
      }
    })();
    return () => {
      cancelled = true;
      // Strict Mode remount: never leave the form button stuck loading.
      setSubmitting(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once for URL token
  }, [tokenFromUrl]);

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!knownEmail) {
      setError("Missing signup email. Go back and sign up again.");
      return;
    }
    if (!/^\d{6}$/.test(code.trim())) {
      setError("Enter the 6-digit code from your email");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await verifyEmail({ email, code: code.trim() });
      setDone(true);
      setMessage("Email verified.");
      completeAfterVerify(res.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    if (!knownEmail) {
      setError("Missing signup email. Go back and sign up again.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await resendVerification(email);
      setMessage(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Resend failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (tokenVerifying && !error) {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col items-center justify-center px-5 py-10">
        <Loader2 className="size-6 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">Verifying your email…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-5 py-10">
      <h1 className="font-display text-3xl font-bold tracking-tight">Verify your email</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {knownEmail ? (
          <>
            A code was sent to{" "}
            <span className="font-semibold text-foreground">{displayEmail}</span>.
            Please enter it below to finish creating your account.
          </>
        ) : (
          <>Enter the 6-digit code from your email to finish creating your account.</>
        )}
      </p>

      <form onSubmit={submitCode} className="mt-8 space-y-4">
        {message && (
          <p className="rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300">
            {message}
          </p>
        )}
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">6-digit code</span>
          <input
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
              if (error) setError(null);
            }}
            placeholder="123456"
            autoComplete="one-time-code"
            className={fieldClass}
          />
        </label>
        {error && (
          <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting || code.length !== 6 || !knownEmail || done}
          className={btnPrimary}
        >
          {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
          Verify email
        </button>
      </form>

      <div className="mt-4 flex flex-col gap-3">
        <button
          type="button"
          disabled={submitting || !knownEmail}
          onClick={() => void resend()}
          className={`${btnLink} inline-flex items-center gap-1.5 text-sm`}
        >
          <Mail className="size-3.5" /> Resend email
        </button>
        <button
          type="button"
          onClick={() => {
            clearPendingSignupAuth();
            if (typeof window !== "undefined") {
              sessionStorage.setItem("forkup-auth-initial-mode", "register");
            }
            goTo("auth-login", { query: { token: undefined, email: undefined } });
          }}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Back to sign up
        </button>
      </div>
    </main>
  );
}
