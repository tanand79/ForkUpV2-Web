"use client";

/**
 * User password recovery screens (forgot + reset).
 *
 * Purpose: Let signed-out users request a reset email (link + 6-digit code),
 * verify the code or open the email link, then set a new password.
 * Inputs: campaign goTo navigation; URL token for link-based reset.
 * Outputs: calls /api/auth/forgot-password, verify-reset-code, reset-password.
 */

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, Loader2, Mail } from "lucide-react";
import {
  forgotPassword,
  resetPassword,
  verifyResetCode,
} from "@/lib/api";
import { useCampaign } from "@/lib/campaign-context";
import { emailValidationMessage, isValidEmail, normalizeEmail } from "@/lib/email-validation";

const fieldClass =
  "h-12 w-full rounded-xl border border-border bg-card px-4 text-sm outline-none focus:border-primary/50";
const btnPrimary =
  "inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-dark disabled:opacity-60";
const btnLink =
  "font-semibold text-primary underline-offset-4 hover:underline";

/**
 * Step auth-forgot-password: enter email, send reset, optionally enter code.
 */
export function AuthForgotPassword() {
  const { goTo } = useCampaign();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<"request" | "code">("request");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const emailError = email.trim() ? emailValidationMessage(email) : null;

  const sendReset = async () => {
    const normalized = normalizeEmail(email);
    const validationError = emailValidationMessage(normalized);
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await forgotPassword(normalized);
      setMessage(res.message);
      setPhase("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeEmail(email);
    if (!/^\d{6}$/.test(code.trim())) {
      setError("Enter the 6-digit code from your email");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await verifyResetCode(normalized, code.trim());
      goTo("auth-reset-password", { query: { token: res.token } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-5 py-10">
      <h1 className="font-display text-3xl font-bold tracking-tight">Forgot password</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {phase === "request"
          ? "Enter your email. We will send a reset link and a 6-digit code."
          : "Enter the 6-digit code from your email, or open the reset link we sent."}
      </p>

      {phase === "request" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendReset();
          }}
          className="mt-8 space-y-4"
        >
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@organization.org"
              autoComplete="email"
              className={`${fieldClass} ${emailError ? "border-destructive" : ""}`}
            />
            {emailError && <p className="text-xs text-destructive">{emailError}</p>}
          </label>
          {error && (
            <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <button type="submit" disabled={loading || !isValidEmail(email)} className={btnPrimary}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
            Send reset email
          </button>
        </form>
      ) : (
        <form onSubmit={submitCode} className="mt-8 space-y-4">
          {message && (
            <p className="rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300">
              {message}
            </p>
          )}
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Email</span>
            <input type="email" value={email} readOnly className={`${fieldClass} opacity-80`} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">6-digit code</span>
            <input
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              className={fieldClass}
            />
          </label>
          {error && (
            <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <button type="submit" disabled={loading || code.length !== 6} className={btnPrimary}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}
            Continue
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void sendReset()}
            className={`${btnLink} text-sm`}
          >
            Resend email
          </button>
        </form>
      )}

      <button
        type="button"
        onClick={() => goTo("auth-login")}
        className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Back to sign in
      </button>
    </main>
  );
}

/**
 * Step auth-reset-password: set a new password using the reset token.
 * Token comes from ?token= (email link) or from verify-reset-code navigation.
 */
export function AuthResetPassword() {
  const { goTo } = useCampaign();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await resetPassword(token, password);
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
        <p className="text-sm text-destructive">Missing reset token. Request a new reset email.</p>
        <button
          type="button"
          className={`${btnLink} mt-4 inline-flex items-center gap-1.5 text-sm`}
          onClick={() => goTo("auth-forgot-password")}
        >
          <ArrowLeft className="size-3.5" /> Forgot password
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-5 py-10">
      <h1 className="font-display text-3xl font-bold tracking-tight">Reset password</h1>
      {done ? (
        <div className="mt-6 space-y-4">
          <p className="rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300">
            Password updated. You can sign in now.
          </p>
          <button type="button" className={btnPrimary} onClick={() => goTo("auth-login")}>
            Go to sign in
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">New password</span>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                className={`${fieldClass} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 flex items-center justify-center px-3 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Confirm password</span>
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter password"
              autoComplete="new-password"
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
            disabled={loading || password.length < 8}
            className={btnPrimary}
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}
            Update password
          </button>
        </form>
      )}
      <button
        type="button"
        onClick={() => goTo("auth-login")}
        className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Back to sign in
      </button>
    </main>
  );
}
