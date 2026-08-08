"use client";

/**
 * AI flow Step 4 — Analyzing content (visible progress, guest allowed).
 *
 * Purpose: Run backend analyze while showing a checklist progress UI, then
 * open the idea picker.
 *
 * Inputs: pending org (+ optional social URLs) from ai-campaign-flow-storage.
 * Outputs: session token in storage; campaign profile/promotion update;
 * navigates to ai-campaign-ideas.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Circle, Loader2, Sparkles } from "lucide-react";
import { useCampaign } from "@/lib/campaign-context";
import { analyzeAiCampaignFlow } from "@/lib/api-ai-campaign-flow";
import {
  clearAiFlowPendingOrg,
  loadAiFlowPendingOrg,
  saveAiFlowStore,
} from "@/lib/ai-campaign-flow-storage";
import { AiFlowShell } from "./AiFlowShell";

const ANALYZE_CHECKLIST = [
  "Organization logo",
  "Photos & cover images",
  "Mission & story",
  "Recent posts & events",
  "Past campaigns",
  "Popular themes",
];

export function AiAnalyzing() {
  const { update, goTo, state } = useCampaign();
  const [progressIdx, setProgressIdx] = useState(0);
  const [apiFinished, setApiFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);
  const navigatedRef = useRef(false);

  const finishAndGo = useCallback(() => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    goTo("ai-campaign-ideas");
  }, [goTo]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const pending = loadAiFlowPendingOrg();
    if (!pending) {
      goTo("ai-find-org");
      return;
    }

    void (async () => {
      try {
        const session = await analyzeAiCampaignFlow({
          organizationName: pending.organizationName,
          ein: pending.ein,
          nonprofitId: pending.nonprofitId,
          website: pending.website,
          facebookUrl: pending.facebookUrl,
          instagramUrl: pending.instagramUrl,
          linkedinUrl: pending.linkedinUrl,
          mission: pending.mission,
          causeCategory: pending.causeCategory,
          city: pending.city,
          state: pending.state,
        });

        saveAiFlowStore({
          sessionToken: session.sessionToken,
          organizationName: pending.organizationName,
          selectedIdeaId: null,
          guestContinued: false,
        });

        update({
          accountIntent: "nonprofit",
          nonprofitProfile: {
            id: pending.nonprofitId && pending.nonprofitId > 0 ? pending.nonprofitId : undefined,
            organizationName: pending.organizationName,
            contactName: pending.contactName || "",
            contactEmail: pending.contactEmail || "",
            mission: pending.mission || session.analysis?.mission || undefined,
            causeCategory: pending.causeCategory || undefined,
            verificationStatus: pending.verificationStatus || undefined,
            claimStatus: pending.claimStatus || undefined,
          },
          promotion: {
            facebookUrl: session.facebookUrl || pending.facebookUrl || state.promotion.facebookUrl,
            instagramHandle:
              session.instagramUrl || pending.instagramUrl || state.promotion.instagramHandle,
            websiteUrl: session.website || pending.website || state.promotion.websiteUrl,
            newsletter: state.promotion.newsletter,
          },
          organizerMode: "guided",
          methods: {
            giveback: false,
            donations: true,
            guestBartending: false,
            ambassador: true,
          },
        });

        clearAiFlowPendingOrg();
        setApiFinished(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not analyze your content.");
        setApiFinished(true);
      }
    })();
  }, [goTo, state.promotion.facebookUrl, state.promotion.instagramHandle, state.promotion.newsletter, state.promotion.websiteUrl, update]);

  useEffect(() => {
    if (error) return;
    if (progressIdx >= ANALYZE_CHECKLIST.length) {
      if (!apiFinished) return;
      const done = setTimeout(() => finishAndGo(), 400);
      return () => clearTimeout(done);
    }
    const tick = setTimeout(() => setProgressIdx((i) => i + 1), 700);
    return () => clearTimeout(tick);
  }, [progressIdx, apiFinished, error, finishAndGo]);

  const pct = Math.min(
    100,
    Math.round(((progressIdx + (apiFinished ? 0.5 : 0)) / ANALYZE_CHECKLIST.length) * 100),
  );

  return (
    <AiFlowShell
      title="Analyzing your content..."
      subtitle="ForkUp is extracting signals from your public pages."
      backStep="ai-connect-social"
    >
      {error ? (
        <div className="space-y-4">
          <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          <button
            type="button"
            onClick={() => goTo("ai-connect-social")}
            className="text-sm font-semibold text-primary"
          >
            Back to connect accounts
          </button>
        </div>
      ) : (
        <>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${Math.max(8, pct)}%` }}
            />
          </div>

          <p className="mt-6 text-sm font-semibold">AI is extracting:</p>
          <div className="mt-3 space-y-2.5">
            {ANALYZE_CHECKLIST.map((label, i) => {
              const done = i < progressIdx;
              const current = i === progressIdx && progressIdx < ANALYZE_CHECKLIST.length;
              return (
                <div
                  key={label}
                  className={`flex items-center gap-2.5 rounded-xl border p-3 text-sm transition-colors ${
                    done
                      ? "border-emerald-300/60 bg-emerald-50/60"
                      : current
                        ? "border-primary/40 bg-primary/5"
                        : "border-border bg-secondary/30 opacity-60"
                  }`}
                >
                  {done ? (
                    <CheckCircle2 className="size-4 text-emerald-600" />
                  ) : current ? (
                    <Loader2 className="size-4 animate-spin text-primary" />
                  ) : (
                    <Circle className="size-4 text-muted-foreground/50" />
                  )}
                  <span className={done || current ? "font-medium" : "text-muted-foreground"}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="mt-6 inline-flex w-full items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            <Sparkles className="size-3.5 shrink-0 text-primary" />
            Almost done! Hang tight...
          </p>
        </>
      )}
    </AiFlowShell>
  );
}
