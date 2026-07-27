import { Check, Store, Heart, Trophy, Wine, ArrowRight, ArrowLeft } from "lucide-react";
import { assetSrc } from "@/lib/utils";
import { useCampaign, type SupportMethod } from "@/lib/campaign-context";
import forkupLogo from "@/assets/forkup-logo.png";
import { useLovableFlowRedirect } from "./useLovableFlowRedirect";

const OPTIONS: {
  id: SupportMethod;
  icon: typeof Store;
  title: string;
  mainLine: string;
  description: string;
  examples: string[];
  insight: string;
}[] = [
  {
    id: "giveback",
    icon: Store,
    title: "Dine & Donate / Local Giveback",
    mainLine: "Turn everyday spending into support for your cause.",
    description:
      "Invite restaurants, shops, salons, fitness studios, and other local businesses to donate a percentage of sales during your campaign.",
    examples: [
      "Dine & Donate",
      "Shop & Donate",
      "Service Givebacks",
      "Restaurant Nights",
      "Community Fundraising",
    ],
    insight: "One campaign. Multiple businesses. More impact.",
  },
  {
    id: "donations",
    icon: Heart,
    title: "Online Donations",
    mainLine: "Make it easy for anyone to support your cause.",
    description:
      "Let supporters donate online if they can’t participate in person.",
    examples: ["Friends & Family", "Out-of-Town Supporters", "Online Giving"],
    insight: "Perfect for friends, family, and supporters outside the area.",
  },
  {
    id: "guestBartending",
    icon: Wine,
    title: "Guest Bartending Event",
    mainLine: "Host an in-person event with built-in fundraising links.",
    description:
      "Choose guest bartenders who will promote the event, bring people out, collect virtual tips, and drive donations through their own links.",
    examples: ["Guest Bartending", "Tip Jar Fundraising", "Restaurant Events"],
    insight:
      "Each guest bartender gets a link and QR code so ForkUp can track the support they help generate.",
  },
  {
    id: "ambassador",
    icon: Trophy,
    title: "Ambassador Fundraising",
    mainLine: "Activate supporters to share your campaign online.",
    description:
      "Choose ambassadors who will send personal campaign links to friends, family, and their networks.",
    examples: ["Board Members", "Parents", "Volunteers"],
    insight:
      "Ambassadors help expand your reach without needing a specific event.",
  },
];

export function ChooseMethods() {
  useLovableFlowRedirect();
  const { state, toggleMethod, hasAnyMethod, next, goTo, designMode } = useCampaign();

  return (
    <>
      <main className="mx-auto flex min-h-[calc(100svh-8.5rem)] max-w-6xl flex-col px-5 py-3 pb-28 sm:px-6">
        <div className="animate-rise mb-1.5 text-center">
          <h1 className="font-display text-balance text-2xl font-bold leading-[1.05] tracking-tight sm:text-3xl">
            Choose your fundraising methods.
          </h1>
          <p className="mx-auto mt-1.5 max-w-[58ch] text-pretty text-sm leading-snug text-muted-foreground">
            Choose the fundraising methods that will help your campaign raise money — select one or more to reach more supporters.
          </p>
        </div>

        <p className="animate-rise mb-2 text-center text-xs font-medium leading-snug text-primary">
          Mix and match fundraising methods to create one community-powered campaign.
        </p>


        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {OPTIONS.map((o, i) => {
            const selected = state.methods[o.id];
            const Icon = o.icon;
            return (
              <button
                key={o.id}
                onClick={() => toggleMethod(o.id)}
                style={{ animationDelay: `${i * 60}ms` }}
                className={`animate-rise group relative flex flex-col rounded-2xl p-3.5 text-left transition-all hover:-translate-y-0.5 ${
                  selected
                    ? "border-2 border-primary bg-accent/40 shadow-md shadow-primary/10"
                    : "border border-border bg-card hover:border-primary/40"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex size-10 items-center justify-center rounded-xl transition-colors ${
                      selected ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"
                    }`}
                  >
                    <Icon className="size-5" />
                  </div>
                  <div
                    className={`ml-auto flex size-6 shrink-0 items-center justify-center rounded-full transition-all ${
                      selected ? "bg-primary" : "border border-border bg-card"
                    }`}
                  >
                    {selected && (
                      <Check className="size-3.5 text-primary-foreground animate-pop" strokeWidth={3} />
                    )}
                  </div>
                </div>

                <h3 className="font-display mt-2 min-h-[3rem] text-base font-semibold leading-tight tracking-tight">{o.title}</h3>
                <p className="mt-1 min-h-[2rem] text-sm font-semibold leading-tight text-primary">{o.mainLine}</p>
                <p className="mt-1 min-h-[2.75rem] text-xs leading-snug text-muted-foreground">{o.description}</p>

                <p className="mt-2.5 text-[11px] font-semibold uppercase tracking-wide text-foreground/60">
                  Great For
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {o.examples.map((e) => (
                    <span
                      key={e}
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                        selected
                          ? "bg-primary/15 text-primary"
                          : "bg-secondary/70 text-muted-foreground"
                      }`}
                    >
                      {e}
                    </span>
                  ))}
                </div>

                <p className="mt-2.5 border-t border-border/60 pt-2 text-[11px] font-medium leading-snug text-foreground/80">
                  {o.insight}
                </p>
              </button>
            );
          })}
        </div>

        <div className="mt-auto flex justify-center pt-2">
          <button
            type="button"
            onClick={() => goTo("website-landing")}
            className="rounded-lg opacity-80 transition-opacity hover:opacity-100"
            aria-label="ForkUp home"
          >
            <img
              src={assetSrc(forkupLogo)}
              alt="ForkUp"
              width={96}
              height={100}
              className="h-20 w-auto object-contain"
            />
          </button>
        </div>
      </main>


      <footer className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4 sm:px-6">
          <button
            onClick={() => goTo("start")}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back
          </button>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {hasAnyMethod ? "" : "Choose at least one way to continue."}
            </span>
            <button
              onClick={next}
              disabled={!hasAnyMethod && !designMode}

              className="inline-flex items-center gap-2 rounded-full bg-primary py-2.5 pl-5 pr-4 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-dark active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-primary"
            >
              Continue
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      </footer>
    </>
  );
}
