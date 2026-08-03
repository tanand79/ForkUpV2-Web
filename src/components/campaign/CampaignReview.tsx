"use client";

/**
 * Lovable “Review Your Campaign” (step after Prepare My Draft).
 * Inputs: campaign state (title, purpose, dates, goal, methods, story, cover, logo, promotion).
 * Outputs: editable review UI → Partners (if giveback/guest bartending) or Launch review.
 */

import { useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Eye,
  FileText,
  ImageIcon,
  Pencil,
  Replace,
} from "lucide-react";
import { useCampaign, SUPPORT_METHOD_META, type SupportMethod } from "@/lib/campaign-context";
import { uploadImage } from "@/lib/api";
import { CampaignGalleryPicker } from "@/components/campaign/CampaignGalleryPicker";
import { UsDateInput } from "@/components/campaign/UsDateInput";
import { dateFieldRequirements } from "@/lib/campaign-timing";
import { formatDateUs, formatDateTimeUs, looksLikeIsoDateTime } from "@/lib/date-only";

const METHOD_LABELS = SUPPORT_METHOD_META;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;

/** Reads a File as a data-URL string for the upload API. */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the selected image"));
    reader.readAsDataURL(file);
  });
}

function ReadField({ label, value }: { label: string; value: string }) {
  const raw = value.trim();
  let display = raw || "—";
  if (raw && looksLikeIsoDateTime(raw)) display = formatDateTimeUs(raw);
  else if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) display = formatDateUs(raw);
  return (
    <div className="min-w-0 overflow-hidden rounded-xl bg-secondary/40 px-3 py-2.5">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-0.5 break-all text-sm font-medium">{display}</p>
    </div>
  );
}

function ReviewSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold tracking-tight">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function CampaignReview() {
  const { state, update, goTo, saveAndExit } = useCampaign();
  const [editBasics, setEditBasics] = useState(false);
  const [editStory, setEditStory] = useState(false);
  const [editPromotion, setEditPromotion] = useState(false);
  const [featuredOpen, setFeaturedOpen] = useState(false);
  const [featuredError, setFeaturedError] = useState<string | null>(null);
  const [featuredUploading, setFeaturedUploading] = useState(false);
  const imageRef = useRef<HTMLInputElement>(null);
  const basicsRef = useRef<HTMLDivElement>(null);
  const startDateRef = useRef<HTMLInputElement>(null);
  const eventDateRef = useRef<HTMLInputElement>(null);

  const orgName =
    state.nonprofitProfile?.organizationName?.trim() || "Your organization";
  const enabledMethods = (Object.keys(METHOD_LABELS) as SupportMethod[]).filter(
    (m) => state.methods[m],
  );
  const methodSummary =
    enabledMethods.map((m) => METHOD_LABELS[m].title).join(" · ") || "None selected yet";
  const purpose = state.fundsSupport[0]?.trim() || "";
  const featuredImage = state.cover;
  const businessRequired = state.methods.giveback || state.methods.guestBartending;
  const dateReqs = dateFieldRequirements(state.methods);

  const attention: { label: string; action: string; onClick: () => void }[] = [];
  if (!state.title.trim()) {
    attention.push({
      label: "Campaign title needs attention",
      action: "Add Title",
      onClick: () => setEditBasics(true),
    });
  }
  if (dateReqs.requireStartDate && !state.startDate) {
    attention.push({
      label: "Campaign start date is missing",
      action: "Add Dates",
      onClick: () => {
        setEditBasics(true);
        setTimeout(() => {
          basicsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          startDateRef.current?.focus();
        }, 80);
      },
    });
  }
  if (dateReqs.requireEndDate && !state.endDate) {
    attention.push({
      label: "Campaign end date is missing",
      action: "Add Dates",
      onClick: () => {
        setEditBasics(true);
        setTimeout(() => {
          basicsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          startDateRef.current?.focus();
        }, 80);
      },
    });
  }
  // Nick V2 Layer 2 — Guest Bartending requires a single event date (wired into Lovable Review).
  if (dateReqs.requireEventDate && !state.eventDate) {
    attention.push({
      label: "Guest Bartending event date is missing",
      action: "Add Event Date",
      onClick: () => {
        setEditBasics(true);
        setTimeout(() => {
          basicsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          eventDateRef.current?.focus();
        }, 80);
      },
    });
  }
  if (!featuredImage) {
    attention.push({
      label: "Featured campaign image needed",
      action: "Choose Image",
      onClick: () => setFeaturedOpen(true),
    });
  }

  const ready = attention.length === 0 && !featuredUploading;

  /**
   * Sets a local preview immediately, then uploads to storage so `storedUrl`
   * is durable (S3 or /uploads/…). Without this, launch would persist a blob: URL.
   */
  const handleImage = async (file: File | null) => {
    if (!file) return;
    setFeaturedError(null);
    if (!IMAGE_TYPES.includes(file.type)) {
      setFeaturedError("Image must be a JPG, PNG, or WEBP file.");
      return;
    }
    if (file.size > IMAGE_MAX_BYTES) {
      setFeaturedError("Image must be 10MB or smaller.");
      return;
    }

    const coverId = `cover-${Date.now()}`;
    const previewUrl = URL.createObjectURL(file);
    update({ cover: { id: coverId, url: previewUrl, name: file.name } });
    setFeaturedUploading(true);
    try {
      const imageBase64 = await readFileAsDataUrl(file);
      const { url: storedUrl } = await uploadImage({
        imageBase64,
        imageMimeType: file.type,
        kind: "cover",
      });
      update({ cover: { id: coverId, url: previewUrl, name: file.name, storedUrl } });
      setFeaturedOpen(false);
    } catch {
      setFeaturedError("We couldn't save that image. Please check your connection and try again.");
    } finally {
      setFeaturedUploading(false);
    }
  };

  const continueNext = () => {
    if (!ready) return;
    if (businessRequired) goTo("businesses");
    else goTo("review");
  };

  return (
    <>
      <main className="mx-auto max-w-[1160px] px-5 py-5 pb-32 sm:px-6">
        <button
          type="button"
          onClick={() => goTo("quick-start")}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to Build
        </button>

        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-primary">
          <FileText className="size-3" />
          Campaign review
        </span>
        <h1 className="font-display mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
          Review the campaign ForkUp prepared for you.
        </h1>
        <p className="mt-2 max-w-[68ch] text-sm text-muted-foreground">
          Everything is still editable. Review the details, make any changes, and complete anything
          that is still needed.
        </p>

        <div className="mt-5 grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start lg:gap-8">
          <div className="space-y-4">
            <div ref={basicsRef}>
              <ReviewSection
                title="Campaign basics"
                action={
                  <button
                    type="button"
                    onClick={() => setEditBasics((v) => !v)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <Pencil className="size-3" />
                    {editBasics ? "Done" : "Edit"}
                  </button>
                }
              >
                {editBasics ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">
                        Campaign title
                      </label>
                      <input
                        value={state.title}
                        onChange={(e) => update({ title: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none"
                        placeholder={`Support ${orgName}`}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">
                        Campaign purpose (public-facing)
                      </label>
                      <textarea
                        value={purpose}
                        onChange={(e) => update({ fundsSupport: [e.target.value] })}
                        rows={2}
                        className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none"
                        placeholder="What the funds will support"
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {(dateReqs.requireStartDate || dateReqs.startOptional) && (
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground">
                            Start date
                            {dateReqs.startOptional ? " (optional)" : ""}
                          </label>
                          <UsDateInput
                            ref={startDateRef}
                            value={state.startDate}
                            onChange={(startDate) =>
                              update({
                                startDate,
                                submitForForkupReview: false,
                                continueWithoutBusinessMethods: false,
                              })
                            }
                            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none"
                          />
                        </div>
                      )}
                      {dateReqs.requireEndDate && (
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground">
                            End date
                          </label>
                          <UsDateInput
                            value={state.endDate}
                            min={state.startDate || undefined}
                            onChange={(endDate) =>
                              update({
                                endDate,
                                submitForForkupReview: false,
                                continueWithoutBusinessMethods: false,
                              })
                            }
                            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none"
                          />
                        </div>
                      )}
                      {dateReqs.requireEventDate && (
                        <div className="sm:col-span-2">
                          <label className="text-xs font-semibold text-muted-foreground">
                            Guest Bartending event date
                          </label>
                          <UsDateInput
                            ref={eventDateRef}
                            value={state.eventDate}
                            onChange={(eventDate) =>
                              update({
                                eventDate,
                                submitForForkupReview: false,
                                continueWithoutBusinessMethods: false,
                              })
                            }
                            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none"
                          />
                          <p className="mt-1 text-xs text-muted-foreground">
                            Required for Guest Bartending. Giveback methods still use the campaign
                            start/end dates above when selected.
                          </p>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">
                        Fundraising goal amount (optional)
                      </label>
                      <input
                        value={state.goal}
                        onChange={(e) =>
                          update({ goal: e.target.value, goalAiSuggested: false })
                        }
                        className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none"
                        placeholder="e.g. $5,000"
                      />
                      {state.goalAiSuggested && state.goal.trim() ? (
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          Suggested for you — edit anytime.
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <ReadField label="Campaign title" value={state.title} />
                    <ReadField label="Campaign purpose" value={purpose} />
                    {(dateReqs.requireStartDate ||
                      dateReqs.startOptional ||
                      !!state.startDate) && (
                      <ReadField label="Start date" value={state.startDate} />
                    )}
                    {(dateReqs.requireEndDate || !!state.endDate) && (
                      <ReadField label="End date" value={state.endDate} />
                    )}
                    {(dateReqs.requireEventDate || !!state.eventDate) && (
                      <ReadField label="Guest Bartending event date" value={state.eventDate} />
                    )}
                    {state.goal.trim() && (
                      <ReadField label="Fundraising goal" value={state.goal} />
                    )}
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-secondary/40 p-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-muted-foreground">
                      Selected fundraising methods
                    </p>
                    <p className="mt-0.5 truncate text-sm font-medium">{methodSummary}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => goTo("quick-start")}
                    className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <Pencil className="size-3" />
                    Edit Methods
                  </button>
                </div>
              </ReviewSection>
            </div>

            <ReviewSection
              title="Campaign story"
              action={
                <button
                  type="button"
                  onClick={() => setEditStory((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <Pencil className="size-3" />
                  {editStory ? "Done" : "Edit Story"}
                </button>
              }
            >
              {editStory ? (
                <textarea
                  value={state.description}
                  onChange={(e) => update({ description: e.target.value, storyAccepted: true })}
                  rows={6}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none"
                  placeholder="The story ForkUp prepared for your campaign…"
                />
              ) : (
                <div className="whitespace-pre-wrap rounded-xl bg-secondary/40 p-3 text-sm text-foreground">
                  {state.description ||
                    "Your prepared campaign story will appear here. You can edit anything that needs attention."}
                </div>
              )}
            </ReviewSection>

            {/*
              Promotion channels — same fields as Campaign Media (old flow).
              New Lovable path skips Media, so Facebook / Instagram / website live here.
            */}
            <ReviewSection
              title="Promotion channels"
              action={
                <button
                  type="button"
                  onClick={() => setEditPromotion((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <Pencil className="size-3" />
                  {editPromotion ? "Done" : "Edit"}
                </button>
              }
            >
              <p className="mb-3 text-xs text-muted-foreground">
                Optional — tell ForkUp where supporters already hear from you. Used for posts,
                reminders, and sharing tools.
              </p>
              {editPromotion ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">
                      Facebook Page URL
                    </label>
                    <input
                      value={state.promotion.facebookUrl}
                      onChange={(e) =>
                        update({
                          promotion: { ...state.promotion, facebookUrl: e.target.value },
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none"
                      placeholder="https://facebook.com/yourorganization"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">
                      Instagram Handle
                    </label>
                    <input
                      value={state.promotion.instagramHandle}
                      onChange={(e) =>
                        update({
                          promotion: { ...state.promotion, instagramHandle: e.target.value },
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none"
                      placeholder="@yourorganization"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Website URL</label>
                    <input
                      value={state.promotion.websiteUrl}
                      onChange={(e) =>
                        update({
                          promotion: { ...state.promotion, websiteUrl: e.target.value },
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none"
                      placeholder="https://yourorganization.org"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">
                      Newsletter / Email List Link or Notes
                    </label>
                    <input
                      value={state.promotion.newsletter}
                      onChange={(e) =>
                        update({
                          promotion: { ...state.promotion, newsletter: e.target.value },
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none"
                      placeholder="Link to your newsletter, or notes about your email list"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <ReadField label="Facebook Page URL" value={state.promotion.facebookUrl} />
                  <ReadField label="Instagram Handle" value={state.promotion.instagramHandle} />
                  <ReadField label="Website URL" value={state.promotion.websiteUrl} />
                  <ReadField
                    label="Newsletter / Email list"
                    value={state.promotion.newsletter}
                  />
                </div>
              )}
            </ReviewSection>
          </div>

          <div className="space-y-4">
            <ReviewSection title="Campaign appearance">
              <div className="space-y-4">
                <div>
                  <div className="overflow-hidden rounded-xl ring-1 ring-border">
                    <div className="relative aspect-[21/9] w-full bg-secondary">
                      {featuredImage ? (
                        <img
                          src={featuredImage.url || featuredImage.storedUrl}
                          alt="Featured campaign image"
                          className="size-full object-cover"
                          onError={() => {
                            // Drop broken library/social URLs so the user can upload or reload.
                            update({ cover: null });
                          }}
                        />
                      ) : (
                        <div className="flex size-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
                          <ImageIcon className="size-6" />
                          <span className="text-xs font-semibold">Image needed</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold text-muted-foreground">Featured image</p>
                    <button
                      type="button"
                      onClick={() => setFeaturedOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold transition-colors hover:bg-secondary"
                    >
                      <Replace className="size-3.5" /> Change Featured Image
                    </button>
                  </div>
                </div>

                <CampaignGalleryPicker
                  promotion={state.promotion}
                  cover={state.cover}
                  images={state.images}
                  onChange={({ cover, images }) => update({ cover, images })}
                />

                <div className="flex items-center gap-3 rounded-xl bg-secondary/40 p-3">
                  <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-background ring-1 ring-border">
                    {state.logo ? (
                      <img
                        src={state.logo.url}
                        alt="Organization logo"
                        className="size-full object-contain"
                      />
                    ) : (
                      <Building2 className="size-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      {state.logo ? "Organization logo applied" : "Organization logo placeholder"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {state.logo
                        ? "Reused from your organization profile."
                        : `${orgName} can add or update its logo before launch.`}
                    </p>
                  </div>
                </div>
              </div>
            </ReviewSection>

            <section
              className={`rounded-2xl border p-5 ${
                ready
                  ? "border-emerald-300/60 bg-emerald-50/60"
                  : "border-amber-300/60 bg-amber-50/60"
              }`}
            >
              {ready ? (
                <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                  <CheckCircle2 className="size-4" />
                  Your campaign is ready for the next step.
                </p>
              ) : (
                <>
                  <p className="flex items-center gap-2 text-sm font-bold text-amber-800">
                    <AlertTriangle className="size-4" />
                    {attention.length} item{attention.length === 1 ? "" : "s"} need your attention
                  </p>
                  <ul className="mt-3 space-y-2">
                    {attention.map((a) => (
                      <li
                        key={a.label}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-background/70 p-3"
                      >
                        <span className="text-sm font-medium">{a.label}</span>
                        <button
                          type="button"
                          onClick={a.onClick}
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
          </div>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-[60] border-t border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1160px] flex-wrap items-center justify-end gap-2 px-5 py-3 sm:gap-3 sm:px-6">
          <button
            type="button"
            onClick={saveAndExit}
            className="order-3 inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary sm:order-1"
          >
            Save &amp; Exit
          </button>
          <button
            type="button"
            onClick={() => goTo("campaign-page")}
            className="order-2 inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
          >
            <Eye className="size-4" />
            Preview Campaign
          </button>
          <button
            type="button"
            onClick={continueNext}
            disabled={!ready}
            className="order-1 inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40 sm:order-3 sm:flex-none"
          >
            {businessRequired ? "Continue to Business Partners" : "Continue to Launch"}
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>

      <input
        ref={imageRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          void handleImage(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />

      {featuredOpen && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-foreground/40 p-0 backdrop-blur-sm sm:items-center sm:p-6">
          <div className="flex w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h3 className="text-sm font-bold">Change Featured Image</h3>
              <button
                type="button"
                onClick={() => setFeaturedOpen(false)}
                disabled={featuredUploading}
                className="text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40"
              >
                Close
              </button>
            </div>
            <div className="space-y-3 p-5">
              <button
                type="button"
                onClick={() => imageRef.current?.click()}
                disabled={featuredUploading}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-secondary/30 px-4 py-8 text-sm font-semibold transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ImageIcon className="size-5" />
                {featuredUploading ? "Saving image…" : "Upload an image"}
              </button>
              {featuredError && (
                <p className="text-xs font-medium text-destructive">{featuredError}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
