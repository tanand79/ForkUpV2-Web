import { ScrollReveal } from "@/components/ScrollReveal";
import { useCampaign } from "@/lib/campaign-context";
import { getNonprofitName, getPublicLocations } from "@/lib/campaign-display";

interface Fundraiser {
  name: string;
  raised: number;
  goal: number;
}

interface Donor {
  name: string;
  inSupportOf: string;
  isAnonymous?: boolean;
}

const formatCurrency = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const getInitials = (name: string) => {
  if (name.toLowerCase() === "anonymous") return "A";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
};

const FundraiserAvatar = ({ name }: { name: string }) => (
  <div className="flex-shrink-0 w-11 h-11 rounded-lg flex items-center justify-center text-sm font-semibold bg-primary/10 text-primary">
    {getInitials(name) || "•"}
  </div>
);

const DonorAvatar = ({ name }: { name: string }) => (
  <div className="flex-shrink-0 w-11 h-11 rounded-lg flex items-center justify-center text-sm font-semibold bg-secondary text-muted-foreground">
    {getInitials(name) || "•"}
  </div>
);

const EmptyList = ({ message }: { message: string }) => (
  <p className="px-2 py-6 text-center text-sm text-muted-foreground">{message}</p>
);

export const LeaderboardSection = () => {
  const { state } = useCampaign();
  const nonprofitName = getNonprofitName(state);

  const fundraisers: Fundraiser[] = state.ambassadors.map((a) => ({
    name: a.name,
    raised: 0,
    goal: 100,
  }));

  const participatingBusinesses = getPublicLocations(state);
  const donors: Donor[] = participatingBusinesses.map((b) => ({
    name: b.name,
    inSupportOf: nonprofitName,
  }));

  return (
    <section className="py-20 md:py-24 bg-secondary/30">
      <div className="section-padding max-w-6xl mx-auto">
        <ScrollReveal>
          <div className="text-center mb-10">
            <h2 className="font-serif text-3xl sm:text-4xl text-foreground mb-3 text-balance leading-[1.1]">
              Community Impact
            </h2>
            <p className="text-muted-foreground text-pretty">
              See who&apos;s leading the charge for{" "}
              <span className="font-semibold text-foreground">{nonprofitName}</span>
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
          <ScrollReveal delay={50}>
            <div className="card-warm p-6 sm:p-7 h-full">
              <h3 className="font-serif text-2xl text-foreground mb-5">
                Top Fundraisers
              </h3>
              {fundraisers.length === 0 ? (
                <EmptyList message="Ambassador fundraising activity will appear here once supporters join." />
              ) : (
                <ol className="divide-y divide-border -mx-2">
                  {fundraisers.map((f) => (
                    <li key={f.name} className="px-2 py-3.5 flex items-center gap-3">
                      <FundraiserAvatar name={f.name} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {f.name}
                        </p>
                        <p className="text-sm text-muted-foreground tabular-nums">
                          <span className="font-semibold text-foreground">
                            {formatCurrency(f.raised)}
                          </span>{" "}
                          raised of {formatCurrency(f.goal)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </ScrollReveal>

          <ScrollReveal delay={100}>
            <div className="card-warm p-6 sm:p-7 h-full">
              <h3 className="font-serif text-2xl text-foreground mb-5">
                Participating Businesses
              </h3>
              {donors.length === 0 ? (
                <EmptyList message="Confirmed business partners will appear here." />
              ) : (
                <ol className="divide-y divide-border -mx-2">
                  {donors.map((d, i) => (
                    <li key={`${d.name}-${i}`} className="px-2 py-3.5 flex items-center gap-3">
                      <DonorAvatar name={d.name} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {d.name}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          Supporting{" "}
                          <span className="text-primary font-medium">
                            {d.inSupportOf}
                          </span>
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
};
