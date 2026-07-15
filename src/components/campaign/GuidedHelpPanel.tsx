"use client";

import { Lightbulb, X } from "lucide-react";
import { useState } from "react";
import type { StepId } from "@/lib/campaign-context";
import { cn } from "@/lib/utils";

/** Contextual tips shown in Guided Organizer Mode only. */
const GUIDED_TIPS: Partial<Record<StepId, { title: string; body: string }>> = {
  methods: {
    title: "Start with what fits your community",
    body: "Most campaigns combine local business giveback with online donations. You can add guest bartending or ambassadors after launch.",
  },
  details: {
    title: "Tell a clear story",
    body: "Supporters give when they understand the impact. Include who benefits, what funds support, and when the campaign runs.",
  },
  businesses: {
    title: "Invited ≠ confirmed",
    body: "Businesses appear on your public page only after they accept. You can launch with accepted partners while others remain pending.",
  },
  invite: {
    title: "Personal outreach helps",
    body: "A quick note to the business contact increases acceptance rates. ForkUp sends the formal invitation.",
  },
  media: {
    title: "Strong visuals build trust",
    body: "Add a cover image and logo so your campaign looks professional when shared on social media.",
  },
  review: {
    title: "You're almost there",
    body: "Review your checklist before launch. You can save and return anytime — nothing goes live until you confirm.",
  },
  start: {
    title: "We'll guide you step by step",
    body: "Guided mode walks you through campaign setup with recommendations at each step. Switch to Advanced anytime from your dashboard.",
  },
};

interface GuidedHelpPanelProps {
  step: StepId;
  className?: string;
}

export function GuidedHelpPanel({ step, className }: GuidedHelpPanelProps) {
  const [dismissed, setDismissed] = useState(false);
  const tip = GUIDED_TIPS[step];

  if (!tip || dismissed) return null;

  return (
    <aside
      className={cn(
        "animate-rise rounded-2xl border border-primary/20 bg-primary/5 p-4",
        className,
      )}
      role="note"
      aria-label="Guided tip"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Lightbulb className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{tip.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{tip.body}</p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
          aria-label="Dismiss tip"
        >
          <X className="size-4" />
        </button>
      </div>
    </aside>
  );
}
