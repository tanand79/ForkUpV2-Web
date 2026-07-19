"use client";



import { useEffect, useState } from "react";

import { Eye, EyeOff, HeartHandshake, Loader2, LogIn, Store, UserPlus, Users } from "lucide-react";

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

}: {

  intent?: AccountIntent;

  onSuccess?: (intent: AccountIntent) => void | Promise<void>;

  linkOrganization?: {

    organizationType: "nonprofit" | "business";

    organizationId: number;

  };

}) {

  const copy = ACCOUNT_INTENT_COPY[intent];

  const [mode, setMode] = useState<"login" | "register">("login");

  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

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

    setEmail("");

    setPassword("");

    setFullName("");

    setError(null);

    setInfo(null);

    setEmailTaken(false);

  }, [intent, mode]);



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



    const normalized = normalizeEmail(email);

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

      const result =

        mode === "login"

          ? await loginUser(normalized, password)

          : await registerUser({

              email: normalized,

              password,

              fullName: fullName.trim() || undefined,

              organizationType: linkOrganization?.organizationType,

              organizationId: linkOrganization?.organizationId,

            });

      setAuthToken(result.token);

      await onSuccess?.(intent);

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

    <div className="relative mx-auto max-w-md rounded-2xl border border-border bg-card p-6">

      <p className="text-xs font-semibold uppercase tracking-wide text-primary">{copy.title}</p>

      <p className="mt-2 text-sm text-muted-foreground">

        {mode === "login" ? copy.signInDescription : copy.registerDescription}

      </p>



      <div className="mb-6 mt-5 flex gap-2">

        <button

          type="button"

          onClick={() => setMode("login")}

          className={`flex-1 rounded-full py-2 text-sm font-semibold ${mode === "login" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}

        >

          <LogIn className="mr-1 inline size-4" />

          Sign in

        </button>

        <button

          type="button"

          onClick={() => setMode("register")}

          className={`flex-1 rounded-full py-2 text-sm font-semibold ${mode === "register" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}

        >

          <UserPlus className="mr-1 inline size-4" />

          Register

        </button>

      </div>



      <form
        onSubmit={submit}
        autoComplete={mode === "login" ? "on" : "off"}
        className="space-y-4"
      >
        {mode === "register" && (
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Full name</span>
            <input
              name="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={copy.fullNamePlaceholder}
              autoComplete="name"
              className="h-12 w-full rounded-xl border border-border px-4 text-sm"
            />
          </label>
        )}
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">Email</span>
          <input
            type="email"
            name="email"
            id="forkup-auth-email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setEmailTaken(false);
              setInfo(null);
            }}
            onBlur={() => void checkEmail(email)}
            placeholder={
              intent === "business"
                ? "Business contact email"
                : intent === "nonprofit"
                  ? "Work email for your organization"
                  : "Your email"
            }
            autoComplete={mode === "login" ? "username" : "email"}
            className={`h-12 w-full rounded-xl border px-4 text-sm ${
              emailError ? "border-destructive" : "border-border"
            }`}
          />

          {emailError && <p className="text-xs text-destructive">{emailError}</p>}

          {info && !emailError && (

            <p className={`text-xs ${emailTaken ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}>

              {info}

            </p>

          )}

        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">Password</span>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              id="forkup-auth-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="h-12 w-full rounded-xl border border-border px-4 pr-12 text-sm"
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

        {error && (

          <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">

            {error}

          </p>

        )}

        <button

          type="submit"

          disabled={!canSubmit}

          className="btn-primary w-full rounded-full py-3.5 text-sm disabled:opacity-60"

        >

          {loading ? (

            <Loader2 className="mx-auto size-4 animate-spin" />

          ) : mode === "login" ? (

            copy.signInCta

          ) : emailTaken ? (

            "Sign in instead"

          ) : (

            copy.registerCta

          )}

        </button>

      </form>

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

];



export function AccountIntentPicker({

  value,

  onChange,

}: {

  value: AccountIntent | null;

  onChange: (intent: AccountIntent) => void;

}) {

  return (

    <div className="grid gap-2 sm:grid-cols-3">

      {INTENT_OPTIONS.map((option) => {

        const Icon = option.icon;

        const selected = value === option.id;

        return (

          <button

            key={option.id}

            type="button"

            onClick={() => onChange(option.id)}

            className={`rounded-2xl border p-4 text-left transition-colors ${

              selected

                ? "border-primary bg-primary/5 ring-1 ring-primary/30"

                : "border-border bg-card hover:border-primary/30"

            }`}

          >

            <Icon className={`size-5 ${selected ? "text-primary" : "text-muted-foreground"}`} />

            <p className="mt-2 text-sm font-semibold">{option.label}</p>

            <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>

          </button>

        );

      })}

    </div>

  );

}


