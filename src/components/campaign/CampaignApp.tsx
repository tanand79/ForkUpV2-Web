"use client";

import { Suspense, useEffect, useState } from "react";
import { CampaignProvider, useCampaign, type StepId } from "@/lib/campaign-context";
import {
  consumeAuthReturnStep,
  consumeRoleHint,
  getRoleHint,
  resolvePostAuthStep,
  stashRoleHint,
  UNIFIED_AUTH_COPY,
  type AccountIntent,
} from "@/lib/campaign-auth";
import { syncAuthSession, buildSessionPatch } from "@/lib/auth-session";
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
import { CampaignCreated } from "@/components/campaign/CampaignCreated";
import { CampaignDashboard } from "@/components/campaign/CampaignDashboard";
import { BusinessProfile } from "@/components/campaign/BusinessProfile";
import { CampaignPage } from "@/components/campaign/CampaignPage";
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
  ChooseAccountType,
  NonprofitClaim,
  BusinessClaim,
  BusinessInvitesNonprofit,
  NonprofitAcceptsInvite,
} from "@/components/campaign/EntryFlows";
import { PublicLandingPage } from "@/components/campaign/PublicLandingPage";
import { CampaignDirectory } from "@/components/campaign/CampaignDirectory";
import { PastCampaigns } from "@/components/campaign/PastCampaigns";
import { SuccessStories } from "@/components/campaign/SuccessStories";
import { NonprofitDashboard } from "@/components/campaign/NonprofitDashboard";
import { BusinessDashboard } from "@/components/campaign/BusinessDashboard";
import { SupporterDashboard } from "@/components/campaign/SupporterDashboard";
import { AccountHub } from "@/components/campaign/AccountHub";
import { SuccessState } from "@/components/campaign/SuccessStates";
import { AuthLogin, AccountIntentPicker } from "@/components/campaign/AuthLogin";
import { ChooseOrganizerMode } from "@/components/campaign/ChooseOrganizerMode";
import { QuickStart } from "@/components/campaign/QuickStart";
import { GuidedBuilderShell } from "@/components/campaign/GuidedBuilderShell";

function AuthLoginScreen() {
  const { goTo, switchActiveRole, update } = useCampaign();
  const [mounted, setMounted] = useState(false);
  const [roleHint, setRoleHint] = useState<AccountIntent>("nonprofit");
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    setRoleHint(getRoleHint() ?? "nonprofit");
    setMounted(true);
  }, []);

  const handleRoleHintChange = (next: AccountIntent) => {
    setRoleHint(next);
    stashRoleHint(next);
  };

  const finishAuth = async (selectedRole: AccountIntent) => {
    setFinishing(true);
    try {
      consumeRoleHint();
      const returnStep = consumeAuthReturnStep();
      const role = selectedRole;

      const session = await syncAuthSession(role, { force: true });
      if (!session) return;

      update(buildSessionPatch(session));
      switchActiveRole(role);

      goTo(
        resolvePostAuthStep(
          returnStep,
          role,
          session.nonprofitMemberships.length,
          session.businessMemberships.length,
        ),
      );
    } finally {
      setFinishing(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-5 py-10 sm:px-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Sign in to ForkUp</h1>
      <p className="mt-2 text-sm text-muted-foreground">{UNIFIED_AUTH_COPY.description}</p>

      <div className="mt-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          What are you doing today? (optional)
        </p>
        <AccountIntentPicker value={roleHint} onChange={handleRoleHintChange} />
      </div>

      {mounted && (
        <div className="mt-8">
          <AuthLogin intent={roleHint} onSuccess={finishAuth} />
          {finishing && (
            <p className="mt-4 text-center text-sm text-muted-foreground">Loading your account…</p>
          )}
        </div>
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
    case "nonprofit-dashboard":
      return <NonprofitDashboard />;
    case "business-dashboard":
      return <BusinessDashboard />;
    case "supporter-dashboard":
      return <SupporterDashboard />;
    case "auth-login":
      return <AuthLoginScreen />;
    case "choose-organizer-mode":
      return <ChooseOrganizerMode />;
    case "quick-start":
      return <QuickStart />;
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
    case "receipt-ocr":
      return <ReceiptOcrTracking />;
    case "receipt-upload":
      return <ReceiptUpload />;
    case "supporter-receipts":
      return <SupporterReceipts />;
    case "business-profile":
      return <BusinessProfile />;
    case "campaign-page":
      return <CampaignPage />;
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
