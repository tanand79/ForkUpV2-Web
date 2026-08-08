"use client";

/**
 * AI flow Steps 9–10 — formerly "Continue as Guest".
 *
 * Purpose: Legacy step URL (`ai-continue-guest`) now redirects to signup/login
 * (or Review when already authenticated). Guest continue UI is removed.
 *
 * Inputs: campaign goTo + auth token.
 * Outputs: navigation only (no persistent UI).
 *
 * Changelog: Removed Continue as Guest; force account path before launch.
 */
import { useEffect } from "react";
import { useCampaign } from "@/lib/campaign-context";
import { getAuthToken } from "@/lib/auth-storage";
import { stashAccountIntent, stashAuthReturnStep } from "@/lib/campaign-auth";
import { AiFlowShell } from "./AiFlowShell";

export function AiContinueGuest() {
  const { goTo } = useCampaign();

  useEffect(() => {
    if (getAuthToken()) {
      goTo("review");
      return;
    }
    stashAccountIntent("nonprofit");
    stashAuthReturnStep("review");
    sessionStorage.setItem("forkup-auth-initial-mode", "register");
    goTo("auth-login");
  }, [goTo]);

  return (
    <AiFlowShell
      title="Create your account"
      subtitle="Sign up to save your campaign and continue to review."
      backStep="ai-campaign-preview"
    >
      <p className="text-center text-sm text-muted-foreground">Redirecting…</p>
    </AiFlowShell>
  );
}
