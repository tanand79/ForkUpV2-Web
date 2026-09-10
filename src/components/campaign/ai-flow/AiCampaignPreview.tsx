"use client";

/**
 * AI flow Step 8 — Campaign preview with in-place editing and attention messages.
 *
 * Purpose: Show how supporters will see the draft; let organizers edit title,
 * story, goal, dates, methods, cover, and extracted website/social links
 * on this screen (no step navigation).
 * Date timing rules match AiCampaignDates (Needs ForkUp Review + CTAs).
 *
 * Inputs: campaign context (title, description, cover, logo, dates, methods, goal, promotion).
 * Output: preview / edit UI + Continue to signup (or businesses/review if logged in).
 *
 * Changelog:
 * - Auto-load featured cover from AI session / social suggest when missing;
 *   on image load error try the next gallery URL before clearing.
 * - Continue routes to Launch review after Dates→Partners; business invite
 *   happens on the Dates continue path (not again from Preview).
 * - Additive: display + edit AI-extracted website / social links on preview.
 */
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  Eye,
  Facebook,
  Globe,
  ImageIcon,
  Instagram,
  Pencil,
  Youtube,
} from "lucide-react";
import {
  useCampaign,
  SUPPORT_METHOD_META,
  type SupportMethod,
} from "@/lib/campaign-context";
import { getAuthToken } from "@/lib/auth-storage";
import { stashAccountIntent, stashAuthReturnStep } from "@/lib/campaign-auth";
import { isForeignNonprofitTarget } from "@/lib/foreign-nonprofit-target";
import { formatCurrency } from "@/data/campaigns";
import { formatDateUs } from "@/lib/date-only";
import {
  ambassadorTimingCoachMessage,
  campaignDateMin,
  campaignDateNotInPastError,
  CLEAR_TIMING_FLAGS,
  dateFieldRequirements,
  evaluateBusinessMethodTiming,
  hasBusinessMethod,
  isBusinessConfirmationComplete,
  todayDateOnly,
  type TimingCta,
} from "@/lib/campaign-timing";
import { fetchAiCampaignSession } from "@/lib/api-ai-campaign-flow";
import { createFundraiserCampaignInvite, uploadImage } from "@/lib/api";
import { campaignMethodsForApi } from "@/lib/builder-submit";
import { TimelineCheckCard } from "@/components/campaign/TimelineCheckCard";
import {
  loadAiFlowStore,
  loadAiFlowPendingOrg,
  saveAiFlowPendingOrg,
} from "@/lib/ai-campaign-flow-storage";
import { UsDateInput } from "@/components/campaign/UsDateInput";
import { OpenCoverResizeControl } from "@/components/campaign/OpenCoverResizeControl";
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

const clearTimingFlags = CLEAR_TIMING_FLAGS;

function formatDate(d: string) {
  if (!d) return "";
  const label = formatDateUs(d);
  return label === "—" ? "" : label;
}

/** Turn a stored website/social value into a clickable href (handles handles + bare hosts). */
function socialHref(raw: string, kind: "website" | "facebook" | "instagram" | "youtube"): string {
  const v = raw.trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  if (kind === "instagram") {
    const handle = v.replace(/^@/, "");
    return `https://instagram.com/${handle}`;
  }
  if (kind === "facebook") return `https://facebook.com/${v.replace(/^@/, "")}`;
  if (kind === "youtube") {
    const handle = v.replace(/^@/, "");
    return handle.includes("/") ? `https://${handle}` : `https://youtube.com/@${handle}`;
  }
  return v.includes(".") ? `https://${v}` : `https://${v}`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the selected image"));
    reader.readAsDataURL(file);
  });
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
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState(
    () => loadAiFlowPendingOrg()?.youtubeUrl?.trim() || "",
  );
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
      if (hasCoverNow && state.images.length > 0) {
        const store = loadAiFlowStore();
        if (store?.sessionToken) {
          try {
            const session = await fetchAiCampaignSession(store.sessionToken);
            if (cancelled) return;
            if (session.linkedinUrl) setLinkedinUrl(session.linkedinUrl);
            const yt =
              session.analysis?.youtubeUrl ||
              loadAiFlowPendingOrg()?.youtubeUrl ||
              "";
            if (yt) setYoutubeUrl(yt);
          } catch {
            /* ignore */
          }
        }
        return;
      }

      let facebookUrl = state.promotion.facebookUrl.trim();
      let instagramHandle = state.promotion.instagramHandle.trim();
      let websiteUrl = state.promotion.websiteUrl.trim();
      let nextLinkedin = "";
      let nextYoutube = loadAiFlowPendingOrg()?.youtubeUrl?.trim() || "";
      let analysisImages: {
        url: string;
        sourceUrl?: string | null;
        source?: string | null;
        caption?: string | null;
      }[] = [];
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
          if (session.linkedinUrl) nextLinkedin = session.linkedinUrl;
          if (session.analysis?.youtubeUrl) nextYoutube = session.analysis.youtubeUrl;
          analysisImages = (session.analysis?.images || []).map((img) => ({
            url: img.url,
            sourceUrl: img.sourceUrl,
            source: img.source,
            caption: img.caption,
          }));
          ideaThumbs = ideaThumbnailFallbackUrls(session.ideas);
        } catch {
          /* keep local promotion */
        }
      }

      if (nextLinkedin) setLinkedinUrl(nextLinkedin);
      if (nextYoutube) setYoutubeUrl(nextYoutube);

      const media = await resolveAiFlowImages({
        facebookUrl,
        instagramHandle,
        websiteUrl,
        linkedinUrl: nextLinkedin || undefined,
        youtubeUrl: nextYoutube || undefined,
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
  /** AI-extracted (or edited) org links shown on this preview. */
  const previewSocialLinks = [
    {
      id: "website" as const,
      label: "Website",
      icon: <Globe className="size-3.5" />,
      value: state.promotion.websiteUrl.trim(),
    },
    {
      id: "facebook" as const,
      label: "Facebook",
      icon: <Facebook className="size-3.5" />,
      value: state.promotion.facebookUrl.trim(),
    },
    {
      id: "instagram" as const,
      label: "Instagram",
      icon: <Instagram className="size-3.5" />,
      value: state.promotion.instagramHandle.trim(),
    },
    {
      id: "youtube" as const,
      label: "YouTube",
      icon: <Youtube className="size-3.5" />,
      value: youtubeUrl.trim(),
    },
  ];
  const foundPreviewSocial = previewSocialLinks.filter((l) => l.value);
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
  const pastDateError = campaignDateNotInPastError({
    startDate: state.startDate,
    endDate: state.endDate,
    eventDate: state.eventDate,
  });
  if (pastDateError) {
    attention.push({
      id: "past-date",
      label: pastDateError,
      action: "Fix Dates",
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
    (timingEval.status === "tight_timeline" ||
      timingEval.status === "too_soon" ||
      timingEval.status === "needs_forkup_review") &&
    timingEval.message &&
    !state.submitForForkupReview &&
    !isBusinessConfirmationComplete(state)
  ) {
    attention.push({
      id: "forkup-timing",
      label:
        timingEval.status === "too_soon"
          ? "Business timeline is too soon (0–7 days) — change date or switch methods"
          : timingEval.status === "tight_timeline"
            ? "Tight business timeline (8–20 days) — confirm business or request review"
            : "Business timeline needs ForkUp review options below",
      action: "Review Timing",
      blocking: timingEval.status === "too_soon",
    });
  }
  if (
    timingEval.status === "limited_promotion_window" &&
    timingEval.message
  ) {
    attention.push({
      id: "limited-promo",
      label: "Limited promotion window (21–29 days) — you can continue with a shorter runway",
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
   * Handles Timeline Check CTAs (change date / drop business / confirm / review).
   * Mirrors AiCampaignDates — state only; launch enforcement remains on the server.
   */
  const handleTimingCta = (cta: TimingCta) => {
    if (cta === "change_date") {
      update({
        ...CLEAR_TIMING_FLAGS,
        businessTimingStatus: timingEval.status,
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
        showBusinessConfirmForm: false,
        businessTimingStatus: "ok",
      });
      return;
    }
    if (cta === "confirm_business") {
      update({
        showBusinessConfirmForm: true,
        submitForForkupReview: false,
        continueWithoutBusinessMethods: false,
        businessTimingStatus: "tight_timeline",
      });
      return;
    }
    if (cta === "submit_for_forkup_review") {
      update({
        submitForForkupReview: true,
        continueWithoutBusinessMethods: false,
        showBusinessConfirmForm: false,
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
        min={todayDateOnly()}
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
        min={campaignDateMin(state.startDate)}
        onChange={(endDate) => update({ endDate, ...clearTimingFlags })}
        className={fieldClass}
      />
    </div>
  ) : null;

  const forkupTimingBanner =
    timingEval.message &&
    (timingEval.status === "limited_promotion_window" ||
      timingEval.status === "tight_timeline" ||
      timingEval.status === "too_soon" ||
      timingEval.status === "needs_forkup_review") ? (
      <TimelineCheckCard
        timingEval={timingEval}
        state={state}
        onCta={handleTimingCta}
        onConfirmField={(patch) => update(patch)}
        onConfirmContinue={() => {
          if (!isBusinessConfirmationComplete(state)) return;
          update({
            showBusinessConfirmForm: false,
            submitForForkupReview: false,
            businessTimingStatus: "tight_timeline",
          });
        }}
      />
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
            <OpenCoverResizeControl
              imageSrc={coverSrc}
              imageName={state.cover?.name}
              onApply={async (file) => {
                const previewUrl = URL.createObjectURL(file);
                const coverId = `cover-resized-${Date.now()}`;
                const pending = {
                  id: coverId,
                  url: previewUrl,
                  name: file.name,
                  source: "manual" as const,
                };
                update({ cover: pending });
                const imageBase64 = await readFileAsDataUrl(file);
                const { url: storedUrl } = await uploadImage({
                  imageBase64,
                  imageMimeType: file.type || "image/jpeg",
                  kind: "cover",
                });
                update({ cover: { ...pending, storedUrl } });
              }}
            />
            <AiCoverChangeButton
              onClick={() => {
                setEditing(true);
                setCoverPickerOpen(true);
              }}
            />
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
                      min={todayDateOnly()}
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

              <div>
                <p className="mb-2 text-xs font-semibold text-muted-foreground">
                  Website & social
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">
                      Website URL
                    </label>
                    <input
                      type="url"
                      value={state.promotion.websiteUrl}
                      onChange={(e) =>
                        update({
                          promotion: {
                            ...state.promotion,
                            websiteUrl: e.target.value,
                          },
                        })
                      }
                      className={fieldClass}
                      placeholder="https://yourorganization.org"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">
                      Facebook Page URL
                    </label>
                    <input
                      type="url"
                      value={state.promotion.facebookUrl}
                      onChange={(e) =>
                        update({
                          promotion: {
                            ...state.promotion,
                            facebookUrl: e.target.value,
                          },
                        })
                      }
                      className={fieldClass}
                      placeholder="https://facebook.com/yourorganization"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">
                      Instagram
                    </label>
                    <input
                      value={state.promotion.instagramHandle}
                      onChange={(e) =>
                        update({
                          promotion: {
                            ...state.promotion,
                            instagramHandle: e.target.value,
                          },
                        })
                      }
                      className={fieldClass}
                      placeholder="https://instagram.com/yourorganization"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">
                      YouTube
                    </label>
                    <input
                      type="url"
                      value={youtubeUrl}
                      onChange={(e) => {
                        const next = e.target.value;
                        setYoutubeUrl(next);
                        const pending = loadAiFlowPendingOrg();
                        if (pending) {
                          saveAiFlowPendingOrg({
                            ...pending,
                            youtubeUrl: next.trim() || null,
                          });
                        }
                      }}
                      className={fieldClass}
                      placeholder="https://youtube.com/@yourorganization"
                    />
                  </div>
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

              {foundPreviewSocial.length > 0 ? (
                <div className="mt-5 border-t border-border pt-4">
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">
                    Website & social
                  </p>
                  <ul className="space-y-2">
                    {foundPreviewSocial.map((link) => (
                      <li key={link.id}>
                        <a
                          href={socialHref(link.value, link.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-start gap-2 text-sm text-primary hover:underline"
                        >
                          <span className="mt-0.5 shrink-0 text-foreground/70">
                            {link.icon}
                          </span>
                          <span className="min-w-0">
                            <span className="font-semibold text-foreground">
                              {link.label}
                            </span>
                            <span className="mt-0.5 block break-all text-xs text-muted-foreground">
                              {link.value}
                            </span>
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
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
          disabled={!ready || inviteSending}
          onClick={() => {
            const fundraiserPath =
              state.accountIntent === "fundraiser" ||
              isForeignNonprofitTarget(
                state.nonprofitProfile,
                state.nonprofitMemberships,
              );
            if (fundraiserPath) {
              if (!getAuthToken()) {
                stashAccountIntent("fundraiser");
                stashAuthReturnStep("ai-campaign-preview");
                sessionStorage.setItem("forkup-auth-initial-mode", "register");
                goTo("auth-login");
                return;
              }
              update({ accountIntent: "fundraiser" });
              const pending = loadAiFlowPendingOrg();
              const stored = loadAiFlowStore();
              // Prefer invite-target id from AI flow storage — membership profile
              // (e.g. Hear To Heal) must not hijack a Headstrong invite.
              const nonprofitId =
                (typeof stored?.nonprofitId === "number" && stored.nonprofitId > 0
                  ? stored.nonprofitId
                  : null) ??
                (typeof pending?.nonprofitId === "number" && pending.nonprofitId > 0
                  ? pending.nonprofitId
                  : null) ??
                (state.nonprofitProfile?.id &&
                !state.nonprofitMemberships.some((m) => m.id === state.nonprofitProfile?.id)
                  ? state.nonprofitProfile.id
                  : null);
              if (!nonprofitId) {
                setInviteError(
                  "This nonprofit must exist in ForkUp before you can send an invite. Pick an organization with a ForkUp profile from Find a nonprofit.",
                );
                return;
              }
              if (state.nonprofitMemberships.some((m) => m.id === nonprofitId)) {
                setInviteError(
                  "You already belong to this nonprofit. Create the campaign from your nonprofit dashboard instead — or pick a different organization to invite.",
                );
                return;
              }
              setInviteError(null);
              setInviteSending(true);
              void createFundraiserCampaignInvite({
                nonprofitId,
                campaignName: state.title.trim(),
                campaignStory: state.description.trim(),
                campaignGoal: Number(String(state.goal).replace(/[^0-9.]/g, "")) || 0,
                startDate: state.startDate || null,
                endDate: state.endDate || null,
                eventDate: state.eventDate || null,
                coverImage:
                  state.cover?.storedUrl || state.cover?.url || null,
                message: null,
                methods: campaignMethodsForApi(state),
                submitForForkupReview: Boolean(state.submitForForkupReview),
              })
                .then(() => goTo("fundraiser-dashboard"))
                .catch((err) =>
                  setInviteError(
                    err instanceof Error ? err.message : "Failed to send invitation",
                  ),
                )
                .finally(() => setInviteSending(false));
              return;
            }
            // Partners are collected after Dates; Preview Continue goes to Launch.
            const nextStep = "review" as const;
            if (getAuthToken()) {
              goTo(nextStep);
              return;
            }
            stashAccountIntent("nonprofit");
            stashAuthReturnStep(nextStep);
            sessionStorage.setItem("forkup-auth-initial-mode", "register");
            goTo("auth-login");
          }}
          className="inline-flex w-full flex-1 items-center justify-center rounded-full bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          {inviteSending
            ? "Sending invite…"
            : state.accountIntent === "fundraiser" ||
                isForeignNonprofitTarget(
                  state.nonprofitProfile,
                  state.nonprofitMemberships,
                )
              ? "Send invite to nonprofit"
              : "Continue"}
        </button>
      </div>
      {inviteError ? (
        <p className="mt-3 text-sm text-destructive">{inviteError}</p>
      ) : null}

      <AiCampaignCoverPicker
        open={coverPickerOpen}
        cover={state.cover}
        images={state.images}
        facebookUrl={state.promotion.facebookUrl}
        instagramHandle={state.promotion.instagramHandle}
        websiteUrl={state.promotion.websiteUrl}
        linkedinUrl={linkedinUrl}
        youtubeUrl={youtubeUrl}
        featuredYoutubeUrl={state.featuredYoutubeUrl}
        onFeaturedYoutubeUrlChange={(url) => update({ featuredYoutubeUrl: url })}
        onClose={() => setCoverPickerOpen(false)}
        onSuggestedImages={(suggested) => {
          const seen = new Set(
            [state.cover, ...state.images]
              .filter(Boolean)
              .map((img) => (img!.url || img!.storedUrl || "").split("?")[0].toLowerCase()),
          );
          const extras = suggested.filter((img) => {
            const key = (img.url || img.storedUrl || "").split("?")[0].toLowerCase();
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          if (extras.length > 0) {
            update({ images: [...state.images, ...extras].slice(0, 10) });
          }
        }}
        onSelectCover={(cover) => {
          update({ cover });
          setCoverPickerOpen(false);
        }}
      />
    </AiFlowShell>
  );
}
