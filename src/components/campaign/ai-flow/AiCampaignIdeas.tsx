"use client";

/**
 * AI flow Step 5 — Choose an AI-suggested campaign idea (or start from scratch).
 */
import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { useCampaign, type SupportMethods } from "@/lib/campaign-context";
import {
  fetchAiCampaignSession,
  type AiAnalysisSession,
  type AiCampaignIdea,
  type AiCampaignMethod,
} from "@/lib/api-ai-campaign-flow";
import { generateCampaignDraft } from "@/lib/api";
import { loadAiFlowStore, saveAiFlowStore } from "@/lib/ai-campaign-flow-storage";
import { resolveAiFlowImages, ideaThumbnailFallbackUrls } from "./resolve-ai-flow-images";
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

export function AiCampaignIdeas() {
  const { state, update, goTo } = useCampaign();
  const [session, setSession] = useState<AiAnalysisSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [pickingId, setPickingId] = useState<number | "scratch" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const store = loadAiFlowStore();
    if (!store?.sessionToken) {
      setError("No analysis session found. Please select your organization again.");
      setLoading(false);
      return;
    }
    void fetchAiCampaignSession(store.sessionToken)
      .then((s) => setSession(s))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Could not load campaign ideas."),
      )
      .finally(() => setLoading(false));
  }, []);

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

      let title = idea?.title || `${orgName} Fundraiser`;
      let story = idea?.description || "";
      let facebookUrl = session?.facebookUrl || state.promotion.facebookUrl;
      let instagramHandle = session?.instagramUrl || state.promotion.instagramHandle;
      let websiteUrl = session?.website || state.promotion.websiteUrl || undefined;
      let libraryImageUrl: string | null = null;

      try {
        const draft = await generateCampaignDraft({
          purpose,
          organizationName: orgName,
          mission: session?.analysis?.mission || state.nonprofitProfile?.mission || undefined,
          causeCategory: state.nonprofitProfile?.causeCategory,
          website: websiteUrl,
          methods: Object.entries(methods)
            .filter(([, on]) => on)
            .map(([k]) => k),
          organizationId: state.nonprofitProfile?.id,
          goal: idea?.suggestedGoal ?? undefined,
        });
        if (draft.title) title = draft.title;
        if (draft.story) story = draft.story;
        if (draft.suggestedImageUrl) libraryImageUrl = draft.suggestedImageUrl;
        facebookUrl = draft.facebookUrl || facebookUrl;
        instagramHandle = draft.instagramHandle || instagramHandle;
        websiteUrl = draft.websiteUrl || websiteUrl;
        update({
          promotion: {
            facebookUrl: facebookUrl || state.promotion.facebookUrl,
            instagramHandle: instagramHandle || state.promotion.instagramHandle,
            websiteUrl: websiteUrl || state.promotion.websiteUrl,
            newsletter: state.promotion.newsletter,
          },
        });
      } catch {
        /* keep idea title/description */
      }

      const goal =
        idea?.suggestedGoal != null && idea.suggestedGoal > 0
          ? String(idea.suggestedGoal)
          : state.goal || "10000";

      // Social suggest first, then AI analysis images, then idea/library fallbacks.
      const media = await resolveAiFlowImages({
        facebookUrl,
        instagramHandle,
        websiteUrl,
        analysisImages: (session?.analysis?.images || []).map((img) => ({
          url: img.url,
          sourceUrl: img.sourceUrl,
          source: img.source,
        })),
        fallbackUrls: [
          idea?.thumbnailUrl,
          ...ideaThumbnailFallbackUrls(session?.ideas),
          libraryImageUrl,
        ],
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

  return (
    <AiFlowShell
      title="Choose the campaign you want to build"
      subtitle="ForkUp prepared these ideas from your organization signals. Pick one or start from scratch."
      backStep="ai-find-org"
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-5 animate-spin text-primary" />
          Loading ideas…
        </div>
      ) : error ? (
        <div className="space-y-4">
          <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          <button
            type="button"
            onClick={() => goTo("ai-find-org")}
            className="text-sm font-semibold text-primary"
          >
            Back to organization search
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {(session?.ideas || []).map((idea) => (
            <button
              key={idea.id}
              type="button"
              disabled={pickingId != null}
              onClick={() => void applyIdea(idea)}
              className="flex w-full gap-3 rounded-2xl border border-border bg-card p-3 text-left shadow-sm transition-all hover:border-primary/40 disabled:opacity-60"
            >
              <div className="size-20 shrink-0 overflow-hidden rounded-xl bg-secondary">
                {idea.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={idea.thumbnailUrl} alt="" className="size-full object-cover" />
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
