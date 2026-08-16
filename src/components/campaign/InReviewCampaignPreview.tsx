/**
 * Owner-only Pending ForkUp Review campaign preview.
 *
 * Purpose: Let a logged-in nonprofit see how their submitted campaign will look
 * while it awaits ForkUp approval — draft watermark, locked public actions.
 * Inputs: `state.campaignSlug` from campaign context (set before navigating here).
 * Outputs: UI only. Does not publish, invite, or expose the campaign publicly.
 *
 * Changelog: Added owner preview for campaign_status = in_review / forkup pending.
 * Changelog: Mounted InReviewCampaignPhotosEditor (crop/resize + save) on this screen.
 * Changelog: Resize on the open cover image (not only in Change photo / panel).
 * Changelog: Contact Support opens a FAQ dialog (InReviewHelpFaqs).
 */
"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Circle,
  Hourglass,
  Loader2,
  Lock,
  Pencil,
  Rocket,
  Share2,
  Store,
  Target,
  Users,
} from "lucide-react";
import {
  fetchBuilderCampaign,
  fetchCampaignDashboard,
  fetchCampaignImages,
  putCampaignImages,
  uploadImage,
  type BuilderCampaignState,
  type CampaignDashboardData,
} from "@/lib/api";
import { useCampaign } from "@/lib/campaign-context";
import { formatDateUs } from "@/lib/date-only";
import { assetSrc } from "@/lib/utils";
import { InReviewCampaignPhotosEditor } from "@/components/campaign/InReviewCampaignPhotosEditor";
import { InReviewHelpFaqs } from "@/components/campaign/InReviewHelpFaqs";
import { OpenCoverResizeControl } from "@/components/campaign/OpenCoverResizeControl";

type StoryTab = "story" | "impact" | "funds" | "updates";

type MethodChip = {
  label: string;
  tone: "active" | "pending";
};

/**
 * Maps API method_type to an owner-facing chip during ForkUp review.
 * Online donations / ambassador stay usable; business-dependent methods wait.
 */
function methodChipsFromDashboard(dash: CampaignDashboardData): MethodChip[] {
  const underReview =
    dash.status === "in_review" ||
    dash.forkupReviewStatus === "pending" ||
    dash.businessTimingStatus === "needs_forkup_review";

  return dash.methods.map((m) => {
    const type = String(m.methodType);
    const isImmediate =
      type === "virtual_donations" || type === "ambassador_fundraising";
    const label =
      m.methodName?.trim() ||
      (type === "virtual_donations"
        ? "Online Donations"
        : type === "ambassador_fundraising"
          ? "Ambassador Sharing"
          : type === "guest_bartending_event"
            ? "Guest Bartending Event"
            : type === "dine_and_donate" ||
                type === "shop_and_donate" ||
                type === "service_giveback"
              ? "Dine & Donate / Giveback"
              : m.methodName || type);
    return {
      label,
      tone: underReview && !isImmediate ? "pending" : "active",
    };
  });
}

function formatMoney(n: number): string {
  return `$${Number(n || 0).toLocaleString()}`;
}

function pctOfGoal(raised: number, goal: number): number {
  if (!goal || goal <= 0) return 0;
  return Math.min(100, Math.round((raised / goal) * 100));
}

export function InReviewCampaignPreview() {
  const { state, goTo, resumeCampaignBuilder, update } = useCampaign();
  const slug = state.campaignSlug?.trim() || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dash, setDash] = useState<CampaignDashboardData | null>(null);
  const [builder, setBuilder] = useState<BuilderCampaignState | null>(null);
  const [storyTab, setStoryTab] = useState<StoryTab>("story");

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      setError("No campaign selected.");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void Promise.all([fetchCampaignDashboard(slug), fetchBuilderCampaign(slug)])
      .then(([dashboard, builderState]) => {
        if (cancelled) return;
        setDash(dashboard);
        setBuilder(builderState);
        if (dashboard.slug && dashboard.slug !== state.campaignSlug) {
          update({ campaignSlug: dashboard.slug });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load campaign preview.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, state.campaignSlug, update]);

  const methodChips = useMemo(() => (dash ? methodChipsFromDashboard(dash) : []), [dash]);

  const title = dash?.name || builder?.campaignName || "Campaign";
  const nonprofit = dash?.nonprofit || "Your organization";
  const story = (builder?.campaignStory || "").trim();
  const coverUrl = builder?.coverImageUrl ? assetSrc(builder.coverImageUrl) : null;
  const goal = Number(dash?.goal ?? builder?.campaignGoal ?? 0);
  const raised = Number(dash?.raised ?? 0);
  const progress = pctOfGoal(raised, goal);
  const startLabel = dash?.startDate ? formatDateUs(dash.startDate) : "—";

  const reviewPending =
    dash?.status === "in_review" ||
    dash?.forkupReviewStatus === "pending" ||
    dash?.businessTimingStatus === "needs_forkup_review";

  const openEdit = () => {
    if (!slug) return;
    void resumeCampaignBuilder(slug).catch(() => {
      goTo("nonprofit-dashboard");
    });
  };

  /**
   * Apply open-cover crop: upload file, merge into gallery, PUT campaign-images.
   * Inputs: cropped File from OpenCoverResizeControl
   * Outputs: updates builder cover preview + server gallery
   */
  const handleOpenCoverResize = async (file: File) => {
    if (!slug) return;
    const imageBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Could not read resized image"));
      reader.readAsDataURL(file);
    });
    const { url: storedUrl } = await uploadImage({
      imageBase64,
      imageMimeType: file.type || "image/jpeg",
      kind: "cover",
    });
    const previewUrl = URL.createObjectURL(file);

    let galleryPayload: {
      imageUrl: string;
      source?: string;
      sourceUrl?: string | null;
      isCover?: boolean;
    }[] = [];
    try {
      const { images: existing } = await fetchCampaignImages(slug);
      galleryPayload = existing.map((g) => ({
        imageUrl: g.storedUrl || g.imageUrl,
        source: g.source,
        sourceUrl: g.sourceUrl,
        isCover: false,
      }));
    } catch {
      /* empty gallery — cover only */
    }
    if (galleryPayload.length === 0 && builder?.coverImageUrl) {
      galleryPayload.push({
        imageUrl: builder.coverImageUrl,
        source: "manual",
        isCover: false,
      });
    }
    const withoutDup = galleryPayload.filter(
      (g) => g.imageUrl !== storedUrl && g.imageUrl !== builder?.coverImageUrl,
    );
    const next = [
      { imageUrl: storedUrl, source: "manual", isCover: true },
      ...withoutDup.map((g) => ({ ...g, isCover: false })),
    ].slice(0, 8);

    await putCampaignImages(slug, next);
    setBuilder((prev) =>
      prev ? { ...prev, coverImageUrl: storedUrl } : prev,
    );
    update({
      cover: {
        id: `cover-${slug}-resized`,
        url: previewUrl,
        name: file.name,
        storedUrl,
        source: "manual",
      },
    });
  };

  if (loading) {
    return (
      <main className="mx-auto flex min-h-[50vh] max-w-6xl items-center justify-center px-5 py-16">
        <Loader2 className="size-7 animate-spin text-primary" />
      </main>
    );
  }

  if (error || !dash) {
    return (
      <main className="mx-auto max-w-lg px-5 py-16 text-center">
        <p className="text-sm text-muted-foreground">{error || "Campaign not found."}</p>
        <button
          type="button"
          onClick={() => goTo("nonprofit-dashboard")}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          <ArrowLeft className="size-4" /> Back to My Campaigns
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 pb-24 sm:px-6 sm:py-10">
      <button
        type="button"
        onClick={() => goTo("nonprofit-dashboard")}
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
      >
        <ArrowLeft className="size-4" /> Back to My Campaigns
      </button>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-5">
          {/* Status banner */}
          <section className="flex flex-wrap items-start gap-4 rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-4 dark:border-amber-800 dark:bg-amber-950/40 sm:px-5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
              <Hourglass className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-extrabold tracking-tight text-amber-950 dark:text-amber-100">
                Pending ForkUp Review
              </h1>
              <p className="mt-1 text-sm text-amber-900/90 dark:text-amber-200/90">
                Your campaign has been submitted and is awaiting approval. This preview shows how
                your campaign will appear once approved. It is not yet visible to donors,
                businesses, or the public.
              </p>
            </div>
          </section>

          {/* Progress stepper */}
          <ol className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card px-3 py-3 sm:gap-3 sm:px-4">
            <StepperNode
              state="done"
              label="Campaign Created"
              icon={<CheckCircle2 className="size-4" />}
            />
            <StepperEdge />
            <StepperNode
              state="done"
              label="AI Content Generated"
              icon={<CheckCircle2 className="size-4" />}
            />
            <StepperEdge />
            <StepperNode
              state="done"
              label="Submitted"
              icon={<CheckCircle2 className="size-4" />}
            />
            <StepperEdge />
            <StepperNode
              state={reviewPending ? "active" : "done"}
              label="ForkUp Review"
              icon={<Hourglass className="size-4" />}
            />
            <StepperEdge />
            <StepperNode
              state="pending"
              label="Approved"
              icon={<CheckCircle2 className="size-4" />}
            />
            <StepperEdge />
            <StepperNode state="pending" label="Live" icon={<Rocket className="size-4" />} />
          </ol>

          {/* Campaign preview card */}
          <section className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5 sm:px-5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Campaign Preview (Not Live)
              </p>
              {!reviewPending && (
                <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-semibold">
                  Status: {dash.status}
                </span>
              )}
            </div>

            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden">
              <span
                className="select-none text-6xl font-black tracking-[0.2em] text-muted-foreground/15 sm:text-7xl"
                style={{ transform: "rotate(-28deg)" }}
                aria-hidden
              >
                DRAFT
              </span>
            </div>

            <div className="relative grid gap-0 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
              <div className="relative z-[1] aspect-[16/11] bg-secondary md:aspect-auto md:min-h-[260px]">
                {coverUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={coverUrl}
                      alt=""
                      className="size-full object-cover"
                    />
                    <OpenCoverResizeControl
                      imageSrc={coverUrl}
                      imageName="campaign-cover"
                      className="absolute bottom-3 left-3 z-20 inline-flex items-center gap-1.5 rounded-full bg-background/95 px-3.5 py-2 text-xs font-semibold shadow-md ring-1 ring-border"
                      onApply={handleOpenCoverResize}
                    />
                  </>
                ) : (
                  <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
                    No cover image
                  </div>
                )}
              </div>

              <div className="relative z-[1] flex flex-col p-5 sm:p-6">
                <h2 className="font-display text-2xl font-extrabold tracking-tight">{title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">by {nonprofit}</p>
                <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-foreground/90">
                  {story || "Your campaign story will appear here once approved."}
                </p>

                <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="size-3.5" /> {startLabel}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Target className="size-3.5" /> Goal {formatMoney(goal)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="size-3.5" /> {dash.supportersGoing} supporters
                  </span>
                </div>

                <div className="mt-4">
                  <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-extrabold text-primary">{formatMoney(raised)} raised</span>
                    <span className="text-xs text-muted-foreground">{progress}% of goal</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-[1] border-t border-primary/15 bg-primary/5 px-4 py-3 sm:px-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-start gap-2 text-xs text-muted-foreground sm:max-w-md">
                  <Lock className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  This campaign is not live yet. Once approved, donors and businesses will be able
                  to view and support your campaign.
                </p>
                <div className="flex flex-wrap gap-2">
                  <LockedAction label="Donate Now" />
                  <LockedAction label="Invite Businesses" icon={<Store className="size-3.5" />} />
                  <LockedAction label="Share Campaign" icon={<Share2 className="size-3.5" />} />
                </div>
              </div>
            </div>
          </section>

          <InReviewCampaignPhotosEditor
            slug={slug}
            initialCoverUrl={builder?.coverImageUrl ?? null}
            onSaved={(coverUrl) => {
              if (!coverUrl) return;
              setBuilder((prev) =>
                prev ? { ...prev, coverImageUrl: coverUrl } : prev,
              );
            }}
          />

          {/* Story + methods */}
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
              <div className="flex flex-wrap gap-2 border-b border-border pb-3">
                {(
                  [
                    ["story", "Story"],
                    ["impact", "Impact"],
                    ["funds", "Where Funds Go"],
                    ["updates", "Updates"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setStoryTab(id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      storyTab === id
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="mt-4">
                {storyTab === "story" && (
                  <>
                    <h3 className="text-base font-bold">Our Story</h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                      {story || "No story has been added yet."}
                    </p>
                  </>
                )}
                {storyTab === "impact" && (
                  <p className="text-sm text-muted-foreground">
                    Impact highlights will appear here after your campaign is live.
                  </p>
                )}
                {storyTab === "funds" && (
                  <p className="text-sm text-muted-foreground">
                    Fund allocation details will appear here after your campaign is live.
                  </p>
                )}
                {storyTab === "updates" && (
                  <p className="text-sm text-muted-foreground">
                    Campaign updates will appear here after your campaign is live.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
              <h3 className="text-base font-bold">Campaign Methods</h3>
              <ul className="mt-3 space-y-2">
                {methodChips.length === 0 ? (
                  <li className="text-sm text-muted-foreground">No methods on this campaign.</li>
                ) : (
                  methodChips.map((m) => (
                    <li
                      key={m.label}
                      className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2.5"
                    >
                      <span className="text-sm font-medium">{m.label}</span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          m.tone === "active"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                        }`}
                      >
                        {m.tone === "active" ? "Active" : "Pending Review"}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </section>
          </div>
        </div>

        {/* Right rail */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <section className="rounded-3xl border border-border bg-card p-5">
            <h2 className="text-sm font-bold">Review Status</h2>
            <span className="mt-3 inline-flex rounded-full border border-amber-300/70 bg-amber-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              Pending ForkUp Review
            </span>
            <p className="mt-3 text-sm text-muted-foreground">
              Estimated review time: Within 24 hours
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              You&apos;ll get an email once there&apos;s an update.
            </p>
          </section>

          <section className="rounded-3xl border border-border bg-card p-5">
            <h2 className="text-sm font-bold">Next Steps</h2>
            <ul className="mt-3 divide-y divide-border">
              <NextStepRow
                label="Edit Campaign"
                icon={<Pencil className="size-3.5" />}
                onClick={openEdit}
              />
              <NextStepRow
                label="View AI Recommendations"
                onClick={() => {
                  update({ campaignSlug: slug });
                  goTo("success-engine");
                }}
              />
            </ul>
          </section>

          <section className="rounded-3xl border border-border bg-card p-5">
            <h2 className="text-sm font-bold">Need Help?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Our Success Team is here to help.
            </p>
            <InReviewHelpFaqs />
          </section>
        </aside>
      </div>
    </main>
  );
}

function StepperNode({
  state,
  label,
  icon,
}: {
  state: "done" | "active" | "pending";
  label: string;
  icon: ReactNode;
}) {
  const tone =
    state === "done"
      ? "text-primary"
      : state === "active"
        ? "text-amber-600 dark:text-amber-400"
        : "text-muted-foreground/50";
  return (
    <li className={`flex min-w-[4.5rem] flex-col items-center gap-1 ${tone}`}>
      <span
        className={`flex size-7 items-center justify-center rounded-full ${
          state === "done"
            ? "bg-primary/10"
            : state === "active"
              ? "bg-amber-100 dark:bg-amber-950"
              : "bg-secondary"
        }`}
      >
        {state === "pending" ? <Circle className="size-3.5" /> : icon}
      </span>
      <span className="max-w-[5.5rem] text-center text-[10px] font-semibold leading-tight">
        {label}
      </span>
    </li>
  );
}

function StepperEdge() {
  return <li className="hidden h-px w-4 shrink-0 bg-border sm:block" aria-hidden />;
}

function LockedAction({
  label,
  icon,
}: {
  label: string;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled
      className="inline-flex h-9 cursor-not-allowed items-center gap-1.5 rounded-full border border-border bg-background/80 px-3 text-xs font-semibold text-muted-foreground opacity-70"
    >
      <Lock className="size-3" />
      {icon}
      {label}
    </button>
  );
}

function NextStepRow({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center justify-between gap-2 py-2.5 text-left text-sm font-medium hover:text-primary"
      >
        <span className="inline-flex items-center gap-2">
          {icon}
          {label}
        </span>
        <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
      </button>
    </li>
  );
}
