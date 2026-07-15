"use client";

import type { ReactNode } from "react";
import { useCampaign, type StepId } from "@/lib/campaign-context";
import { GuidedHelpPanel } from "@/components/campaign/GuidedHelpPanel";

const BUILDER_STEPS: StepId[] = [
  "methods",
  "details",
  "businesses",
  "invite",
  "media",
  "review",
];

export function GuidedBuilderShell({
  step,
  children,
}: {
  step: StepId;
  children: ReactNode;
}) {
  const { state } = useCampaign();
  const showHelp =
    state.organizerMode === "guided" && BUILDER_STEPS.includes(step);

  if (!showHelp) return <>{children}</>;

  return (
    <>
      <div className="mx-auto max-w-3xl px-5 pt-4 sm:px-6">
        <GuidedHelpPanel step={step} />
      </div>
      {children}
    </>
  );
}
