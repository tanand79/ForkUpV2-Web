"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { CampaignProvider, useCampaign, type StepId } from "@/lib/campaign-context";
import {
  consumeAuthReturnStep,
  consumeRoleHint,
  getRoleHint,
  readAuthInitialMode,
  resolvePostAuthStep,
  shouldSkipBusinessAiOnboarding,
  stashRoleHint,
  peekClaimLockEmail,
  stashClaimLockEmail,
  clearClaimLockEmail,
  type AccountIntent,
} from "@/lib/campaign-auth";
import { isValidEmail, normalizeEmail } from "@/lib/email-validation";
import { syncAuthSession, buildSessionPatch } from "@/lib/auth-session";
import { ensureGuestNonprofitLinked } from "@/lib/link-guest-nonprofit";
import { ensureGuestBusinessLinked } from "@/lib/link-guest-business";
import {
  isForeignNonprofitTarget,
  isFundraiserOrgDraftLocked,
} from "@/lib/foreign-nonprofit-target";
import { WizardHeader } from "@/components/campaign/WizardHeader";
import { StartFundraising } from "@/components/campaign/StartFundraising";
import { ChooseMethods } from "@/components/campaign/ChooseMethods";
import { ChooseBusinesses } from "@/components/campaign/ChooseBusinesses";
import { InviteBusiness } from "@/components/campaign/InviteBusiness";
import { BusinessInviteFlow } from "@/components/campaign/BusinessInviteFlow";
import { EditBusinessInvite } from "@/components/campaign/EditBusinessInvite";
import { CampaignDetails } from "@/components/campaign/CampaignDetails";
import { AmbassadorSetup } from "@/components/campaign/AmbassadorSetup";
import { GuestBartenderSetup } from "@/components/campaign/GuestBartenderSetup";
import { CampaignMedia } from "@/components/campaign/CampaignMedia";
import { ReviewLaunch } from "@/components/campaign/ReviewLaunch";
import {
  LegacyCampaignReviewDivert,
  LegacyQuickStartDivert,
} from "@/components/campaign/ai-flow/LegacyBuilderToAiDivert";
import { CampaignCreated } from "@/components/campaign/CampaignCreated";
import { CampaignDashboard } from "@/components/campaign/CampaignDashboard";
import { InReviewCampaignPreview } from "@/components/campaign/InReviewCampaignPreview";
import { BusinessProfile } from "@/components/campaign/BusinessProfile";
import { PublicCampaignStepGate } from "@/components/campaign/PublicCampaignStepGate";
import { BusinessAcceptance } from "@/components/campaign/BusinessAcceptance";
import { ReportingSettlement } from "@/components/campaign/ReportingSettlement";
import { CampaignAnalytics } from "@/components/campaign/CampaignAnalytics";
import { ReceiptOcrTracking } from "@/components/campaign/ReceiptOcrTracking";
import { ReceiptUpload } from "@/components/campaign/ReceiptUpload";
import { SupporterReceipts } from "@/components/campaign/SupporterReceipts";
import { NonprofitProfile } from "@/components/campaign/NonprofitProfile";
import { SuccessEngine } from "@/components/campaign/SuccessEngine";
import { ArchitectureMap } from "@/components/campaign/ArchitectureMap";
import { AdminPreload } from "@/components/campaign/AdminPreload";
import { AdminEmailLog } from "@/components/campaign/AdminEmailLog";
import { AdminAccessRequests } from "@/components/campaign/AdminAccessRequests";
import { OrganizationLibrary } from "@/components/campaign/OrganizationLibrary";
import {
  SuperAdminDashboard,
  SuperAdminForgotPassword,
  SuperAdminLogin,
  SuperAdminResetPassword,
} from "@/components/campaign/SuperAdminPanel";
import {
  ChooseAccountType,
  NonprofitClaim,
  BusinessClaim,
  BusinessInvitesNonprofit,
  NonprofitAcceptsInvite,
} from "@/components/campaign/EntryFlows";
import { FundraiserAcceptsInvite } from "@/components/campaign/FundraiserAcceptsInvite";
import { FundraiserDashboard } from "@/components/campaign/FundraiserDashboard";
import { GuestLaunchSent } from "@/components/campaign/GuestLaunchSent";
import { GuestCampaignClaim } from "@/components/campaign/GuestCampaignClaim";
import { GuestBusinessClaim } from "@/components/campaign/GuestBusinessClaim";
import { FundraiserInviteSent } from "@/components/campaign/FundraiserInviteSent";
import { PublicLandingPage } from "@/components/campaign/PublicLandingPage";
import { PublicHomePage } from "@/components/campaign/PublicHomePage";
import { CampaignDirectory } from "@/components/campaign/CampaignDirectory";
import { PastCampaigns } from "@/components/campaign/PastCampaigns";
import { SuccessStories } from "@/components/campaign/SuccessStories";
import { NonprofitDashboard } from "@/components/campaign/NonprofitDashboard";
import { BusinessDashboard } from "@/components/campaign/BusinessDashboard";
import { BusinessAchSettings } from "@/components/campaign/BusinessAchSettings";
import { NonprofitAchSettings } from "@/components/campaign/NonprofitAchSettings";
import { SettlementAchApproval } from "@/components/campaign/SettlementAchApproval";
import { SupporterDashboard } from "@/components/campaign/SupporterDashboard";
import { AccountHub } from "@/components/campaign/AccountHub";
import { SuccessState } from "@/components/campaign/SuccessStates";
import { AuthLogin, AccountIntentPicker } from "@/components/campaign/AuthLogin";
import {
  AuthForgotPassword,
  AuthResetPassword,
} from "@/components/campaign/AuthPasswordRecovery";
import {
  AuthVerifyEmail,
  consumePostVerifyFinishIntent,
  isAwaitingEmailVerify,
  promotePendingAuthToken,
  stashPostVerifyIntent,
  stashPendingVerifyEmail,
  clearPendingSignupAuth,
} from "@/components/campaign/AuthEmailVerification";
import { ChooseOrganizerMode } from "@/components/campaign/ChooseOrganizerMode";
import { CreateFundraiser } from "@/components/campaign/CreateFundraiser";
import { GuidedBuilderShell } from "@/components/campaign/GuidedBuilderShell";
import {
  AiFindOrganization,
  AiConnectSocial,
  AiAnalyzing,
  AiCampaignIdeas,
  AiCampaignPurpose,
  AiCampaignBuild,
  AiCampaignDates,
  AiCampaignPreview,
  AiContinueGuest,
  ClaimedNpoChooser,
} from "@/components/campaign/ai-flow";
import { BusinessAiOnboarding } from "@/components/campaign/business-ai/BusinessAiOnboarding";
import { BusinessJoinFourStep } from "@/components/campaign/business-ai/BusinessJoinFourStep";
import { PartnerCampaignJoin } from "@/components/campaign/PartnerCampaignJoin";

/**
 * Purpose: Detect post-auth return into an in-progress campaign builder/launch path.
 * Inputs: optional StepId from stashAuthReturnStep.
 * Outputs: true when the user should keep draft org context after signup/login.
 */
function isCampaignContinuationStep(step: StepId | null): boolean {
  if (!step) return false;
  return (
    step === "review" ||
    step === "businesses" ||
    step === "invite" ||
    step === "edit-invite" ||
    step === "business-invite-flow" ||
    step === "methods" ||
    step === "details" ||
    step === "media" ||
    step === "ai-campaign-preview" ||
    step === "ai-campaign-dates" ||
    step === "ai-campaign-build" ||
    step === "ai-campaign-purpose" ||
    step === "ai-campaign-ideas" ||
    step === "quick-start" ||
    step === "campaign-review"
  );
}

function AuthLoginScreen() {
  const { goTo, switchActiveRole, update, state, setBusinessProfile } = useCampaign();
  const [mounted, setMounted] = useState(false);
  const [roleHint, setRoleHint] = useState<AccountIntent>("nonprofit");
  const [finishing, setFinishing] = useState(false);
  /** One-shot register open from AI flow after guest continue was removed. */
  const [initialMode, setInitialMode] = useState<"login" | "register">("login");
  /** Claim mail / guest draft email — prefill + lock on signup. */
  const [lockedEmail, setLockedEmail] = useState("");
  /** readAuthInitialMode() consumes storage — only apply once (Strict Mode safe). */
  const authModeAppliedRef = useRef(false);

  useEffect(() => {
    // Guest AI find-org already chose a target → lock fundraiser before optional picker runs.
    const lockedFundraiser = isFundraiserOrgDraftLocked(
      state.accountIntent,
      state.nonprofitProfile,
    );
    const hint = lockedFundraiser
      ? "fundraiser"
      : (getRoleHint() ?? "nonprofit");
    setRoleHint(hint);
    if (lockedFundraiser) stashRoleHint("fundraiser");

    if (!authModeAppliedRef.current) {
      authModeAppliedRef.current = true;
      const savedMode = readAuthInitialMode();
      if (savedMode) {
        setInitialMode(savedMode);
      } else if (hint === "business") {
        // Default new business Join Us to register; existing-business CTAs stash "login".
        setInitialMode("register");
      }
    }

    const fromQuery =
      typeof window !== "undefined"
        ? (new URLSearchParams(window.location.search).get("email") ?? "").trim()
        : "";
    const fromStash = peekClaimLockEmail() ?? "";
    const resolved = normalizeEmail(fromQuery || fromStash);
    if (isValidEmail(resolved)) {
      stashClaimLockEmail(resolved);
      setLockedEmail(resolved);
      // Do not force register here — would override "Already on ForkUp? Sign in".
    }

    setMounted(true);
  }, [state.accountIntent, state.nonprofitProfile]);

  const finishAuth = async (selectedRole: AccountIntent) => {
    setFinishing(true);
    try {
      consumeRoleHint();
      const returnStep = consumeAuthReturnStep();
      // Keep lock until Guest*Claim succeeds; clear for other return paths (manual Create account).
      if (
        returnStep !== "guest-campaign-claim" &&
        returnStep !== "guest-business-claim"
      ) {
        clearClaimLockEmail();
      }

      // Capture guest ownership clues before session patch can clear local profile.
      const pendingNonprofitId = state.nonprofitProfile?.id ?? null;
      const pendingCampaignSlug = state.campaignSlug ?? null;
      const pendingNonprofitProfile = state.nonprofitProfile;
      const pendingBusinessId = state.businessProfile?.id ?? null;
      const pendingBusinessProfile = state.businessProfile;
      const isBrandNewOrgDraft =
        !!pendingNonprofitProfile?.organizationName?.trim() &&
        !(
          typeof pendingNonprofitProfile.id === "number" &&
          pendingNonprofitProfile.id > 0
        );

      // Bound wait so a stuck /auth/context cannot leave the spinner forever.
      // Sync first so we can detect foreign-org vs existing memberships.
      let session = await Promise.race([
        syncAuthSession(selectedRole, { force: true }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 15000)),
      ]);

      const memberships = session?.nonprofitMemberships ?? [];
      const foreignTarget = isForeignNonprofitTarget(
        pendingNonprofitProfile,
        memberships,
      );

      // Existing NPO on this email + draft for a different NPO → fundraiser only.
      // Prevents Hear To Heal hijacking a Headstrong (or other) guest draft.
      let role: AccountIntent = foreignTarget ? "fundraiser" : selectedRole;

      // Brand-new org + no memberships yet: fundraiser signup may proceed as nonprofit claim.
      // Never upgrade when the user already owns another NPO (foreignTarget handles that).
      if (
        !foreignTarget &&
        role === "fundraiser" &&
        isBrandNewOrgDraft &&
        memberships.length === 0 &&
        isCampaignContinuationStep(returnStep)
      ) {
        role = "nonprofit";
      }

      if (role !== selectedRole && session) {
        session = await Promise.race([
          syncAuthSession(role, { force: true }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 15000)),
        ]);
      }

      // Guest-created nonprofit only — never attach an invite-target org when the
      // user signs in as fundraiser/business (that leaked Headstrong onto screen9).
      if (
        role === "nonprofit" &&
        !foreignTarget &&
        (pendingNonprofitId || pendingCampaignSlug)
      ) {
        try {
          const linkedId = await ensureGuestNonprofitLinked({
            nonprofitId: pendingNonprofitId,
            campaignSlug: pendingCampaignSlug,
            alreadyLinkedIds: (session?.nonprofitMemberships ?? [])
              .map((m) => m.id)
              .filter((id): id is number => typeof id === "number"),
          });
          if (linkedId) {
            session = await syncAuthSession(role, { force: true });
          }
        } catch {
          /* best-effort — user can still claim org manually */
        }
      }

      // Guest Join Us business draft → attach after signup/verify.
      if (role === "business" && pendingBusinessId) {
        try {
          const linkedBiz = await ensureGuestBusinessLinked({
            businessId: pendingBusinessId,
            alreadyLinkedIds: (session?.businessMemberships ?? [])
              .map((m) => m.id)
              .filter((id): id is number => typeof id === "number"),
          });
          if (linkedBiz) {
            session = await syncAuthSession(role, { force: true });
          }
        } catch {
          /* best-effort — server verify also links by contact email */
        }
      }

      if (!session) {
        // Token is already saved — send user to hub; dashboard will retry sync.
        goTo(
          role === "business"
            ? "business-dashboard"
            : role === "supporter"
              ? "supporter-dashboard"
              : role === "fundraiser"
                ? "fundraiser-dashboard"
                : "nonprofit-dashboard",
        );
        return;
      }

      const patch = buildSessionPatch(session);

      if (foreignTarget && pendingNonprofitProfile) {
        // Keep invite-target org; do not replace with membership (e.g. Hear To Heal).
        update({
          ...patch,
          accountIntent: "fundraiser",
          nonprofitProfile: pendingNonprofitProfile,
        });
        switchActiveRole("fundraiser");
        update({
          accountIntent: "fundraiser",
          nonprofitProfile: pendingNonprofitProfile,
        });
        stashRoleHint("fundraiser");
      } else if (
        role === "nonprofit" &&
        !patch.nonprofitProfile &&
        pendingNonprofitProfile
      ) {
        // Keep in-progress claim profile only for nonprofit role (not invite targets).
        update({
          ...patch,
          nonprofitProfile: pendingNonprofitProfile,
        });
        switchActiveRole(role);
      } else {
        update(patch);
        switchActiveRole(role);
      }

      // Guest→signup: org is often created only at Launch, so memberships are
      // still empty. Re-apply the draft profile after switchActiveRole so Launch
      // does not bounce to nonprofit-claim.
      if (
        !foreignTarget &&
        role === "nonprofit" &&
        pendingNonprofitProfile &&
        (session.nonprofitMemberships?.length ?? 0) === 0
      ) {
        update({ nonprofitProfile: pendingNonprofitProfile });
      }

      if (
        role === "business" &&
        pendingBusinessProfile &&
        (session.businessMemberships?.length ?? 0) === 0
      ) {
        update({ businessProfile: pendingBusinessProfile });
        setBusinessProfile(pendingBusinessProfile);
      }

      const inviteToken =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("token")?.trim() || undefined
          : undefined;

      if (
        (returnStep === "business-ai-onboarding" ||
          returnStep === "business-giveback-join") &&
        shouldSkipBusinessAiOnboarding(
          session.businessMemberships.length,
          Boolean(session.businessProfile?.id),
        )
      ) {
        // Public-campaign join intent → continue invite/join process, not dashboard.
        let partnerSlug = "";
        try {
          const raw = sessionStorage.getItem("forkup-partner-join-intent");
          if (raw) {
            const parsed = JSON.parse(raw) as { campaignSlug?: string };
            partnerSlug = parsed?.campaignSlug?.trim() || "";
          }
        } catch {
          /* ignore */
        }
        if (partnerSlug) {
          goTo("partner-campaign-join", { query: { campaign: partnerSlug } });
          return;
        }
        goTo(
          inviteToken ? "business-acceptance" : "business-dashboard",
          inviteToken ? { query: { token: inviteToken } } : undefined,
        );
        return;
      }

      // Prefer explicit return to partner join after signup from a public campaign.
      if (returnStep === "partner-campaign-join") {
        const {
          reconcilePartnerJoinIntentForUser,
          consumePartnerJoinExistingLogin,
          markPartnerJoinFindCompleted,
          stashPartnerJoinIntent,
        } = await import("@/lib/partner-join-intent");

        const ownedIds = [
          ...session.businessMemberships.map((b) => b.id),
          ...(session.businessProfile?.id ? [session.businessProfile.id] : []),
        ].filter((id) => Number.isFinite(id) && id > 0);

        const intent = reconcilePartnerJoinIntentForUser({
          userId: session.userId,
          ownedBusinessIds: ownedIds,
        });
        // Consume flag (existing-business sign-in path); owned biz still binds below.
        consumePartnerJoinExistingLogin();

        const qCampaign =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("campaign")?.trim() ||
              ""
            : "";
        const campaignSlug = intent?.campaignSlug?.trim() || qCampaign;
        const doorType = intent?.doorType ?? "restaurant";

        const pickOwnedBiz = (businessId?: number) => {
          if (businessId && ownedIds.includes(businessId)) {
            return (
              session.businessMemberships.find((b) => b.id === businessId) ??
              (session.businessProfile?.id === businessId
                ? session.businessProfile
                : null)
            );
          }
          return null;
        };

        // Existing ForkUp business — go straight to Send join request (not Find).
        const ownedBiz =
          pickOwnedBiz(intent?.businessId) ??
          session.businessProfile ??
          session.businessMemberships[0] ??
          null;
        if (campaignSlug && ownedBiz?.id) {
          markPartnerJoinFindCompleted({
            businessId: ownedBiz.id,
            locationId:
              "locationId" in ownedBiz
                ? Number(ownedBiz.locationId) || undefined
                : undefined,
            ownerUserId: session.userId,
          });
          goTo("partner-campaign-join", { query: { campaign: campaignSlug } });
          return;
        }

        // New account / no business yet — Find My Restaurant.
        if (campaignSlug) {
          stashPartnerJoinIntent({
            campaignSlug,
            doorType,
            requireFind: true,
            findCompleted: false,
          });
          goTo("business-giveback-join", { query: { campaign: campaignSlug } });
          return;
        }

        goTo("partner-campaign-join");
        return;
      }

      const destination = resolvePostAuthStep(
        returnStep,
        role,
        session.nonprofitMemberships.length,
        session.businessMemberships.length,
      );

      if (
        (destination === "business-ai-onboarding" ||
          destination === "business-giveback-join") &&
        inviteToken
      ) {
        goTo(destination, { query: { token: inviteToken } });
        return;
      }

      // Foreign-org draft must resume the invite (fundraiser) UI, not nonprofit Launch.
      if (foreignTarget) {
        goTo(
          returnStep === "ai-campaign-preview" ||
            returnStep === "ai-campaign-dates" ||
            returnStep === "ai-campaign-build" ||
            returnStep === "ai-campaign-ideas" ||
            returnStep === "ai-campaign-purpose"
            ? returnStep
            : "ai-campaign-preview",
        );
        return;
      }

      goTo(destination);
    } finally {
      setFinishing(false);
    }
  };

  useEffect(() => {
    if (!mounted) return;
    const pendingIntent = consumePostVerifyFinishIntent();
    if (
      pendingIntent === "nonprofit" ||
      pendingIntent === "business" ||
      pendingIntent === "supporter" ||
      pendingIntent === "fundraiser"
    ) {
      promotePendingAuthToken();
      setFinishing(true);
      void finishAuth(pendingIntent);
      return;
    }
    // Sign-in / sign-up screen must not show a leftover signed-in header.
    clearPendingSignupAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  const lockFundraiserDraft = isFundraiserOrgDraftLocked(
    state.accountIntent,
    state.nonprofitProfile,
  );

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-5 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-bold tracking-tight">
        {roleHint === "business" ? "Join as a business partner" : "Welcome back"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {roleHint === "business"
          ? "Create a free account to set up your business profile. Already registered? Switch to Sign in below — we will take you to your business dashboard."
          : lockFundraiserDraft
            ? "Sign in to continue as a fundraiser for the organization you selected. If this email already has a nonprofit, you will invite them — not claim their org."
            : "Sign in to continue your fundraiser, or create a free account."}
      </p>

      {mounted && (
        <div className="mt-8">
          <AuthLogin
            intent={lockFundraiserDraft ? "fundraiser" : roleHint}
            initialMode={initialMode}
            initialEmail={lockedEmail || undefined}
            lockEmail={Boolean(lockedEmail)}
            onSuccess={async (selectedRole) => {
              if (isAwaitingEmailVerify()) {
                return;
              }
              await finishAuth(selectedRole);
            }}
            onRegistered={(registeredEmail) => {
              const intent = lockFundraiserDraft ? "fundraiser" : roleHint;
              stashPostVerifyIntent(intent);
              stashPendingVerifyEmail(registeredEmail);
              // Clear any leftover ?token= so we do not auto-verify and show a false error.
              goTo("auth-verify-email", {
                query: { email: registeredEmail, token: undefined },
              });
            }}
            onForgotPassword={() => goTo("auth-forgot-password")}
            linkOrganization={
              // Only register→link when intentionally claiming as nonprofit.
              // Fundraiser/business invite targets must not become memberships.
              !lockFundraiserDraft &&
              roleHint === "nonprofit" &&
              state.nonprofitProfile?.id
                ? {
                    organizationType: "nonprofit",
                    organizationId: state.nonprofitProfile.id,
                  }
                : undefined
            }
          />
          {finishing && (
            <p className="mt-4 text-center text-sm text-muted-foreground">Loading your account…</p>
          )}
        </div>
      )}

      {/* Locked when guest/AI already selected an org to raise for. */}
      {lockFundraiserDraft ? (
        <p className="mt-8 rounded-xl border border-border bg-card/40 p-3 text-xs text-muted-foreground">
          Account type locked to <span className="font-semibold text-foreground">Fundraiser</span>{" "}
          for{" "}
          <span className="font-semibold text-foreground">
            {state.nonprofitProfile?.organizationName}
          </span>
          . Emails that already own another nonprofit must invite this organization — they cannot
          create the campaign under their own NPO.
        </p>
      ) : (
        <details className="mt-8 rounded-xl border border-border bg-card/40 p-3">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Account type (optional)
          </summary>
          <div className="mt-3">
            <AccountIntentPicker
              value={roleHint}
              onChange={(next) => {
                setRoleHint(next);
                stashRoleHint(next);
              }}
            />
          </div>
        </details>
      )}
    </main>
  );
}

function WizardBody() {
  const { step, goTo } = useCampaign();
  switch (step) {
    case "start":
      return <StartFundraising />;
    case "website-landing":
      return <PublicHomePage />;
    case "website-marketing":
      return <PublicLandingPage />;
    case "campaign-directory":
      return <CampaignDirectory />;
    case "past-campaigns":
      return <PastCampaigns />;
    case "success-stories":
      return <SuccessStories />;
    case "choose-account-type":
      return <ChooseAccountType />;
    case "account-hub":
      return <AccountHub />;
    case "nonprofit-claim":
      return <NonprofitClaim />;
    case "business-claim":
      return <BusinessClaim />;
    case "business-ai-onboarding":
      return (
        <Suspense
          fallback={
            <div className="flex justify-center py-20">
              <span className="text-sm text-muted-foreground">Loading business setup…</span>
            </div>
          }
        >
          <BusinessAiOnboarding />
        </Suspense>
      );
    case "business-giveback-join":
      return <BusinessJoinFourStep />;
    case "partner-campaign-join":
      return (
        <Suspense
          fallback={
            <div className="flex justify-center py-20">
              <span className="text-sm text-muted-foreground">Loading join request…</span>
            </div>
          }
        >
          <PartnerCampaignJoin />
        </Suspense>
      );
    case "business-invites-nonprofit":
      return <BusinessInvitesNonprofit />;
    case "nonprofit-accepts-invite":
      return (
        <Suspense
          fallback={
            <div className="flex justify-center py-20">
              <span className="text-sm text-muted-foreground">Loading invitation…</span>
            </div>
          }
        >
          <NonprofitAcceptsInvite />
        </Suspense>
      );
    case "fundraiser-invite-accept":
      return (
        <Suspense
          fallback={
            <div className="flex justify-center py-20">
              <span className="text-sm text-muted-foreground">Loading invitation…</span>
            </div>
          }
        >
          <FundraiserAcceptsInvite />
        </Suspense>
      );
    case "fundraiser-dashboard":
      return <FundraiserDashboard />;
    case "nonprofit-dashboard":
      return <NonprofitDashboard />;
    case "business-dashboard":
      return <BusinessDashboard />;
    case "ach-settings":
      return <BusinessAchSettings />;
    case "nonprofit-ach-settings":
      return <NonprofitAchSettings />;
    case "settlement-ach-approval":
      return <SettlementAchApproval />;
    case "supporter-dashboard":
      return <SupporterDashboard />;
    case "auth-login":
      return <AuthLoginScreen />;
    case "auth-forgot-password":
      return <AuthForgotPassword />;
    case "auth-reset-password":
      return (
        <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="size-6 animate-spin text-primary" /></div>}>
          <AuthResetPassword />
        </Suspense>
      );
    case "auth-verify-email":
      return (
        <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="size-6 animate-spin text-primary" /></div>}>
          <AuthVerifyEmail />
        </Suspense>
      );
    case "choose-organizer-mode":
      return <ChooseOrganizerMode />;
    case "create-fundraiser":
      return <CreateFundraiser />;
    case "quick-start":
      // Legacy Lovable Build — always divert into AI funnel (file kept for Design Mode).
      return <LegacyQuickStartDivert />;
    case "ai-find-org":
      return <AiFindOrganization />;
    case "claimed-npo-chooser":
      return <ClaimedNpoChooser />;
    case "ai-connect-social":
      return <AiConnectSocial />;
    case "ai-analyzing":
      return <AiAnalyzing />;
    case "ai-campaign-ideas":
      return <AiCampaignIdeas />;
    case "ai-campaign-purpose":
      return <AiCampaignPurpose />;
    case "ai-campaign-build":
      return <AiCampaignBuild />;
    case "ai-campaign-dates":
      return <AiCampaignDates />;
    case "ai-campaign-preview":
      return <AiCampaignPreview />;
    case "ai-continue-guest":
      return <AiContinueGuest />;
    case "guest-launch-sent":
      return (
        <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="size-6 animate-spin text-primary" /></div>}>
          <GuestLaunchSent />
        </Suspense>
      );
    case "guest-campaign-claim":
      return (
        <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="size-6 animate-spin text-primary" /></div>}>
          <GuestCampaignClaim />
        </Suspense>
      );
    case "guest-business-claim":
      return (
        <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="size-6 animate-spin text-primary" /></div>}>
          <GuestBusinessClaim />
        </Suspense>
      );
    case "fundraiser-invite-sent":
      return (
        <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="size-6 animate-spin text-primary" /></div>}>
          <FundraiserInviteSent />
        </Suspense>
      );
    case "campaign-review":
      // Legacy Lovable Review — divert to AI preview (CampaignReview kept for Design Mode).
      return <LegacyCampaignReviewDivert />;
    case "methods":
      return (
        <GuidedBuilderShell step="methods">
          <ChooseMethods />
        </GuidedBuilderShell>
      );
    case "businesses":
      return (
        <GuidedBuilderShell step="businesses">
          <ChooseBusinesses />
        </GuidedBuilderShell>
      );
    case "invite":
      return (
        <GuidedBuilderShell step="invite">
          <InviteBusiness />
        </GuidedBuilderShell>
      );
    case "business-invite-flow":
      return (
        <Suspense fallback={<div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>}>
          <BusinessInviteFlow />
        </Suspense>
      );
    case "edit-invite":
      return (
        <Suspense fallback={<div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>}>
          <EditBusinessInvite />
        </Suspense>
      );
    case "details":
      return (
        <GuidedBuilderShell step="details">
          <CampaignDetails />
        </GuidedBuilderShell>
      );
    case "guestBartending":
      return <GuestBartenderSetup />;
    case "ambassador":
      return <AmbassadorSetup />;
    case "media":
      return (
        <GuidedBuilderShell step="media">
          <CampaignMedia />
        </GuidedBuilderShell>
      );
    case "review":
      return (
        <GuidedBuilderShell step="review">
          <ReviewLaunch />
        </GuidedBuilderShell>
      );
    case "created":
      return <CampaignCreated />;
    case "dashboard":
      return <CampaignDashboard />;
    case "in-review-preview":
      return <InReviewCampaignPreview />;
    case "receipt-ocr":
      return <ReceiptOcrTracking />;
    case "receipt-upload":
      return <ReceiptUpload />;
    case "supporter-receipts":
      return <SupporterReceipts />;
    case "business-profile":
      return <BusinessProfile />;
    case "campaign-page":
      return <PublicCampaignStepGate />;
    case "business-acceptance":
      return (
        <Suspense
          fallback={
            <div className="flex justify-center py-20">
              <span className="text-sm text-muted-foreground">Loading invitation…</span>
            </div>
          }
        >
          <BusinessAcceptance />
        </Suspense>
      );
    case "reporting":
      return <ReportingSettlement />;
    case "analytics":
      return <CampaignAnalytics />;
    case "nonprofit-profile":
      return <NonprofitProfile />;
    case "success-engine":
      return <SuccessEngine />;
    case "architecture-map":
      return <ArchitectureMap />;
    case "admin-preload":
      return <AdminPreload />;
    case "admin-email-log":
      return <AdminEmailLog />;
    case "admin-access-requests":
      return <AdminAccessRequests />;
    case "super-admin-login":
      return <SuperAdminLogin />;
    case "super-admin-forgot-password":
      return <SuperAdminForgotPassword />;
    case "super-admin-reset-password":
      return (
        <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="size-6 animate-spin text-primary" /></div>}>
          <SuperAdminResetPassword />
        </Suspense>
      );
    case "super-admin":
      return <SuperAdminDashboard />;
    case "organization-library":
      return <OrganizationLibrary />;
    case "success-virtual":
    case "success-ambassador":
    case "success-bartending":
    case "success-giveback-live":
    case "success-mixed":
      return <SuccessState variant={step} />;
    default:
      return <StartFundraising />;
  }
}

export function CampaignApp({ initialStep = "website-landing" }: { initialStep?: StepId }) {
  return (
    <CampaignProvider initialStep={initialStep}>
      <div className="min-h-screen bg-background">
        <WizardHeader />
        <WizardBody />
      </div>
    </CampaignProvider>
  );
}
