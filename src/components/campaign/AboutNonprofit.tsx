import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { ScrollReveal } from "@/components/ScrollReveal";
import { useCampaign } from "@/lib/campaign-context";
import { getCampaignStory, getNonprofitName, getNonprofitInitials } from "@/lib/campaign-display";

export const AboutNonprofit = () => {
  const [expanded, setExpanded] = useState(false);
  const { state } = useCampaign();
  const nonprofitName = getNonprofitName(state);
  const initials = getNonprofitInitials(state);
  const mission =
    state.nonprofitProfile?.mission?.trim() ||
    getCampaignStory(state) ||
    null;

  if (!mission) return null;

  return (
    <section className="py-20 md:py-24 section-padding bg-secondary/50">
      <div className="max-w-2xl mx-auto text-center">
        <ScrollReveal>
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <span className="font-serif text-xl text-primary">{initials}</span>
          </div>

          <h2 className="font-serif text-2xl sm:text-3xl text-foreground mb-4 text-balance">
            {nonprofitName}
          </h2>

          <p className="text-muted-foreground text-pretty max-w-lg mx-auto mb-4">
            {expanded ? mission : mission.slice(0, 220) + (mission.length > 220 ? "…" : "")}
          </p>

          {mission.length > 220 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-terracotta-light transition-colors"
            >
              {expanded ? "Show less" : "Learn more"}
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
              />
            </button>
          )}
        </ScrollReveal>
      </div>
    </section>
  );
};
