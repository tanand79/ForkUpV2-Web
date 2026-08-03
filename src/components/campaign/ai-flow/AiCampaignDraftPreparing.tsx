"use client";

/**
 * AI flow — preparing-draft checklist (QuickStart parity).
 *
 * Purpose: Show the sequenced "ForkUp is preparing your campaign draft"
 * progress list while AiCampaignPurpose generates a draft.
 *
 * Inputs:
 *   - active: animation is running
 *   - finished: parent API / image work completed
 *   - onComplete: called once when checklist reaches the end AND finished
 *
 * Outputs: visual progress only; calls onComplete when both gates pass.
 */
import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Sparkles, Wand2 } from "lucide-react";

const BUILD_PROGRESS_MESSAGES = [
  "Reviewing your organization profile",
  "Using your campaign purpose",
  "Applying your fundraising methods",
  "Preparing your campaign story",
  "Organizing your campaign details",
];

export function AiCampaignDraftPreparing({
  active,
  finished,
  onComplete,
}: {
  active: boolean;
  finished: boolean;
  onComplete: () => void;
}) {
  const [progressIdx, setProgressIdx] = useState(0);

  useEffect(() => {
    if (!active) return;
    if (progressIdx >= BUILD_PROGRESS_MESSAGES.length) {
      if (!finished) return;
      const done = setTimeout(() => onComplete(), 400);
      return () => clearTimeout(done);
    }
    const tick = setTimeout(() => setProgressIdx((i) => i + 1), 650);
    return () => clearTimeout(tick);
  }, [active, progressIdx, finished, onComplete]);

  return (
    <main className="mx-auto max-w-xl px-5 py-5 pb-16 sm:px-6">
      <div className="mx-auto mt-8 max-w-md text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-primary">
          <Wand2 className="size-3" />
          Build your campaign
        </span>
        <h1 className="font-display mt-4 text-2xl font-bold tracking-tight">
          ForkUp is preparing your campaign draft
        </h1>
        <div className="mt-6 space-y-2.5 text-left">
          {BUILD_PROGRESS_MESSAGES.map((msg, i) => {
            const done = i < progressIdx;
            const current = i === progressIdx;
            return (
              <div
                key={msg}
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
                  <Sparkles className="size-4 animate-pulse text-primary" />
                ) : (
                  <Circle className="size-4 text-muted-foreground/50" />
                )}
                <span className={done || current ? "font-medium" : "text-muted-foreground"}>
                  {msg}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
