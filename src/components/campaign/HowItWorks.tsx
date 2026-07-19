import { MapPin, Utensils, Heart, Receipt, ArrowRight } from "lucide-react";
import { ScrollReveal } from "@/components/ScrollReveal";
import { useCampaign } from "@/lib/campaign-context";
import { getNonprofitName } from "@/lib/campaign-display";

export const HowItWorks = () => {
  const { state, goTo } = useCampaign();
  const nonprofitName = getNonprofitName(state);

  const steps = [
    {
      icon: MapPin,
      title: "Pick a place you love",
      desc: "Choose a participating local business",
    },
    {
      icon: Utensils,
      title: "Show up",
      desc: "Dine, shop, or book — whatever fits your day",
    },
    {
      icon: Heart,
      title: "Make an impact",
      desc: `A portion of your visit funds equipment, travel, and scholarships for ${nonprofitName}`,
    },
  ];

  return (
    <section className="py-20 md:py-24 section-padding bg-secondary/50">
      <div className="max-w-3xl mx-auto">
        <ScrollReveal>
          <h2 className="font-serif text-3xl sm:text-4xl text-center text-foreground mb-14 text-balance">
            How your visit supports {nonprofitName}
          </h2>
        </ScrollReveal>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-8 text-center">
          {steps.map((step, i) => (
            <ScrollReveal key={i} delay={i * 100}>
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <step.icon size={24} className="text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">{step.title}</h3>
                <p className="text-sm text-muted-foreground text-pretty">{step.desc}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal delay={300}>
          <div className="mt-14 flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center">
            <p className="flex items-center gap-2 font-semibold text-foreground">
              <Receipt className="size-5 text-primary" />
              Already visited?
            </p>
            <p className="max-w-md text-sm text-muted-foreground text-pretty">
              Upload your receipt and we&rsquo;ll turn your visit into a donation for {nonprofitName}.
            </p>
            <button
              type="button"
              onClick={() => goTo("receipt-upload")}
              className="btn-primary inline-flex items-center gap-2"
            >
              Upload your receipt
              <ArrowRight className="size-4" />
            </button>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
};
