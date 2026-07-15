import { ScrollReveal } from "@/components/ScrollReveal";
import { useCampaign } from "@/lib/campaign-context";
import { getCampaignStory, getNonprofitName } from "@/lib/campaign-display";

interface CampaignStoryProps {
  showLocationsCta?: boolean;
}

export const CampaignStory = ({ showLocationsCta = true }: CampaignStoryProps) => {
  const { state } = useCampaign();
  const story = getCampaignStory(state);
  const nonprofitName = getNonprofitName(state);

  return (
    <section className="py-14 md:py-18 section-padding bg-background border-b border-border/50">
      <div className="max-w-2xl mx-auto text-center">
        <ScrollReveal>
          <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-3">
            About the Cause
          </p>

          <h2 className="font-serif text-2xl sm:text-3xl text-foreground mb-4 text-balance">
            Why this matters
          </h2>

          <p className="text-muted-foreground text-pretty leading-relaxed mb-3">
            {story || "The campaign organizer has not added a story yet."}
          </p>

          <p className="text-sm font-medium text-foreground/80 mb-6">
            Every visit helps {nonprofitName} make this possible.
          </p>

          {showLocationsCta && (
            <p className="text-sm text-primary font-medium">
              Choose a local business below to support the team ↓
            </p>
          )}
        </ScrollReveal>
      </div>
    </section>
  );
};
