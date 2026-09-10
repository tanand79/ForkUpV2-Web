"use client";

/**
 * AI flow Steps 9–10 — formerly "Continue as Guest".
 *
 * Purpose: Legacy step URL (`ai-continue-guest`) now redirects to signup/login
 * (or businesses/review when already authenticated). Guest continue UI is removed.
 *
 * Inputs: campaign goTo + auth token + selected methods + accountIntent.
 * Outputs: navigation only (no persistent UI).
 *
 * Changelog:
 * - Removed Continue as Guest; force account path before launch.
 * - Dine & Donate / Guest Bartending → return to businesses invite step
 *   (same rule as AiCampaignPreview / builderFlowForState).
 * - Keep fundraiser intent for find-org drafts (do not force nonprofit).
 */
import { useEffect } from "react";
import { useCampaign } from "@/lib/campaign-context";
import { getAuthToken } from "@/lib/auth-storage";
import { stashAccountIntent, stashAuthReturnStep } from "@/lib/campaign-auth";
import { AiFlowShell } from "./AiFlowShell";

export function AiContinueGuest() {
  const { state, goTo } = useCampaign();

  useEffect(() => {
    const needsBusinessInvite =
      state.methods.giveback || state.methods.guestBartending;
    const nextStep = needsBusinessInvite ? "businesses" : "review";
    if (getAuthToken()) {
      goTo(nextStep);
      return;
    }
    // Find-org / raise-for path is fundraiser. Never force nonprofit here —
    // that let existing-NPO emails create under the wrong org after sign-in.
    const intent =
      state.accountIntent === "nonprofit" ? "nonprofit" : "fundraiser";
    stashAccountIntent(intent);
    stashAuthReturnStep(nextStep);
    sessionStorage.setItem("forkup-auth-initial-mode", "register");
    goTo("auth-login");
  }, [
    goTo,
    state.accountIntent,
    state.methods.giveback,
    state.methods.guestBartending,
  ]);

  return (
    <AiFlowShell
      title="Create your account"
      subtitle="Sign up to save your campaign and continue."
      backStep="ai-campaign-preview"
    >
      <p className="text-center text-sm text-muted-foreground">Redirecting…</p>
    </AiFlowShell>
  );
}
