"use client";

/**
 * AI flow Steps 9–10 — Continue as guest, or create account to launch.
 * Launch / settle / business invites still require signup (existing auth).
 */
import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useCampaign } from "@/lib/campaign-context";
import { getAuthToken } from "@/lib/auth-storage";
import { stashAccountIntent, stashAuthReturnStep } from "@/lib/campaign-auth";
import { loadAiFlowStore, saveAiFlowStore } from "@/lib/ai-campaign-flow-storage";
import { AiFlowShell } from "./AiFlowShell";

const GUEST_PERKS = [
  "Saved automatically in this browser",
  "You can edit anytime before launch",
  "Upgrade and launch later",
  "It's completely free",
];

const ACCOUNT_PERKS = [
  "Launch your campaign",
  "Accept donations",
  "Invite businesses",
  "Track your results",
  "Get paid securely",
];

export function AiContinueGuest() {
  const { goTo } = useCampaign();
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(Boolean(getAuthToken()));
  }, []);

  const continueAsGuest = () => {
    const store = loadAiFlowStore();
    if (store) saveAiFlowStore({ ...store, guestContinued: true });
    goTo("ai-campaign-preview");
  };

  const createAccount = () => {
    stashAccountIntent("nonprofit");
    stashAuthReturnStep("review");
    goTo("auth-login");
  };

  return (
    <AiFlowShell
      title={loggedIn ? "Ready to launch?" : "No login required now"}
      subtitle={
        loggedIn
          ? "Your draft is ready. Continue to review and launch."
          : "Keep building as a guest. Create a free account only when you're ready to launch."
      }
      backStep="ai-campaign-preview"
    >
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="font-semibold">Your campaign draft is ready!</h2>
        <ul className="mt-4 space-y-2">
          {GUEST_PERKS.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
              {item}
            </li>
          ))}
        </ul>
        {!loggedIn ? (
          <button
            type="button"
            onClick={continueAsGuest}
            className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-dark"
          >
            Continue as Guest
          </button>
        ) : (
          <button
            type="button"
            onClick={() => goTo("review")}
            className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-dark"
          >
            Continue to Review & Launch
          </button>
        )}
      </div>

      {!loggedIn ? (
        <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="font-semibold">Publish later — login only when launching</h2>
          <ul className="mt-4 space-y-2">
            {ACCOUNT_PERKS.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                {item}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={createAccount}
            className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-dark"
          >
            Create Free Account
          </button>
          <button
            type="button"
            onClick={createAccount}
            className="mt-3 w-full text-center text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Already have an account? Sign in
          </button>
        </div>
      ) : null}
    </AiFlowShell>
  );
}
