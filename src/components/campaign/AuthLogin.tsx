"use client";



import { useEffect, useState } from "react";

import { Eye, EyeOff, HeartHandshake, Loader2, Megaphone, Store, Users } from "lucide-react";

import { loginUser, registerUser, checkEmailAvailable } from "@/lib/api";

import { setAuthToken } from "@/lib/auth-storage";

import {

  ACCOUNT_INTENT_COPY,

  stashRoleHint,

  type AccountIntent,

} from "@/lib/campaign-auth";

import { emailValidationMessage, isValidEmail, normalizeEmail } from "@/lib/email-validation";



export function AuthLogin({

  intent = "nonprofit",

  onSuccess,

  linkOrganization,

  /** Optional start tab; default remains login so existing callers are unchanged. */
  initialMode = "login",

  /** Optional: open forgot-password step from sign-in mode. */
  onForgotPassword,

  /** Optional: called after successful register (before onSuccess). */
  onRegistered,

  /**
   * Additive: prefill email (claim mail / guest draft). Existing callers omit this.
   */
  initialEmail,

  /**
   * Additive: when true, email is read-only and submit always uses initialEmail.
   * Used for claim-mail + manual Create account so OTP cannot go to another address.
   */
  lockEmail = false,

}: {

  intent?: AccountIntent;

  onSuccess?: (intent: AccountIntent) => void | Promise<void>;

  linkOrganization?: {

    organizationType: "nonprofit" | "business";

    organizationId: number;

  };

  initialMode?: "login" | "register";

  onForgotPassword?: () => void;

  onRegistered?: (email: string) => void | Promise<void>;

  initialEmail?: string;

  lockEmail?: boolean;

}) {

  const copy = ACCOUNT_INTENT_COPY[intent];

  const lockedNormalized =
    lockEmail && initialEmail && isValidEmail(initialEmail)
      ? normalizeEmail(initialEmail)
      : "";

  const [mode, setMode] = useState<"login" | "register">(initialMode);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const [email, setEmail] = useState(() =>
    initialEmail && isValidEmail(initialEmail) ? normalizeEmail(initialEmail) : "",
  );

  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  /** Blocks browser autofill until the user focuses a field. */
  const [allowAutofill, setAllowAutofill] = useState(false);

  const [fullName, setFullName] = useState("");

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [info, setInfo] = useState<string | null>(null);

  const [emailTaken, setEmailTaken] = useState(false);



  const emailError = email.trim() ? emailValidationMessage(email) : null;

  const canSubmit =

    !loading &&

    password.length >= 8 &&

    isValidEmail(email) &&

    (mode === "login" || !emailTaken);



  useEffect(() => {

    if (lockedNormalized) {
      setEmail(lockedNormalized);
    } else {
      setEmail("");
    }

    setPassword("");

    setFullName("");

    setError(null);

    setInfo(null);

    setEmailTaken(false);

  }, [intent, mode, lockedNormalized]);

  // Claim/draft lock may arrive after first paint — keep field in sync.
  useEffect(() => {
    if (!lockedNormalized) return;
    setEmail(lockedNormalized);
  }, [lockedNormalized]);



  const checkEmail = async (value: string) => {

    if (!isValidEmail(value)) {

      setEmailTaken(false);

      return;

    }

    try {

      const result = await checkEmailAvailable(value);

      setEmailTaken(mode === "register" && !result.available);

      if (mode === "register" && !result.available) {

        setInfo(result.message);

      } else {

        setInfo(null);

      }

    } catch {

      setEmailTaken(false);

    }

  };



  const submit = async (e: React.FormEvent) => {

    e.preventDefault();

    setError(null);

    setInfo(null);



    const normalized = lockedNormalized || normalizeEmail(email);

    if (lockedNormalized && normalizeEmail(email) !== lockedNormalized) {
      setError(`Use ${lockedNormalized} for this claim link / draft.`);
      setEmail(lockedNormalized);
      return;
    }

    const validationError = emailValidationMessage(normalized);

    if (validationError) {

      setError(validationError);

      return;

    }



    if (mode === "register" && emailTaken) {

      setError("An account with this email already exists. Please sign in instead.");

      setMode("login");

      return;

    }



    setLoading(true);

    try {

      stashRoleHint(intent);

      if (mode === "login") {
        const result = await loginUser(normalized, password);
        setAuthToken(result.token);
        await onSuccess?.(intent);
      } else {
        await registerUser({
          email: normalized,
          password,
          fullName: fullName.trim() || undefined,
          organizationType: linkOrganization?.organizationType,
          organizationId: linkOrganization?.organizationId,
        });
        // Account is created only after email verify — no session yet.
        await onRegistered?.(normalized);
        await onSuccess?.(intent);
      }

    } catch (err) {

      const message = err instanceof Error ? err.message : "Authentication failed";

      if (

        mode === "register" &&

        (message.toLowerCase().includes("already exists") || message.includes("409"))

      ) {

        setMode("login");

        setError("An account with this email already exists. Sign in to access all your roles.");

      } else {

        setError(message);

      }

    } finally {

      setLoading(false);

    }

  };



  return (
    <div className="w-full">
      <h2 className="text-xl font-bold tracking-tight">
        {mode === "login" ? "Sign in" : "Create your account"}
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {mode === "login"
          ? "Enter your email and password to continue."
          : "It only takes a minute — then you can finish your fundraiser."}
      </p>

      <form
        onSubmit={submit}
        autoComplete="off"
        className="mt-6 space-y-4"
      >
        {/* Hidden decoys so browsers do not inject saved login into the real fields. */}
        <input
          type="text"
          name="forkup-username-decoy"
          autoComplete="username"
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none absolute h-0 w-0 opacity-0"
          value=""
          readOnly
        />
        <input
          type="password"
          name="forkup-password-decoy"
          autoComplete="current-password"
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none absolute h-0 w-0 opacity-0"
          value=""
          readOnly
        />
        {mode === "register" && (
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Full name</span>
            <input
              name="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={copy.fullNamePlaceholder}
              autoComplete="off"
              className="h-12 w-full rounded-xl border border-border bg-card px-4 text-sm"
            />
          </label>
        )}
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">Email</span>
          <input
            type="email"
            name="forkup-auth-email"
            id="forkup-auth-email"
            required
            value={email}
            onChange={(e) => {
              if (lockedNormalized) return;
              setEmail(e.target.value);
              setEmailTaken(false);
              setInfo(null);
            }}
            onBlur={() => void checkEmail(email)}
            placeholder="you@organization.org"
            autoComplete="off"
            data-lpignore="true"
            data-1p-ignore="true"
            data-form-type="other"
            readOnly={Boolean(lockedNormalized) || !allowAutofill}
            onFocus={() => {
              if (!lockedNormalized) setAllowAutofill(true);
            }}
            className={`h-12 w-full rounded-xl border bg-card px-4 text-sm ${
              emailError ? "border-destructive" : "border-border"
            } ${lockedNormalized ? "cursor-not-allowed opacity-90" : ""}`}
          />
          {lockedNormalized ? (
            <p className="text-xs text-muted-foreground">
              This email is locked to your claim / draft. Sign up or sign in with this address only.
            </p>
          ) : null}
          {emailError && <p className="text-xs text-destructive">{emailError}</p>}
          {info && !emailError && (
            <p
              className={`text-xs ${emailTaken ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}
            >
              {info}
            </p>
          )}
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">Password</span>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              name="forkup-auth-password"
              id="forkup-auth-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              data-lpignore="true"
              data-1p-ignore="true"
              data-form-type="other"
              readOnly={!allowAutofill}
              onFocus={() => setAllowAutofill(true)}
              className="h-12 w-full rounded-xl border border-border bg-card px-4 pr-12 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 flex items-center justify-center px-3 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </label>

        {mode === "login" && onForgotPassword ? (
          <div className="-mt-1 flex justify-end">
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
            >
              Forgot password?
            </button>
          </div>
        ) : null}

        {error && (
          <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-dark disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : mode === "login" ? (
            "Sign in"
          ) : emailTaken ? (
            "Sign in instead"
          ) : (
            "Create account"
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {mode === "login" ? (
          <>
            Don&apos;t have an account?{" "}
            <button
              type="button"
              onClick={() => setMode("register")}
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              Sign up
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => setMode("login")}
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              Sign in
            </button>
          </>
        )}
      </p>
    </div>
  );
}



const INTENT_OPTIONS: {

  id: AccountIntent;

  label: string;

  description: string;

  icon: typeof HeartHandshake;

}[] = [

  {

    id: "nonprofit",

    label: "Nonprofit",

    description: "Launch and manage fundraising campaigns",

    icon: HeartHandshake,

  },

  {

    id: "business",

    label: "Business",

    description: "Partner with nonprofits and give back",

    icon: Store,

  },

  {

    id: "supporter",

    label: "Supporter",

    description: "Discover campaigns and participate locally",

    icon: Users,

  },



  {

    id: "fundraiser",

    label: "Fundraiser",

    description: "Raise for nonprofits and send them campaign invites",

    icon: Megaphone,

  },
];



export function AccountIntentPicker({
  value,
  onChange,
}: {
  value: AccountIntent | null;
  onChange: (intent: AccountIntent) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="sr-only">Account type</span>
      <select
        value={value ?? ""}
        onChange={(e) => {
          const next = e.target.value as AccountIntent | "";
          if (next === "nonprofit" || next === "business" || next === "supporter" || next === "fundraiser") {
            onChange(next);
          }
        }}
        className="h-12 w-full rounded-xl border border-border bg-card px-4 text-sm outline-none focus:border-primary/50"
      >
        <option value="" disabled>
          Select account type (optional)
        </option>
        {INTENT_OPTIONS.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}


