"use client";

/**
 * AI flow Step 5 — Choose an AI-suggested campaign idea (or start from scratch).
 */
import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { useCampaign, type SupportMethods } from "@/lib/campaign-context";
import {
  fetchAiCampaignSession,
  resolveAiCampaignSources,
  type AiAnalysisSession,
  type AiCampaignIdea,
  type AiCampaignMethod,
} from "@/lib/api-ai-campaign-flow";
import { suggestCampaignImages, type SuggestedCampaignImage } from "@/lib/api";
import {
  loadAiFlowStore,
  saveAiFlowStore,
  loadAiFlowPendingOrg,
  saveAiFlowPendingOrg,
} from "@/lib/ai-campaign-flow-storage";
import {
  resolveAiFlowImages,
  ideaThumbnailFallbackUrls,
  looksLikeLogoUrl,
} from "./resolve-ai-flow-images";
import { AiFlowShell } from "./AiFlowShell";

/**
 * Maps an AI idea's suggested methods onto builder toggles.
 * Online Donations + Ambassador Sharing are always ON by default (default fundraising layer).
 * Giveback / Guest Bartending stay opt-in from the idea suggestion.
 */
function methodsFromIdea(methods: AiCampaignMethod[]): SupportMethods {
  return {
    donations: true,
    ambassador: true,
    giveback: methods.includes("giveback"),
    guestBartending: methods.includes("guestBartending"),
  };
}

/** Ensures Online Donations + Ambassador stay selected as the default layer. */
function ensureDefaultFundraisingLayer(m: SupportMethods): SupportMethods {
  return { ...m, donations: true, ambassador: true };
}

/**
 * True when an idea thumbnail should be replaced by a live social suggest image.
 * Inputs: stored thumbnail URL. Outputs: true for empty / logo / LinkedIn shell assets.
 */
function isWeakIdeaThumbnail(url: string | null | undefined): boolean {
  const u = (url || "").trim();
  if (!u) return true;
  if (looksLikeLogoUrl(u)) return true;
  if (/static\.licdn\.com\/aero|spritesheet|placeholder|default[_-]?cover|data:image/i.test(u)) {
    return true;
  }
  return false;
}

/**
 * Prefer photo-like suggest results for idea cards / photo strip.
 * Strict product order: Instagram → Facebook → LinkedIn → YouTube → website.
 * Inputs: suggest response images. Outputs: ranked usable images.
 */
function usableSuggestImages(
  images: SuggestedCampaignImage[],
): SuggestedCampaignImage[] {
  const rank = (img: SuggestedCampaignImage) => {
    const ref = `${img.sourceUrl || ""} ${img.url || ""}`;
    if (img.source === "instagram") return 0;
    if (img.source === "facebook") return 10;
    if (/linkedin\.com|licdn\.com/i.test(ref)) return 20;
    if (/youtube\.com|youtu\.be|ytimg\.com/i.test(ref)) return 30;
    if (img.source === "social_suggest") return 35;
    if (img.source === "website") return 40;
    return 50;
  };

  const out: SuggestedCampaignImage[] = [];
  const seen = new Set<string>();
  for (const img of [...images].sort((a, b) => rank(a) - rank(b))) {
    const url = (img.url || "").trim();
    if (!url || isWeakIdeaThumbnail(url)) continue;
    const key = url.split("?")[0].toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(img);
  }
  return out;
}

export function AiCampaignIdeas() {
  const { state, update, goTo } = useCampaign();
  const [session, setSession] = useState<AiAnalysisSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [pickingId, setPickingId] = useState<number | "scratch" | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Non-blocking note when social photos could not be attached to idea cards. */
  const [photoWarning, setPhotoWarning] = useState<string | null>(null);
  /** Up to 10 backend-extracted social/website photos for this org. */
  const [socialPhotos, setSocialPhotos] = useState<SuggestedCampaignImage[]>([]);
  /** Client-side broken image URLs so cards can fall back to Sparkles. */
  const [brokenThumbs, setBrokenThumbs] = useState<Record<string, true>>({});

  useEffect(() => {
    const store = loadAiFlowStore();
    if (!store?.sessionToken) {
      setError("No analysis session found. Please select your organization again.");
      setLoading(false);
      return;
    }
    void fetchAiCampaignSession(store.sessionToken)
      .then(async (s) => {
        const ideas = s.ideas || [];
        setPhotoWarning(null);

        const pending = loadAiFlowPendingOrg();
        let facebookUrl =
          s.facebookUrl || state.promotion.facebookUrl || pending?.facebookUrl || "";
        let instagramUrl =
          s.instagramUrl || state.promotion.instagramHandle || pending?.instagramUrl || "";
        let websiteUrl = s.website || state.promotion.websiteUrl || pending?.website || "";
        let linkedinUrl = s.linkedinUrl || pending?.linkedinUrl || "";
        let youtubeUrl = s.analysis?.youtubeUrl || pending?.youtubeUrl || "";

        // If LI/YT (or other social) missing, re-resolve from org identity via backend.
        if (!linkedinUrl || !youtubeUrl || !facebookUrl || !instagramUrl) {
          try {
            const resolved = await resolveAiCampaignSources({
              organizationName: s.organizationName || store.organizationName,
              ein: s.ein,
              nonprofitId: s.nonprofitId,
              website: websiteUrl || null,
              facebookUrl: facebookUrl || null,
              instagramUrl: instagramUrl || null,
              linkedinUrl: linkedinUrl || null,
              youtubeUrl: youtubeUrl || null,
            });
            facebookUrl = facebookUrl || resolved.facebookUrl || "";
            instagramUrl = instagramUrl || resolved.instagramUrl || "";
            websiteUrl = websiteUrl || resolved.website || "";
            linkedinUrl = linkedinUrl || resolved.linkedinUrl || "";
            youtubeUrl = youtubeUrl || resolved.youtubeUrl || "";
            if (pending) {
              saveAiFlowPendingOrg({
                ...pending,
                website: websiteUrl || pending.website,
                facebookUrl: facebookUrl || pending.facebookUrl,
                instagramUrl: instagramUrl || pending.instagramUrl,
                linkedinUrl: linkedinUrl || pending.linkedinUrl,
                youtubeUrl: youtubeUrl || pending.youtubeUrl,
              });
            }
          } catch (resolveErr) {
            console.error("[AiCampaignIdeas] resolveAiCampaignSources failed", resolveErr);
          }
        }

        try {
          const { images } = await suggestCampaignImages({
            facebookUrl: facebookUrl || undefined,
            instagramHandle: instagramUrl || undefined,
            websiteUrl: websiteUrl || undefined,
            linkedinUrl: linkedinUrl || undefined,
            youtubeUrl: youtubeUrl || undefined,
            limit: 10,
          });
          const usable = usableSuggestImages(images).slice(0, 10);
          setSocialPhotos(usable);
          const urls = usable.map((img) => img.url);

          if (urls.length > 0) {
            setBrokenThumbs({});
            setSession({
              ...s,
              ideas: ideas.map((idea, i) => ({
                ...idea,
                thumbnailUrl: urls[i % urls.length] || urls[0] || idea.thumbnailUrl,
              })),
            });
            return;
          }

          setSession(s);
          setPhotoWarning(
            "Could not load social photos for these ideas. You can continue and change the photo later.",
          );
          return;
        } catch (suggestErr) {
          console.error("[AiCampaignIdeas] suggestCampaignImages failed", suggestErr);
          setSession(s);
          setPhotoWarning(
            suggestErr instanceof Error
              ? `Photo lookup failed: ${suggestErr.message}`
              : "Photo lookup failed. You can continue and change the photo later.",
          );
          return;
        }
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Could not load campaign ideas."),
      )
      .finally(() => setLoading(false));
  }, [state.promotion.facebookUrl, state.promotion.instagramHandle, state.promotion.websiteUrl]);

  const applyIdea = async (idea: AiCampaignIdea | null) => {
    setPickingId(idea?.id ?? "scratch");
    setError(null);
    const store = loadAiFlowStore();
    const orgName =
      state.nonprofitProfile?.organizationName ||
      session?.organizationName ||
      store?.organizationName ||
      "Your organization";

    try {
      const purpose =
        idea?.description?.trim() ||
        session?.analysis?.mission ||
        state.nonprofitProfile?.mission ||
        `Support ${orgName}`;

      const methods = ensureDefaultFundraisingLayer(
        idea
          ? methodsFromIdea(idea.suggestedMethods)
          : {
              donations: true,
              ambassador: true,
              giveback: false,
              guestBartending: false,
            },
      );

      // Use new-AI idea card fields (no legacy /generate-campaign-draft polish).
      const title = idea?.title || `${orgName} Fundraiser`;
      const story = idea?.description || "";
      const facebookUrl = session?.facebookUrl || state.promotion.facebookUrl;
      const instagramHandle = session?.instagramUrl || state.promotion.instagramHandle;
      const websiteUrl = session?.website || state.promotion.websiteUrl || undefined;

      update({
        promotion: {
          facebookUrl: facebookUrl || state.promotion.facebookUrl,
          instagramHandle: instagramHandle || state.promotion.instagramHandle,
          websiteUrl: websiteUrl || state.promotion.websiteUrl,
          newsletter: state.promotion.newsletter,
        },
      });

      const goal =
        idea?.suggestedGoal != null && idea.suggestedGoal > 0
          ? String(idea.suggestedGoal)
          : state.goal || "10000";

      // Keep the chosen idea card photo as cover; fill gallery around it.
      const media = await resolveAiFlowImages({
        facebookUrl,
        instagramHandle,
        websiteUrl,
        linkedinUrl: session?.linkedinUrl || undefined,
        youtubeUrl:
          session?.analysis?.youtubeUrl ||
          loadAiFlowPendingOrg()?.youtubeUrl ||
          undefined,
        analysisImages: (session?.analysis?.images || []).map((img) => ({
          url: img.url,
          sourceUrl: img.sourceUrl,
          source: img.source,
          caption: img.caption,
        })),
        fallbackUrls: [
          idea?.thumbnailUrl,
          ...socialPhotos.map((p) => p.url),
          ...ideaThumbnailFallbackUrls(session?.ideas),
        ],
        preferredCoverUrl: idea?.thumbnailUrl || socialPhotos[0]?.url || null,
        mode: "idea",
        limit: 6,
      });

      update({
        title,
        description: story,
        fundsSupport: [purpose],
        goal,
        methods,
        aiDrafted: true,
        goalAiSuggested: true,
        cover: media.cover || state.cover,
        images: media.images.length > 0 ? media.images : state.images,
      });

      if (store) {
        saveAiFlowStore({
          ...store,
          selectedIdeaId: idea?.id ?? null,
        });
      }

      goTo("ai-campaign-build");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open this campaign idea.");
    } finally {
      setPickingId(null);
    }
  };

  // Nonprofit Create Campaign: Back returns to dashboard (not find/connect social).
  const backStep =
    state.accountIntent !== "fundraiser" && state.nonprofitMemberships.length > 0
      ? "nonprofit-dashboard"
      : "ai-connect-social";

  return (
    <AiFlowShell
      title="Choose the campaign you want to build"
      subtitle="ForkUp prepared these ideas from your organization signals. Pick one or start from scratch."
      backStep={backStep}
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-5 animate-spin text-primary" />
          Loading ideas & social photos…
        </div>
      ) : error ? (
        <div className="space-y-4">
          <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          <button
            type="button"
            onClick={() => goTo("ai-connect-social")}
            className="text-sm font-semibold text-primary"
          >
            Back to connect accounts
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {photoWarning ? (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {photoWarning}
            </p>
          ) : null}

          {socialPhotos.length > 0 ? (
            <div className="rounded-2xl border border-border bg-card p-3">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">
                Photos from social ({socialPhotos.length}/10)
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {socialPhotos.map((photo, idx) => (
                  <div
                    key={`${photo.url}-${idx}`}
                    className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-secondary"
                    title={photo.caption || photo.sourceUrl || photo.source}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="size-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {(session?.ideas || []).map((idea) => (
            <button
              key={idea.id}
              type="button"
              disabled={pickingId != null}
              onClick={() => void applyIdea(idea)}
              className="flex w-full gap-3 rounded-2xl border border-border bg-card p-3 text-left shadow-sm transition-all hover:border-primary/40 disabled:opacity-60"
            >
              <div className="size-20 shrink-0 overflow-hidden rounded-xl bg-secondary">
                {idea.thumbnailUrl && !brokenThumbs[idea.thumbnailUrl] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={idea.thumbnailUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="size-full object-cover"
                    onError={() =>
                      setBrokenThumbs((prev) => ({
                        ...prev,
                        [idea.thumbnailUrl!]: true,
                      }))
                    }
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-primary">
                    <Sparkles className="size-6" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold leading-snug">{idea.title}</h2>
                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                    {idea.confidence}%
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{idea.description}</p>
                {pickingId === idea.id ? (
                  <p className="mt-2 inline-flex items-center gap-1 text-xs text-primary">
                    <Loader2 className="size-3.5 animate-spin" /> Building draft…
                  </p>
                ) : null}
              </div>
            </button>
          ))}

          <button
            type="button"
            disabled={pickingId != null}
            onClick={() => {
              const store = loadAiFlowStore();
              if (store) saveAiFlowStore({ ...store, selectedIdeaId: null });
              goTo("ai-campaign-purpose");
            }}
            className="mt-4 w-full text-center text-sm font-semibold text-primary underline-offset-4 hover:underline disabled:opacity-60"
          >
            Want to create something different? Start from scratch.
          </button>
        </div>
      )}
    </AiFlowShell>
  );
}
