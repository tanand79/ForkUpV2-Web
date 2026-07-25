import { Check, Lock } from "lucide-react";
import {
  useCampaign,
  type ChecklistItem,
  type StepId,
} from "@/lib/campaign-context";

// Human, mission-first labels for each builder step. We never use software
// language ("module", "configuration", "workflow") — this should feel like a
// nonprofit preparing to launch a community fundraiser.
const PROGRESS_LABEL: Partial<Record<StepId, string>> = {
  methods: "Choose Your Fundraising Methods",
  details: "Tell Your Story",
  media: "Add Photos & Branding",
  review: "Review Campaign",
  businesses: "Invite Business Partners",
};

// Once a step is complete, the chip reads as a finished accomplishment from
// the nonprofit organizer's perspective.
const COMPLETED_LABEL: Partial<Record<StepId, string>> = {
  methods: "Fundraising Methods Selected",
};

type ChipState = "complete" | "next" | "remaining" | "locked";

export function LaunchChecklist() {
  const { checklist, step, goTo, reviewUnlocked, flow, activeProgressIndex, requiredRemaining } =
    useCampaign();

  // The "invite" sub-step belongs to the Invite Business Partners stage.
  const activeId = step === "invite" ? "businesses" : step;
  const total = checklist.length;

  // Progress follows the step the user is actually on (matches footer next/back),
  // not the first incomplete checklist item — otherwise skipping optional steps
  // or resuming after a role switch shows the wrong active step.
  const currentFlowIndex = activeProgressIndex >= 0 ? activeProgressIndex : 0;
  const currentStepNumber = Math.min(currentFlowIndex + 1, total);
  const nextFlowStep = flow[currentFlowIndex + 1];
  const nextLabel = nextFlowStep ? PROGRESS_LABEL[nextFlowStep] : null;

  const labelFor = (item: ChecklistItem) => {
    if (item.status === "complete" && COMPLETED_LABEL[item.id]) {
      return COMPLETED_LABEL[item.id]!;
    }
    return PROGRESS_LABEL[item.id] ?? item.label;
  };

  const chipState = (item: ChecklistItem): ChipState => {
    if (item.status === "complete") return "complete";
    if (item.id === "review" && !reviewUnlocked) return "locked";
    if (item.id === activeId) return "next";
    return "remaining";
  };

  return (
    <div className="mt-3 rounded-2xl border border-border bg-card px-4 py-3 sm:px-5">
      {/* One horizontal progress bar — segments colored by step state. */}
      <div className="flex items-center gap-1.5">
        {checklist.map((item) => {
          const s = chipState(item);
          return (
            <span
              key={item.id}
              className={`h-1.5 flex-1 rounded-full ${
                s === "complete"
                  ? "bg-[oklch(0.55_0.12_150)]"
                  : s === "next"
                    ? "bg-primary"
                    : "bg-border"
              }`}
            />
          );
        })}
      </div>

      <p className="mt-2 text-xs font-medium text-muted-foreground">
        <span className="font-bold text-foreground">
          Step {currentStepNumber} of {total}
        </span>
        {nextLabel && currentFlowIndex < flow.length - 1 && (
          <>
            {" · "}
            <span className="font-semibold text-primary">Next step: {nextLabel}</span>
          </>
        )}
      </p>

      {/* Readiness line — tells the organizer exactly what's left before launch. */}
      <p className="mt-1 text-xs font-semibold">
        {requiredRemaining === 0 ? (
          <span className="text-[oklch(0.45_0.1_150)]">
            All required steps done — you&rsquo;re ready to review &amp; launch.
          </span>
        ) : (
          <span className="text-muted-foreground">
            {requiredRemaining} required{" "}
            {requiredRemaining === 1 ? "step" : "steps"} left before you can launch.
          </span>
        )}
      </p>

      {/* Clickable status chips — the campaign GPS. */}
      <div className="mt-2.5 flex flex-wrap gap-2">
        {checklist.map((item) => {
          const s = chipState(item);
          const label = labelFor(item);
          const isActive = item.id === activeId;
          const base =
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors";

          if (s === "locked") {
            return (
              <span
                key={item.id}
                className={`${base} cursor-not-allowed border border-dashed border-border text-muted-foreground/60`}
                title="Locked until ready"
              >
                <Lock className="size-3" />
                {label}
              </span>
            );
          }

          const styles: Record<Exclude<ChipState, "locked">, string> = {
            complete:
              "bg-[oklch(0.94_0.05_150)] text-[oklch(0.4_0.1_150)] hover:bg-[oklch(0.91_0.06_150)]",
            next: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
            remaining:
              "border border-border bg-background text-foreground hover:bg-secondary/60",
          };

          return (
            <button
              key={item.id}
              onClick={() => goTo(item.id)}
              className={`${base} ${styles[s]} ${
                isActive && s !== "next" ? "ring-1 ring-primary/40" : ""
              }`}
            >
              {s === "complete" && <Check className="size-3" strokeWidth={3} />}
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
