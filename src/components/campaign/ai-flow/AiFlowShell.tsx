"use client";

/**
 * Shared chrome for the parallel AI-first create flow screens.
 * Inputs: title, subtitle, children, optional back handler.
 * Output: simple centered layout (does not modify SiteHeader).
 */
import { ArrowLeft } from "lucide-react";
import { assetSrc } from "@/lib/utils";
import forkupLogo from "@/assets/forkup-logo-header.png";
import { useCampaign } from "@/lib/campaign-context";
import { HeaderAuthActions } from "../HeaderAuthActions";

export function AiFlowShell({
  title,
  subtitle,
  backStep,
  onBack,
  children,
}: {
  title: string;
  subtitle?: string;
  backStep?: Parameters<ReturnType<typeof useCampaign>["goTo"]>[0];
  onBack?: () => void;
  children: React.ReactNode;
}) {
  const { goTo } = useCampaign();

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl flex-col px-5 py-8 sm:px-6">
      {/* Top row: Back (left) + Sign in / Sign out (right) */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            if (onBack) onBack();
            else if (backStep) goTo(backStep);
            else goTo("website-landing");
          }}
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back
        </button>
        <HeaderAuthActions step="ai-flow" />
      </div>

      <button
        type="button"
        onClick={() => goTo("website-landing")}
        className="mb-8 self-start"
        aria-label="ForkUp home"
      >
        <img
          src={assetSrc(forkupLogo)}
          alt="ForkUp"
          width={200}
          height={90}
          className="h-14 w-auto object-contain"
        />
      </button>

      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
        Create in 60 seconds
      </p>
      <h1 className="font-display mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
        {title}
      </h1>
      {subtitle ? <p className="mt-3 text-sm text-muted-foreground">{subtitle}</p> : null}

      <div className="mt-8">{children}</div>
    </main>
  );
}
