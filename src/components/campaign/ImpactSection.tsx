import { TrendingUp } from "lucide-react";
import { ScrollReveal } from "@/components/ScrollReveal";

export const ImpactSection = () => (
  <section className="py-20 md:py-24 section-padding">
    <div className="max-w-2xl mx-auto">
      <ScrollReveal>
        <div className="card-warm p-8 sm:p-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-forest/10 flex items-center justify-center mx-auto mb-5">
            <TrendingUp size={22} className="text-forest" />
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl text-foreground mb-3 text-balance">
            Real Community Impact
          </h2>
          <p className="text-2xl sm:text-3xl font-bold text-primary mb-2">
            $3,240
          </p>
          <p className="text-muted-foreground mb-1">
            raised in our last campaign for local youth programs
          </p>
          <p className="text-sm text-muted-foreground/70">
            Funds supported equipment, travel, and scholarships
          </p>
        </div>
      </ScrollReveal>
    </div>
  </section>
);
