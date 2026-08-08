"use client";



/**

 * AI flow — Start from scratch purpose step.

 *

 * Purpose: Let the organizer type ~3 words describing what funds support,

 * then AI-generate a campaign draft and continue into ai-campaign-build.

 *

 * Inputs: campaign context (org profile / AI session org name).

 * Outputs: updated title/story/methods/goal; navigates to ai-campaign-build.

 *

 * Changelog: Added for guest "Start from scratch" path inside the AI funnel

 * (does not use Lovable Quick Start screens).

 * Changelog: While generating, shows AiCampaignDraftPreparing checklist

 * (QuickStart parity) instead of a button spinner.

 */

import { useCallback, useState } from "react";

import { useCampaign } from "@/lib/campaign-context";

import { draftAiCampaignFromPurpose, fetchAiCampaignSession } from "@/lib/api-ai-campaign-flow";

import { loadAiFlowStore, saveAiFlowStore, loadAiFlowPendingOrg } from "@/lib/ai-campaign-flow-storage";

import { resolveAiFlowImages } from "./resolve-ai-flow-images";

import { AiCampaignDraftPreparing } from "./AiCampaignDraftPreparing";

import { AiFlowShell } from "./AiFlowShell";



export function AiCampaignPurpose() {

  const { state, update, goTo } = useCampaign();

  const [purpose, setPurpose] = useState(

    state.fundsSupport[0]?.trim() || state.description?.trim() || "",

  );

  const [touched, setTouched] = useState(false);

  const [generating, setGenerating] = useState(false);

  const [draftFinished, setDraftFinished] = useState(false);

  const [error, setError] = useState<string | null>(null);



  const purposeValid = purpose.trim().split(/\s+/).filter(Boolean).length >= 3;



  const handlePrepareComplete = useCallback(() => {

    goTo("ai-campaign-build");

  }, [goTo]);



  const continueWithPurpose = async () => {

    setTouched(true);

    if (!purposeValid || generating) return;



    setGenerating(true);

    setDraftFinished(false);

    setError(null);



    const store = loadAiFlowStore();

    const orgName =

      state.nonprofitProfile?.organizationName ||

      store?.organizationName ||

      "Your organization";

    const purposeText = purpose.trim();

    const methods = {

      donations: true,

      ambassador: true,

      giveback: false,

      guestBartending: false,

    };



    let title = `${orgName} Fundraiser`;

    let story = purposeText;

    let mission = state.nonprofitProfile?.mission || undefined;

    let facebookUrl = state.promotion.facebookUrl || undefined;

    let instagramHandle = state.promotion.instagramHandle || undefined;

    let website = state.promotion.websiteUrl || undefined;

    let linkedinUrl: string | undefined;

    let youtubeUrl: string | undefined = loadAiFlowPendingOrg()?.youtubeUrl || undefined;

    let analysisImages: {

      url: string;

      sourceUrl?: string | null;

      source?: string | null;

      caption?: string | null;

    }[] = [];

    let libraryImageUrl: string | null = null;



    try {

      if (store?.sessionToken) {

        try {

          const session = await fetchAiCampaignSession(store.sessionToken);

          mission = session.analysis?.mission || mission;

          website = session.website || website;

          facebookUrl = session.facebookUrl || facebookUrl;

          instagramHandle = session.instagramUrl || instagramHandle;

          linkedinUrl = session.linkedinUrl || linkedinUrl;

          youtubeUrl = session.analysis?.youtubeUrl || youtubeUrl;

          analysisImages = (session.analysis?.images || []).map((img) => ({

            url: img.url,

            sourceUrl: img.sourceUrl,

            source: img.source,

            caption: img.caption,

          }));

        } catch {

          /* proceed with local org context */

        }

      }



      try {

        const draft = await draftAiCampaignFromPurpose({

          purpose: purposeText,

          organizationName: orgName,

          mission,

          causeCategory: state.nonprofitProfile?.causeCategory,

          website,

          methods: Object.entries(methods)

            .filter(([, on]) => on)

            .map(([k]) => k),

        });

        if (draft.title) title = draft.title;

        if (draft.story) story = draft.story;

        update({

          promotion: {

            facebookUrl: facebookUrl || state.promotion.facebookUrl,

            instagramHandle: instagramHandle || state.promotion.instagramHandle,

            websiteUrl: website || state.promotion.websiteUrl,

            newsletter: state.promotion.newsletter,

          },

        });

      } catch {

        /* keep purpose as story fallback */

      }



      // Scratch path: up to 10 images from social posts (website only if social empty).
      const media = await resolveAiFlowImages({

        facebookUrl,

        instagramHandle,

        websiteUrl: website,

        linkedinUrl,

        youtubeUrl,

        analysisImages,

        fallbackUrls: [libraryImageUrl, state.cover?.url],

        mode: "scratch",

        limit: 10,

      });



      update({

        title,

        description: story,

        fundsSupport: [purposeText],

        goal: state.goal || "10000",

        methods,

        aiDrafted: true,

        goalAiSuggested: true,

        cover: media.cover || state.cover,

        images: media.images.length > 0 ? media.images : state.images,

      });



      if (store) {

        saveAiFlowStore({

          ...store,

          selectedIdeaId: null,

        });

      }



      // Hold navigation until checklist animation finishes.

      setDraftFinished(true);

    } catch (err) {

      setError(err instanceof Error ? err.message : "Could not prepare your campaign draft.");

      setGenerating(false);

      setDraftFinished(false);

    }

  };



  if (generating) {

    return (

      <AiCampaignDraftPreparing

        active={generating}

        finished={draftFinished}

        onComplete={handlePrepareComplete}

      />

    );

  }



  return (

    <AiFlowShell

      title="What are you raising money for?"

      subtitle="A short phrase is enough. ForkUp will turn it into a campaign draft you can review and edit."

      backStep="ai-campaign-ideas"

    >

      <div className="space-y-4">

        <div>

          <label className="text-xs font-semibold text-muted-foreground">Campaign purpose</label>

          <textarea

            value={purpose}

            onChange={(e) => setPurpose(e.target.value)}

            onBlur={() => setTouched(true)}

            rows={3}

            placeholder="Team travel expenses, new uniforms, scholarships, equipment, or community support"

            className={`mt-1.5 w-full rounded-xl border bg-background px-3.5 py-3 text-base outline-none ${

              touched && !purposeValid ? "border-destructive" : "border-border"

            }`}

          />

          {touched && !purposeValid ? (

            <p className="mt-1.5 text-xs font-medium text-destructive">

              Please describe what the funds will support in a few words.

            </p>

          ) : null}

        </div>



        {error ? (

          <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>

        ) : null}



        <button

          type="button"

          disabled={!purposeValid || generating}

          onClick={() => void continueWithPurpose()}

          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-dark disabled:opacity-60"

        >

          Continue

        </button>

      </div>

    </AiFlowShell>

  );

}

