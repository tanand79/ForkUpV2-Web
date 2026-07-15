import { Heart } from "lucide-react";
import { ScrollReveal } from "@/components/ScrollReveal";
import { useCampaign } from "@/lib/campaign-context";
import { getNonprofitName } from "@/lib/campaign-display";

interface DonateSectionProps {
  onDonate?: () => void;
}

export const DonateSection = ({ onDonate }: DonateSectionProps) => {
  const { state } = useCampaign();
  const nonprofitName = getNonprofitName(state);

  return (
    <section className="py-16 md:py-20 section-padding bg-secondary/30">
      <div className="max-w-md mx-auto text-center">
        <ScrollReveal>
          <p className="text-sm text-muted-foreground mb-2">Can't make it?</p>
          <button
            onClick={onDonate}
            className="btn-ghost inline-flex items-center gap-2 text-primary hover:bg-primary/5 hover:text-primary"
          >
            <Heart size={16} /> Donate to {nonprofitName}
          </button>
        </ScrollReveal>
      </div>
    </section>
  );
};
