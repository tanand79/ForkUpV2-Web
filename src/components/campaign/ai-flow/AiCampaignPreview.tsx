"use client";

/**
 * AI flow Step 8 — Campaign preview with in-place editing and attention messages.
 *
 * Purpose: Show how supporters will see the draft; let organizers edit title,
 * story, goal, dates, methods, and cover on this screen (no step navigation).
 * Date timing rules match AiCampaignDates (Needs ForkUp Review + CTAs).
 *
 * Inputs: campaign context (title, description, cover, logo, dates, methods, goal).
 * Output: preview / edit UI + Continue to signup (or review if logged in).
 *
 * Changelog: Auto-load featured cover from AI session / social suggest when
 * missing; on image load error try the next gallery URL before clearing.
 */
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  Eye,
  ImageIcon,
  Pencil,
} from "lucide-react";
import {
  useCampaign,
  SUPPORT_METHOD_META,
  type SupportMethod,
} from "@/lib/campaign-context";
import { getAuthToken } from "@/lib/auth-storage";
import { stashAccountIntent, stashAuthReturnStep } from "@/lib/campaign-auth";
import { formatCurrency } from "@/data/campaigns";
import { formatDateUs } from "@/lib/date-only";
import {
  ambassadorTimingCoachMessage,
  dateFieldRequirements,
  evaluateBusinessMethodTiming,
  hasBusinessMethod,
  timingCtaLabel,
  type TimingCta,
} from "@/lib/campaign-timing";
import { fetchAiCampaignSession } from "@/lib/api-ai-campaign-flow";
import { loadAiFlowStore } from "@/lib/ai-campaign-flow-storage";
import { UsDateInput } from "@/components/campaign/UsDateInput";
import {
  AiCampaignCoverPicker,
  AiCoverChangeButton,
} from "./AiCampaignCoverPicker";
import {
  ideaThumbnailFallbackUrls,
  resolveAiFlowImages,
} from "./resolve-ai-flow-images";
import { AiFlowShell } from "./AiFlowShell";

const METHOD_OPTIONS: { id: SupportMethod; label: string }[] = [
  { id: "donations", label: "Online Donations" },
  { id: "ambassador", label: "Ambassador Sharing" },
  { id: "giveback", label: "Dine & Donate" },
  { id: "guestBartending", label: "Guest Bartending" },
];

const fieldClass =
  "mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/30";

const clearTimingFlags = {
  submitForForkupReview: false as const,
  continueWithoutBusinessMethods: false as const,
};

function formatDate(d: string) {
  if (!d) return "";
  const label = formatDateUs(d);
  return label === "—" ? "" : label;
}

type AttentionItem = {
  id: string;
  label: string;
  action: string;
  blocking: boolean;
};

export function AiCampaignPreview() {
  const { state, update, goTo } = useCampaign();
  const [editing, setEditing] = useState(false);
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
  /** Failed social/CDN URLs so onError can fall through to the next suggestion. */
  const failedCoverUrls = useRef<Set<string>>(new Set());

  /**
   * When Preview has no featured photo (or empty gallery), hydrate with
   * social media suggest first, then AI session analysis images.
   */
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const hasCoverNow = !!(state.cover?.url || state.cover?.storedUrl);
      if (hasCoverNow && state.images.length > 0) return;

      let facebookUrl = state.promotion.facebookUrl.trim();
      let instagramHandle = state.promotion.instagramHandle.trim();
      let websiteUrl = state.promotion.websiteUrl.trim();
      let analysisImages: { url: string; sourceUrl?: string | null; source?: string | null }[] =
        [];
      let ideaThumbs: string[] = [];
      const store = loadAiFlowStore();

      if (store?.sessionToken) {
        try {
          const session = await fetchAiCampaignSession(store.sessionToken);
          if (cancelled) return;
          if (!facebookUrl && session.facebookUrl) facebookUrl = session.facebookUrl;
          if (!instagramHandle && session.instagramUrl) {
            instagramHandle = session.instagramUrl;
          }
          if (!websiteUrl && session.website) websiteUrl = session.website;
          analysisImages = (session.analysis?.images || []).map((img) => ({
            url: img.url,
            sourceUrl: img.sourceUrl,
            source: img.source,
          }));
          ideaThumbs = ideaThumbnailFallbackUrls(session.ideas);
        } catch {
          /* keep local promotion */
        }
      }

      const media = await resolveAiFlowImages({
        facebookUrl,
        instagramHandle,
        websiteUrl,
        analysisImages,
        fallbackUrls: [
          ...ideaThumbs,
          state.cover?.url,
          state.cover?.storedUrl,
        ],
      });
      if (cancelled) return;
      if (!media.cover && media.images.length === 0) return;

      const promotionPatch =
        facebookUrl !== state.promotion.facebookUrl.trim() ||
        instagramHandle !== state.promotion.instagramHandle.trim() ||
        websiteUrl !== state.promotion.websiteUrl.trim()
          ? {
              promotion: {
                ...state.promotion,
                facebookUrl: facebookUrl || state.promotion.facebookUrl,
                instagramHandle: instagramHandle || state.promotion.instagramHandle,
                websiteUrl: websiteUrl || state.promotion.websiteUrl,
              },
            }
          : {};

      if (hasCoverNow) {
        if (state.images.length === 0 && media.images.length > 0) {
          update({
            images: media.cover
              ? [media.cover, ...media.images].slice(1)
              : media.images,
            ...promotionPatch,
          });
        } else if (Object.keys(promotionPatch).length > 0) {
          update(promotionPatch);
        }
        return;
      }

      update({
        cover: media.cover,
        images: media.images,
        ...promotionPatch,
      });
    })();

    return () => {
      cancelled = true;
    };
    // Mount-only hydrate — cover/gallery may fill asynchronously for guests.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeMethods = (Object.keys(state.methods) as SupportMethod[]).filter(
    (m) => state.methods[m],
  );
  const hasStory = !!state.description?.trim();
  const hasCover = !!(state.cover?.url || state.cover?.storedUrl);
  const hasLogo = !!state.logo;
  const coverSrc = state.cover?.url || state.cover?.storedUrl || "";
  const dateReqs = dateFieldRequirements(state.methods);
  const timingEval = evaluateBusinessMethodTiming(state);
  const hasDates =
    (!dateReqs.requireEndDate || !!state.endDate) &&
    (!dateReqs.requireStartDate || !!state.startDate);
  const datesSummary = state.startDate
    ? `${formatDate(state.startDate)} → ${formatDate(state.endDate)}`
    : formatDate(state.endDate);
  const goal = Number(String(state.goal).replace(/[^0-9.]/g, "")) || 0;
  const ambassadorCoach = state.methods.ambassador
    ? ambassadorTimingCoachMessage(state.endDate)
    : null;
  const showStart = dateReqs.requireStartDate || dateReqs.startOptional;
  /** Business methods: Start → End. Online/ambassador-only: End → optional Start. */
  const startFirst = hasBusinessMethod(state.methods);

  const attention: AttentionItem[] = [];
  if (!state.title.trim()) {
    attention.push({
      id: "title",
      label: "Campaign title needs attention",
      action: "Add Title",
      blocking: true,
    });
  }
  if (dateReqs.requireStartDate && !state.startDate) {
    attention.push({
      id: "start",
      label: "Campaign start date is missing",
      action: "Add Dates",
      blocking: true,
    });
  }
  if (dateReqs.requireEndDate && !state.endDate) {
    attention.push({
      id: "end",
      label: "Campaign end date is missing",
      action: "Add Dates",
      blocking: true,
    });
  }
  if (dateReqs.requireEventDate && !state.eventDate) {
    attention.push({
      id: "event",
      label: "Guest Bartending event date is missing",
      action: "Add Event Date",
      blocking: true,
    });
  }
  if (!hasCover) {
    attention.push({
      id: "cover",
      label: "Featured campaign image needed",
      action: "Choose Image",
      blocking: true,
    });
  }
  if (!hasStory) {
    attention.push({
      id: "story",
      label: "Campaign story is empty",
      action: "Add Story",
      blocking: false,
    });
  }
  if (goal <= 0) {
    attention.push({
      id: "goal",
      label: "Fundraising goal is not set",
      action: "Set Goal",
      blocking: false,
    });
  }
  if (ambassadorCoach) {
    attention.push({
      id: "ambassador-coach",
      label: ambassadorCoach,
      action: "Edit Dates",
      blocking: false,
    });
  }
  if (
    timingEval.status === "needs_forkup_review" &&
    timingEval.message &&
    !state.submitForForkupReview
  ) {
    attention.push({
      id: "forkup-timing",
      label: "Business timeline is under 30 days — ForkUp review options below",
      action: "Review Timing",
      blocking: false,
    });
  }

  const blockingCount = attention.filter((a) => a.blocking).length;
  const ready = blockingCount === 0;

  const openEdit = () => setEditing(true);

  const handleAttentionAction = (id: string) => {
    if (id === "cover") {
      setCoverPickerOpen(true);
      return;
    }
    setEditing(true);
  };

  /**
   * Handles short-timeline CTAs (change date / drop business methods / submit for review).
   * Mirrors AiCampaignDates — state only; launch enforcement remains on the server.
   */
  const handleTimingCta = (cta: TimingCta) => {
    if (cta === "change_date") {
      update({
        submitForForkupReview: false,
        continueWithoutBusinessMethods: false,
      });
      setEditing(true);
      return;
    }
    if (cta === "continue_without_business_method") {
      update({
        methods: {
          ...state.methods,
          giveback: false,
          guestBartending: false,
          donations: true,
          ambassador: true,
        },
        continueWithoutBusinessMethods: true,
        submitForForkupReview: false,
        businessTimingStatus: "ok",
      });
      return;
    }
    if (cta === "submit_for_forkup_review") {
      update({
        submitForForkupReview: true,
        continueWithoutBusinessMethods: false,
        forkupReviewStatus: "pending",
        businessTimingStatus: "needs_forkup_review",
      });
    }
  };

  const toggleMethod = (id: SupportMethod) => {
    // Keep Online Donations + Ambassador as the default fundraising layer.
    if ((id === "donations" || id === "ambassador") && state.methods[id]) return;
    update({
      methods: { ...state.methods, [id]: !state.methods[id] },
      ...clearTimingFlags,
    });
  };

  const startField = showStart ? (
    <div key="start">
      <label className="text-xs font-semibold text-muted-foreground">
        Start date
        {dateReqs.startOptional ? " (optional)" : ""}
        {dateReqs.requireStartDate ? (
          <span className="text-primary" aria-hidden>
            {" "}
            *
          </span>
        ) : null}
      </label>
      <UsDateInput
        value={state.startDate}
        max={state.endDate || undefined}
        onChange={(startDate) => update({ startDate, ...clearTimingFlags })}
        className={fieldClass}
      />
    </div>
  ) : null;

  const endField = dateReqs.requireEndDate ? (
    <div key="end">
      <label className="text-xs font-semibold text-muted-foreground">
        End date
        <span className="text-primary" aria-hidden>
          {" "}
          *
        </span>
      </label>
      <UsDateInput
        value={state.endDate}
        min={state.startDate || undefined}
        onChange={(endDate) => update({ endDate, ...clearTimingFlags })}
        className={fieldClass}
      />
    </div>
  ) : null;

  const forkupTimingBanner =
    timingEval.status === "needs_forkup_review" && timingEval.message ? (
      <div className="mt-6 space-y-3 rounded-2xl border border-amber-300/60 bg-amber-50/80 p-4 dark:border-amber-800 dark:bg-amber-950/40">
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          Needs ForkUp Review
        </p>
        <p className="text-sm text-amber-900/90 dark:text-amber-100/90">
          {timingEval.message}
        </p>
        {state.submitForForkupReview ? (
          <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
            Submitted for ForkUp review. Online donations and ambassador sharing can still
            move forward. Business invitations stay paused until approved.
          </p>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {timingEval.ctas.map((cta) => (
              <button
                key={cta}
                type="button"
                onClick={() => handleTimingCta(cta)}
                className="rounded-full border border-amber-400/70 bg-card px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-secondary"
              >
                {timingCtaLabel(cta, state.methods)}
              </button>
            ))}
          </div>
        )}
      </div>
    ) : null;

  return (
    <AiFlowShell
      title="Preview your AI-generated campaign"
      subtitle="This is how supporters will see your fundraiser. Edit anything here before continuing."
      backStep="ai-campaign-dates"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Eye className="size-4 text-primary" />
          <p className="text-sm font-semibold">Campaign Preview</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <Pencil className="size-3" />
          {editing ? "Done" : "Edit"}
        </button>
      </div>

      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        {hasCover ? (
          <div className="relative flex max-h-48 items-center justify-center overflow-hidden bg-secondary sm:max-h-56">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverSrc}
              alt="Featured campaign photo"
              className="max-h-48 w-full object-contain sm:max-h-56"
              onError={() => {
                if (coverSrc) failedCoverUrls.current.add(coverSrc);
                const candidates = [
                  ...state.images,
                  ...(state.cover ? [state.cover] : []),
                ];
                const next = candidates.find((img) => {
                  const src = img.url || img.storedUrl || "";
                  return !!src && !failedCoverUrls.current.has(src);
                });
                if (next) {
                  const nextSrc = next.url || next.storedUrl || "";
                  update({
                    cover: next,
                    images: state.images.filter(
                      (img) =>
                        img.id !== next.id &&
                        (img.url || img.storedUrl || "") !== nextSrc,
                    ),
                  });
                  return;
                }
                update({ cover: null });
              }}
            />
            {editing ? (
              <AiCoverChangeButton onClick={() => setCoverPickerOpen(true)} />
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setCoverPickerOpen(true);
            }}
            className="flex min-h-40 w-full flex-col items-center justify-center gap-2 border-b border-dashed border-border bg-secondary/30 px-4 py-8 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <ImageIcon className="size-6" />
            Add a featured campaign photo
          </button>
        )}

        <div className="p-5 sm:p-6">
          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">
                  Campaign title
                </label>
                <input
                  value={state.title}
                  onChange={(e) => update({ title: e.target.value })}
                  className={fieldClass}
                  placeholder="Your campaign title"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">
                  Campaign story
                </label>
                <textarea
                  value={state.description}
                  onChange={(e) =>
                    update({ description: e.target.value, storyAccepted: true })
                  }
                  rows={5}
                  className={fieldClass}
                  placeholder="Tell supporters why this matters…"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">
                  Fundraising goal
                </label>
                <input
                  value={state.goal}
                  onChange={(e) =>
                    update({ goal: e.target.value, goalAiSuggested: false })
                  }
                  className={fieldClass}
                  placeholder="e.g. 10000"
                  inputMode="decimal"
                />
                {state.goalAiSuggested && state.goal.trim() ? (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Suggested for you — edit anytime.
                  </p>
                ) : null}
              </div>

              <div
                className={
                  showStart
                    ? "grid gap-3 sm:grid-cols-2"
                    : "grid gap-3"
                }
              >
                {startFirst ? (
                  <>
                    {startField}
                    {endField}
                  </>
                ) : (
                  <>
                    {endField}
                    {startField}
                  </>
                )}
                {dateReqs.requireEventDate ? (
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Guest Bartending event date
                      <span className="text-primary" aria-hidden>
                        {" "}
                        *
                      </span>
                    </label>
                    <UsDateInput
                      value={state.eventDate}
                      onChange={(eventDate) =>
                        update({ eventDate, ...clearTimingFlags })
                      }
                      className={fieldClass}
                    />
                  </div>
                ) : null}
              </div>

              {ambassadorCoach ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {ambassadorCoach}
                </p>
              ) : null}

              <div>
                <p className="mb-2 text-xs font-semibold text-muted-foreground">
                  Fundraising methods
                </p>
                <div className="space-y-2">
                  {METHOD_OPTIONS.map((opt) => {
                    const on = state.methods[opt.id];
                    const lockedOn =
                      (opt.id === "donations" || opt.id === "ambassador") && on;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={lockedOn}
                        onClick={() => toggleMethod(opt.id)}
                        className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                          on
                            ? "border-primary/40 bg-primary/5"
                            : "border-border bg-card hover:border-primary/30"
                        } ${lockedOn ? "cursor-default opacity-90" : ""}`}
                      >
                        <span
                          className={`flex size-5 shrink-0 items-center justify-center rounded-md border ${
                            on
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background"
                          }`}
                        >
                          {on ? <Check className="size-3.5" strokeWidth={3} /> : null}
                        </span>
                        <span className="font-medium">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                {hasLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={state.logo!.url}
                    alt="Organization logo"
                    className="size-12 shrink-0 rounded-xl border border-border object-cover"
                  />
                ) : (
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-dashed border-border text-muted-foreground">
                    <ImageIcon className="size-5" />
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-bold">
                    {state.title || "Untitled campaign"}
                  </h3>
                  {hasDates ? (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="size-3" />
                      {datesSummary}
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={openEdit}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Add your campaign dates →
                    </button>
                  )}
                </div>
                {state.methods.giveback ? (
                  <span className="ml-auto shrink-0 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
                    {state.giveback}% giveback
                  </span>
                ) : null}
              </div>

              {hasStory ? (
                <p className="mt-4 text-pretty text-sm text-muted-foreground">
                  {state.description}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={openEdit}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-secondary/30 p-4 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  Add your campaign story
                </button>
              )}

              {activeMethods.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {activeMethods.map((m) => (
                    <span
                      key={m}
                      className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground"
                    >
                      {SUPPORT_METHOD_META[m].title}
                    </span>
                  ))}
                </div>
              ) : null}

              {goal > 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {formatCurrency(0)} raised
                  </span>{" "}
                  of {formatCurrency(goal)} goal · Draft preview
                </p>
              ) : (
                <button
                  type="button"
                  onClick={openEdit}
                  className="mt-4 text-xs font-medium text-primary hover:underline"
                >
                  Set your fundraising goal →
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {forkupTimingBanner}

      <section
        className={`mt-6 rounded-2xl border p-5 ${
          ready
            ? "border-emerald-300/60 bg-emerald-50/60"
            : "border-amber-300/60 bg-amber-50/60"
        }`}
      >
        {ready && attention.length === 0 ? (
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <CheckCircle2 className="size-4" />
            Your campaign preview looks ready.
          </p>
        ) : ready ? (
          <>
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
              <CheckCircle2 className="size-4" />
              Ready to continue — optional tips below.
            </p>
            <ul className="mt-3 space-y-2">
              {attention.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-background/70 p-3"
                >
                  <span className="text-sm font-medium">{a.label}</span>
                  <button
                    type="button"
                    onClick={() => handleAttentionAction(a.id)}
                    className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold transition-colors hover:bg-secondary"
                  >
                    {a.action}
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <p className="flex items-center gap-2 text-sm font-bold text-amber-800">
              <AlertTriangle className="size-4" />
              {blockingCount} item{blockingCount === 1 ? "" : "s"} need your attention
            </p>
            <ul className="mt-3 space-y-2">
              {attention.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-background/70 p-3"
                >
                  <span className="text-sm font-medium">
                    {a.label}
                    {!a.blocking ? (
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        (optional)
                      </span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAttentionAction(a.id)}
                    className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold transition-colors hover:bg-secondary"
                  >
                    {a.action}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-3.5 text-sm font-medium transition-colors hover:bg-secondary sm:w-auto"
        >
          <Pencil className="size-4" />
          {editing ? "Done editing" : "Edit Campaign"}
        </button>
        <button
          type="button"
          disabled={!ready}
          onClick={() => {
            if (getAuthToken()) {
              goTo("review");
              return;
            }
            stashAccountIntent("nonprofit");
            stashAuthReturnStep("review");
            sessionStorage.setItem("forkup-auth-initial-mode", "register");
            goTo("auth-login");
          }}
          className="inline-flex w-full flex-1 items-center justify-center rounded-full bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continue
        </button>
      </div>

      <AiCampaignCoverPicker
        open={coverPickerOpen}
        cover={state.cover}
        images={state.images}
        onClose={() => setCoverPickerOpen(false)}
        onSelectCover={(cover) => {
          update({ cover });
          setCoverPickerOpen(false);
        }}
      />
    </AiFlowShell>
  );
}
