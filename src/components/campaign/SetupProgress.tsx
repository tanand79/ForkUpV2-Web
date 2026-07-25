"use client";

import { ArrowRight } from "lucide-react";
import { useCampaign, SETUP_STAGES, setupStageIndex } from "@/lib/campaign-context";

/**
 * Lovable campaign-creation progress: Build → Review → Partners → Launch.
 * Inputs: current step + methods (Partners may show “Not required”).
 * Output: header stage pills matching Ui SetupProgress.
 */
export function SetupProgress() {
  const { step, state } = useCampaign();
  const activeIndex = setupStageIndex(step);
  if (activeIndex < 0) return null;
  const businessRequired = state.methods.giveback || state.methods.guestBartending;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
      {SETUP_STAGES.map((label, i) => {
        const isPartners = label === "Partners";
        const notRequired = isPartners && !businessRequired;
        const done = i < activeIndex && !notRequired;
        const current = i === activeIndex;
        return (
          <div key={label} className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                current
                  ? "bg-primary text-primary-foreground"
                  : done
                    ? "bg-primary/10 text-primary"
                    : "bg-secondary text-muted-foreground"
              }`}
            >
              <span
                className={`flex size-4 items-center justify-center rounded-full text-[10px] font-bold ${
                  current
                    ? "bg-primary-foreground/20"
                    : done
                      ? "bg-primary/20"
                      : "bg-foreground/10"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              {label}
              {notRequired && (
                <span className="ml-0.5 text-[10px] font-medium opacity-70">· Not required</span>
              )}
            </span>
            {i < SETUP_STAGES.length - 1 && (
              <ArrowRight className="size-3 text-muted-foreground/50" />
            )}
          </div>
        );
      })}
    </div>
  );
}
