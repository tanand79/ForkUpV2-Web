"use client";

/**
 * AI flow Step 6 — Review auto-populated goal + methods before dates.
 * Online Donations + Ambassador Sharing stay selected by default (default fundraising layer).
 *
 * Layout is intentionally compact so goal + methods fit with less scrolling.
 * Method toggles use themed checkmarks (primary), not native blue checkboxes.
 * Cover preview includes Change photo → AiCampaignCoverPicker (suggested + upload).
 *
 * Changelog: If cover is missing on mount, hydrate via social suggest first then
 * AI analysis images (same resolver as Purpose / Ideas / Preview).
 */
import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { useCampaign, type SupportMethod } from "@/lib/campaign-context";
import { fetchAiCampaignSession } from "@/lib/api-ai-campaign-flow";
import { loadAiFlowStore } from "@/lib/ai-campaign-flow-storage";
import {
  AiCampaignCoverPicker,
  AiCoverChangeButton,
} from "./AiCampaignCoverPicker";
import { AiFlowShell } from "./AiFlowShell";
import {
  aiFlowCoverSourceLabel,
  ideaThumbnailFallbackUrls,
  resolveAiFlowImages,
} from "./resolve-ai-flow-images";

const GOAL_PRESETS = [10000, 25000, 50000] as const;

const METHOD_OPTIONS: { id: SupportMethod; label: string; hint: string }[] = [
  { id: "donations", label: "Online Donations", hint: "Anyone can give online." },
  { id: "ambassador", label: "Ambassador Sharing", hint: "Supporters share your campaign." },
  { id: "giveback", label: "Dine & Donate", hint: "Local businesses give back a %." },
  {
    id: "guestBartending",
    label: "Guest Bartending",
    hint: "Host an in-person bartending fundraiser.",
  },
];

export function AiCampaignBuild() {
  const { state, update, goTo } = useCampaign();
  const goalNum = Number(String(state.goal).replace(/[^0-9.]/g, ""));
  const matchedPreset = GOAL_PRESETS.find((g) => g === goalNum) ?? null;
  const [customMode, setCustomMode] = useState(!matchedPreset && goalNum > 0);
  const [customGoal, setCustomGoal] = useState(
    !matchedPreset && goalNum > 0 ? String(Math.round(goalNum)) : "",
  );
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
  const [findingPhotos, setFindingPhotos] = useState(false);

  // Repair mid-session state where an AI idea omitted donations/ambassador.
  useEffect(() => {
    if (state.methods.donations && state.methods.ambassador) return;
    update({
      methods: {
        ...state.methods,
        donations: true,
        ambassador: true,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * When Build has no featured photo, retry social suggest first, then AI analysis.
   * Covers cases where Ideas/Purpose resolved zero images (blocked scrapers, missing links).
   */
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const hasCoverNow = !!(state.cover?.url || state.cover?.storedUrl);
      if (hasCoverNow && state.images.length > 0) return;

      setFindingPhotos(!hasCoverNow);
      let facebookUrl = state.promotion.facebookUrl.trim();
      let instagramHandle = state.promotion.instagramHandle.trim();
      let websiteUrl = state.promotion.websiteUrl.trim();
      let analysisImages: {
        url: string;
        sourceUrl?: string | null;
        source?: string | null;
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

      const scratchPath = store?.selectedIdeaId == null;
      const media = await resolveAiFlowImages({
        facebookUrl,
        instagramHandle,
        websiteUrl,
        analysisImages,
        fallbackUrls: scratchPath
          ? [state.cover?.url, state.cover?.storedUrl]
          : [
              ...ideaThumbs,
              state.cover?.url,
              state.cover?.storedUrl,
            ],
        preferredCoverUrl: scratchPath ? null : state.cover?.url || state.cover?.storedUrl || null,
        mode: scratchPath ? "scratch" : "idea",
        limit: scratchPath ? 10 : 6,
      });
      if (cancelled) return;

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
        if (state.images.length === 0 && (media.cover || media.images.length > 0)) {
          const gallery = media.cover
            ? [media.cover, ...media.images].slice(1)
            : media.images;
          if (gallery.length > 0) update({ images: gallery, ...promotionPatch });
          else if (Object.keys(promotionPatch).length > 0) update(promotionPatch);
        } else if (Object.keys(promotionPatch).length > 0) {
          update(promotionPatch);
        }
        setFindingPhotos(false);
        return;
      }

      if (media.cover || media.images.length > 0) {
        update({
          cover: media.cover,
          images: media.images,
          ...promotionPatch,
        });
      } else if (Object.keys(promotionPatch).length > 0) {
        update(promotionPatch);
      }
      setFindingPhotos(false);
    })();

    return () => {
      cancelled = true;
    };
    // Mount-only hydrate when cover was not set upstream.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectPreset = (amount: number) => {
    setCustomMode(false);
    update({ goal: String(amount), goalAiSuggested: true });
  };

  const toggleMethod = (id: SupportMethod) => {
    update({
      methods: { ...state.methods, [id]: !state.methods[id] },
    });
  };

  const continueNext = () => {
    if (customMode) {
      const n = Number(String(customGoal).replace(/[^0-9.]/g, ""));
      if (!Number.isFinite(n) || n <= 0) return;
      update({ goal: String(Math.round(n)), goalAiSuggested: false });
    }
    goTo("ai-campaign-dates");
  };

  const canContinue =
    !customMode || Number(String(customGoal).replace(/[^0-9.]/g, "")) > 0;

  // Scratch path: idea id cleared → back to purpose. Idea cards keep ideas back.
  const scratchPath = loadAiFlowStore()?.selectedIdeaId == null;
  const buildBackStep = scratchPath ? "ai-campaign-purpose" : "ai-campaign-ideas";

  return (
    <AiFlowShell
      title="Everything is auto-populated"
      subtitle="Adjust the suggested goal and fundraising methods, then continue."
      backStep={buildBackStep}
    >
      {state.cover?.url ? (
        <div className="mb-4 overflow-hidden rounded-2xl border border-border">
          <div className="relative flex max-h-48 items-center justify-center overflow-hidden bg-secondary sm:max-h-56">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={state.cover.url}
              alt=""
              className="block max-h-48 w-full object-contain sm:max-h-56"
            />
            <AiCoverChangeButton onClick={() => setCoverPickerOpen(true)} />
          </div>
          <div className="space-y-1 px-3.5 py-3">
            <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              {aiFlowCoverSourceLabel(state.cover)}
            </span>
            <h2 className="text-sm font-semibold leading-snug">{state.title || "Your campaign"}</h2>
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {state.description || state.fundsSupport[0] || ""}
            </p>
          </div>
        </div>
      ) : (
        <div className="mb-4 rounded-2xl border border-border bg-card px-3.5 py-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              Suggested
            </span>
            {findingPhotos ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin text-primary" />
                Finding photos…
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setCoverPickerOpen(true)}
                className="text-xs font-semibold text-primary underline-offset-2 hover:underline"
              >
                Add photo
              </button>
            )}
          </div>
          <h2 className="mt-1.5 text-sm font-semibold leading-snug">
            {state.title || "Your campaign"}
          </h2>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {state.description || state.fundsSupport[0] || ""}
          </p>
          {!findingPhotos ? (
            <p className="mt-2 text-xs text-muted-foreground">
              No public social/website photo found yet — upload one or continue without.
            </p>
          ) : null}
        </div>
      )}

      <AiCampaignCoverPicker
        open={coverPickerOpen}
        cover={state.cover}
        images={state.images}
        onClose={() => setCoverPickerOpen(false)}
        onSelectCover={(cover) => {
          // Keep previous cover in the gallery if it isn't the new pick.
          const prev = state.cover;
          const rest = state.images.filter(
            (img) =>
              img.id !== cover.id &&
              !(prev && (img.id === prev.id || img.url === prev.url)),
          );
          const nextImages =
            prev && prev.id !== cover.id && prev.url !== cover.url
              ? [prev, ...rest.filter((i) => i.id !== prev.id)]
              : rest;
          update({ cover, images: nextImages });
        }}
      />

      <section className="space-y-2">
        <h3 className="text-sm font-bold">Suggested Goal</h3>
        <div className="grid grid-cols-2 gap-2">
          {GOAL_PRESETS.map((amount) => {
            const selected = !customMode && goalNum === amount;
            return (
              <button
                key={amount}
                type="button"
                onClick={() => selectPreset(amount)}
                className={`rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition-all ${
                  selected
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                ${amount.toLocaleString()}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setCustomMode(true)}
            className={`rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition-all ${
              customMode
                ? "border-primary bg-primary/5 text-primary"
                : "border-border bg-card hover:border-primary/40"
            }`}
          >
            Custom Goal
          </button>
        </div>
        {customMode ? (
          <input
            value={customGoal}
            onChange={(e) => setCustomGoal(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="Enter amount"
            className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
          />
        ) : null}
      </section>

      <section className="mt-5 space-y-2">
        <h3 className="text-sm font-bold">Suggested Methods</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {METHOD_OPTIONS.map((opt) => {
            const on = state.methods[opt.id];
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggleMethod(opt.id)}
                aria-pressed={on}
                className={`flex items-start gap-2.5 rounded-xl border-2 p-2.5 text-left transition-all ${
                  on ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <span
                  className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card"
                  }`}
                  aria-hidden
                >
                  {on ? <Check className="size-3.5" strokeWidth={3} /> : null}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold leading-snug">{opt.label}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                    {opt.hint}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <button
        type="button"
        disabled={!canContinue}
        onClick={continueNext}
        className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-dark disabled:opacity-40"
      >
        Continue to dates
      </button>
    </AiFlowShell>
  );
}
