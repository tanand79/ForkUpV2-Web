import { useEffect, useState } from "react";
import { FlaskConical, ChevronDown } from "lucide-react";
import { useCampaign, CAMPAIGN_STAGE_META, type StepId, type CampaignStage } from "@/lib/campaign-context";

/**
 * ⚠️ DESIGN MODE — TEMPORARY. Do NOT use in production.
 *
 * A floating developer/design panel that lets us jump between any builder step
 * and bypass field validation while designing the screens. Production behavior
 * (required fields, story minimums, valid dates, required media, at least one
 * support method) stays intact whenever Design Mode is OFF. Remove this
 * component (and the related context fields) before launch.
 *
 * Each item also carries a design-review status (Approved / Needs Review /
 * Not Started). This is review/workflow planning only — it never touches
 * production behavior. Status is persisted to localStorage.
 */

// Design Mode now mirrors the full ForkUp campaign lifecycle:
// Build → Launch → Manage → Report → Repeat.
type ReviewStatus = "approved" | "review" | "not-started";

const STATUS_ORDER: ReviewStatus[] = ["not-started", "review", "approved"];

const STATUS_META: Record<ReviewStatus, { dot: string; label: string }> = {
  approved: { dot: "🟢", label: "Approved for Now" },
  review: { dot: "🟡", label: "Needs Review" },
  "not-started": { dot: "⚪", label: "Not Started" },
};

type Section = { title: string; steps: { id: StepId; label: string }[] };


const SECTIONS: Section[] = [
  {
    title: "Entry / Claim Flows",
    steps: [
      { id: "website-landing", label: "Public Home (Task 1)" },
      { id: "website-marketing", label: "Marketing Landing Page" },
      { id: "campaign-directory", label: "Campaign Directory / Live Campaigns" },
      { id: "campaign-page", label: "Public Campaign Page" },
      { id: "nonprofit-claim", label: "Nonprofit Claim / Create Profile" },
      { id: "business-claim", label: "Business Claim / Create Profile" },
      { id: "business-ai-onboarding", label: "Business AI Onboarding (Tasks 6–9)" },
      { id: "business-giveback-join", label: "Business Giveback Join (Pass D2 — 4 steps)" },
      { id: "business-acceptance", label: "Business Acceptance Flow" },
    ],
  },
  {
    // Reusable assets — independent of any single campaign.
    title: "Profiles",
    steps: [
      { id: "nonprofit-profile", label: "Nonprofit Profile" },
      { id: "business-profile", label: "Business Profile" },
      { id: "organization-library", label: "Organization Library" },
    ],
  },
  {
    title: "Campaign Builder",
    steps: [
      { id: "start", label: "Campaign Setup Landing" },
      { id: "methods", label: "Choose Your Fundraising Methods" },
      { id: "details", label: "Tell Your Story" },
      { id: "media", label: "Add Photos & Branding" },
      { id: "businesses", label: "Invite Business Partners" },
      { id: "business-invite-flow", label: "Business Invite Status" },
      { id: "edit-invite", label: "Edit Invitation" },
      { id: "review", label: "Review & Launch" },
    ],
  },
  {
    title: "Campaign Management",
    steps: [
      { id: "dashboard", label: "Campaign Dashboard" },
      { id: "success-engine", label: "Success Engine" },
      { id: "receipt-ocr", label: "Receipt Upload / OCR Tracking" },
      { id: "receipt-upload", label: "Supporter Receipt Upload" },
      { id: "supporter-receipts", label: "Supporter Receipt History" },
      { id: "reporting", label: "Reporting & Settlement" },
      { id: "analytics", label: "Analytics & Insights" },
    ],
  },
  {
    title: "Campaign Modules",
    steps: [
      { id: "guestBartending", label: "Guest Bartender Module" },
      { id: "ambassador", label: "Ambassador Module" },
    ],
  },
  {
    // ⚠️ DESIGN MODE ONLY — campaign configurations, not lifecycle states.
    // "Local Business Giveback Pending" is the real post-launch `created` route.
    title: "Campaign Types / Scenarios",
    steps: [
      { id: "success-virtual", label: "Virtual Donations Campaign" },
      { id: "success-ambassador", label: "Ambassador Fundraising Campaign" },
      { id: "success-bartending", label: "Guest Bartender Campaign" },
      { id: "created", label: "Local Business Giveback Pending" },
      { id: "success-giveback-live", label: "Local Business Giveback Live" },
      { id: "success-mixed", label: "Mixed Campaign" },
    ],
  },
  {
    // ⚠️ Admin Only — Hidden From Public Users. Internal preload workflow.
    title: "Admin / Data Setup",
    steps: [
      { id: "admin-preload", label: "Preload Nonprofits & Businesses" },
      { id: "admin-email-log", label: "Email Log" },
      { id: "admin-access-requests", label: "Trust & Verification Queue" },
      { id: "super-admin-login", label: "Super Admin Login" },
      { id: "super-admin", label: "Super Admin Console" },
    ],
  },
  {
    // Master architecture review map — bottom of Design Mode.
    title: "ForkUp V1 Architecture Map",
    steps: [{ id: "architecture-map", label: "ForkUp V1 Architecture Map" }],
  },
];


// Initial review status per the agreed-upon design baseline. Anything not
// listed here defaults to "not-started".
const DEFAULT_STATUS: Partial<Record<StepId, ReviewStatus>> = {
  start: "review",
  methods: "review",
  details: "review",
  businesses: "review",
  media: "review",
  review: "review",
};

const STORAGE_KEY = "forkup-design-review-status";

export function DesignModeBar() {
  const {
    step,
    goTo,
    designMode,
    toggleDesignMode,
    campaignStage,
    stageOverride,
    setStageOverride,
  } = useCampaign();
  const [open, setOpen] = useState(true);

  const [statuses, setStatuses] = useState<Partial<Record<StepId, ReviewStatus>>>(
    () => ({ ...DEFAULT_STATUS }),
  );

  // Load persisted statuses on mount (client only).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setStatuses({ ...DEFAULT_STATUS, ...JSON.parse(raw) });
    } catch {
      // ignore corrupt storage
    }
  }, []);

  const cycleStatus = (id: StepId) => {
    setStatuses((prev) => {
      const current = prev[id] ?? "not-started";
      const next = STATUS_ORDER[(STATUS_ORDER.indexOf(current) + 1) % STATUS_ORDER.length];
      const updated = { ...prev, [id]: next };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore write failures
      }
      return updated;
    });
  };

  return (
    <div className="fixed right-4 top-20 z-[60] w-60 select-none">
      <div className="overflow-hidden rounded-2xl border border-amber-400/60 bg-amber-50/95 shadow-lg backdrop-blur dark:bg-amber-950/80">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
        >
          <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
            <FlaskConical className="size-3.5" />
            Design Mode
          </span>
          <ChevronDown
            className={`size-4 text-amber-700 transition-transform dark:text-amber-300 ${open ? "rotate-180" : ""}`}
          />
        </button>

        {open && (
          <div className="max-h-[70vh] space-y-3 overflow-y-auto border-t border-amber-400/40 p-3">
            <label className="flex items-center justify-between gap-2 text-xs font-semibold text-amber-900 dark:text-amber-200">
              Bypass validation
              <button
                role="switch"
                aria-checked={designMode}
                onClick={toggleDesignMode}
                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                  designMode ? "bg-amber-500" : "bg-amber-300/60"
                }`}
              >
                <span
                  className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${
                    designMode ? "left-[1.125rem]" : "left-0.5"
                  }`}
                />
              </button>
            </label>

            {/* Campaign State Preview — drives dashboard section visibility. */}
            <div className="space-y-1.5 rounded-lg border border-amber-300/60 bg-amber-100/50 p-2 dark:bg-amber-900/30">
              <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700/90 dark:text-amber-300/90">
                Campaign State Preview
              </p>
              <div className="grid grid-cols-2 gap-1">
                {(["draft", "invitation", "ready", "live", "closed", "settlement"] as CampaignStage[]).map((s) => {
                  const active = stageOverride === s;
                  return (
                    <button
                      key={s}
                      onClick={() => setStageOverride(s)}
                      className={`rounded-md px-2 py-1 text-[10px] font-semibold transition-colors ${
                        active
                          ? "bg-amber-600 text-white"
                          : "bg-white/70 text-amber-900 hover:bg-amber-200/70 dark:bg-amber-950/40 dark:text-amber-200"
                      }`}
                    >
                      {CAMPAIGN_STAGE_META[s].label}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setStageOverride(null)}
                className={`w-full rounded-md px-2 py-1 text-[10px] font-semibold transition-colors ${
                  stageOverride === null
                    ? "bg-amber-600 text-white"
                    : "bg-white/70 text-amber-900 hover:bg-amber-200/70 dark:bg-amber-950/40 dark:text-amber-200"
                }`}
              >
                Auto (from dates) · now: {CAMPAIGN_STAGE_META[campaignStage].label}
              </button>
            </div>

            <div className="rounded-lg bg-amber-100/70 px-2 py-1.5 text-[10px] leading-relaxed text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
              Tap the dot to set status: ⚪ Not Started · 🟡 Needs Review · 🟢 Approved
            </div>



            {SECTIONS.map((section) => (
              <div key={section.title} className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700/80 dark:text-amber-300/80">
                  {section.title}
                </p>
                <div className="grid gap-1">
                  {section.steps.map((s) => {
                    const status = statuses[s.id] ?? "not-started";
                    const meta = STATUS_META[status];
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => goTo(s.id)}
                        className={`flex w-full items-center gap-1 rounded-md text-left transition-colors ${
                          step === s.id
                            ? "bg-amber-600 text-white"
                            : "text-amber-900 hover:bg-amber-200/60 dark:text-amber-200 dark:hover:bg-amber-800/40"
                        }`}
                      >
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            cycleStatus(s.id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.stopPropagation();
                              cycleStatus(s.id);
                            }
                          }}
                          title={`${meta.label} — click to change`}
                          aria-label={`Status: ${meta.label}. Click to change.`}
                          className="shrink-0 cursor-pointer rounded px-1 py-1.5 text-xs leading-none hover:scale-110"
                        >
                          {meta.dot}
                        </span>
                        <span className="flex-1 rounded-md py-1.5 pr-2 text-xs font-medium">
                          {s.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

              </div>
            ))}



            <p className="text-[10px] leading-snug text-amber-700/80 dark:text-amber-300/70">
              Temporary tool for design review only — not for production.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
