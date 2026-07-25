import { ArrowLeft, LogOut } from "lucide-react";
import { useCampaign, SETUP_STEPS, type StepId } from "@/lib/campaign-context";
import { resolveDashboardStep, roleHintFromStep, stashDashboardReturn } from "@/lib/campaign-auth";
import { getAuthToken } from "@/lib/auth-storage";
import { useClientMounted } from "@/lib/use-client-mounted";
import { RoleSwitcher } from "./RoleSwitcher";
import { LaunchChecklist } from "./LaunchChecklist";
import { SetupProgress } from "./SetupProgress";
import { HeaderAuthActions } from "./HeaderAuthActions";
import {
  HeaderPillButton,
  SiteHeader,
  SiteHeaderLogo,
} from "./SiteHeader";

/** Legacy advanced builder (methods → details → media → review) — LaunchChecklist tabs. */
const ADVANCED_BUILDER_STEPS: StepId[] = ["methods", "details", "media"];

const POST_CREATION_STEPS: StepId[] = [
  "created",
  "dashboard",
  "business-profile",
  "campaign-page",
  "reporting",
  "receipt-ocr",
  "nonprofit-profile",
  "success-engine",
  "architecture-map",
  "business-invite-flow",
  "edit-invite",
  "ambassador",
  "guestBartending",
  "campaign-directory",
  "choose-account-type",
  "nonprofit-claim",
  "business-claim",
  "business-invites-nonprofit",
  "nonprofit-accepts-invite",
  "nonprofit-dashboard",
  "business-dashboard",
  "supporter-dashboard",
  "account-hub",
  "auth-login",
  "success-virtual",
  "success-ambassador",
  "success-bartending",
  "success-giveback-live",
  "success-mixed",
];

export function WizardHeader() {
  const { progressSteps, activeProgressIndex, step, saveAndExit, goTo, state } = useCampaign();
  const mounted = useClientMounted();
  const total = progressSteps.length;
  const currentIndex = activeProgressIndex;
  const currentLabel = currentIndex >= 0 ? progressSteps[currentIndex]?.label : null;
  const dashboardStep = resolveDashboardStep(
    state.accountIntent,
    state.nonprofitMemberships.length > 0,
    state.businessMemberships.length > 0,
    step,
  );
  const hasDashboard =
    mounted &&
    (Boolean(getAuthToken()) ||
      state.nonprofitMemberships.length > 0 ||
      state.businessMemberships.length > 0);

  const handleBackToHome = () => {
    stashDashboardReturn(step, state.accountIntent ?? roleHintFromStep(step));
    goTo("website-landing");
  };

  const HomeLogo = <SiteHeaderLogo onClick={handleBackToHome} />;

  const BackToHome = (
    <HeaderPillButton onClick={handleBackToHome}>
      <ArrowLeft className="size-3.5" />
      Back to home
    </HeaderPillButton>
  );

  const BackToDashboard = hasDashboard ? (
    <HeaderPillButton
      onClick={() =>
        goTo(
          dashboardStep === "nonprofit-claim" || dashboardStep === "business-claim"
            ? "account-hub"
            : dashboardStep,
        )
      }
    >
      <ArrowLeft className="size-3.5" />
      Back to dashboard
    </HeaderPillButton>
  ) : null;

  const SaveExit = (
    <HeaderPillButton onClick={saveAndExit}>
      <LogOut className="size-3.5" />
      Save &amp; Exit
    </HeaderPillButton>
  );

  if (step === "website-landing" || step === "past-campaigns" || step === "success-stories") {
    return null;
  }

  if (
    step === "super-admin-login" ||
    step === "super-admin-forgot-password" ||
    step === "super-admin-reset-password" ||
    step === "super-admin"
  ) {
    return null;
  }

  // Lovable Build → Review → Partners → Launch (guided / AI draft path only).
  const lovableSetup =
    step === "quick-start" ||
    step === "campaign-review" ||
    (Boolean(state.aiDrafted) &&
      SETUP_STEPS.includes(step) &&
      !ADVANCED_BUILDER_STEPS.includes(step));
  if (lovableSetup) {
    return (
      <SiteHeader
        leading={HomeLogo}
        trailing={
          <>
            {BackToDashboard}
            <RoleSwitcher />
            <HeaderAuthActions step={step} />
            {SaveExit}
          </>
        }
        below={
          <div className="pb-3">
            <SetupProgress />
          </div>
        }
      />
    );
  }

  if (step === "start" || step === "choose-organizer-mode" || step === "create-fundraiser") {
    return (
      <SiteHeader
        sticky={false}
        leading={HomeLogo}
        trailing={
          <>
            {BackToDashboard}
            {BackToHome}
            <RoleSwitcher />
            <HeaderAuthActions step={step} />
          </>
        }
      />
    );
  }

  if (POST_CREATION_STEPS.includes(step)) {
    return (
      <SiteHeader
        leading={HomeLogo}
        trailing={
          <>
            {step !== "nonprofit-dashboard" &&
              step !== "business-dashboard" &&
              step !== "supporter-dashboard" &&
              step !== "account-hub" &&
              BackToDashboard}
            {BackToHome}
            <RoleSwitcher />
            <HeaderAuthActions step={step} />
            {step !== "nonprofit-dashboard" &&
              step !== "business-dashboard" &&
              step !== "supporter-dashboard" &&
              step !== "account-hub" &&
              SaveExit}
          </>
        }
      />
    );
  }

  const progress = currentIndex >= 0 ? ((currentIndex + 1) / total) * 100 : 8;
  const showLaunchChecklist =
    ADVANCED_BUILDER_STEPS.includes(step) ||
    step === "businesses" ||
    step === "invite" ||
    step === "review";

  return (
    <SiteHeader
      leading={HomeLogo}
      trailing={
        showLaunchChecklist ? (
          <>
            {BackToDashboard}
            <RoleSwitcher />
            <HeaderAuthActions step={step} />
            {SaveExit}
          </>
        ) : (
          <>
            <span className="text-sm font-semibold text-foreground">
              {currentIndex >= 0 ? `Step ${currentIndex + 1} of ${total}` : "Get started"}
            </span>
            {currentLabel && (
              <span className="hidden text-xs font-medium text-muted-foreground sm:inline">
                {currentLabel}
              </span>
            )}
            {BackToDashboard}
            {BackToHome}
            <RoleSwitcher />
            <HeaderAuthActions step={step} />
            {SaveExit}
          </>
        )
      }
      below={
        showLaunchChecklist ? (
          <div className="pb-4">
            <LaunchChecklist />
          </div>
        ) : (
          <div className="pb-4">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )
      }
    />
  );
}
