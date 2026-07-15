import { ArrowDown, HeartHandshake, Rocket, Store } from "lucide-react";

/**
 * ⚠️ DESIGN MODE — ARCHITECTURE REVIEW ONLY.
 *
 * ForkUp V1 Architecture Map. A master visual map for Anand, Jonathan,
 * investors, and future developers showing the complete V1 system flow.
 *
 * ForkUp starts PUBLICLY with discovery — not with Profiles. The Public
 * Landing Page, Campaign Directory, and Public Campaign Page are the public
 * acquisition / discovery layer of ForkUp (not separate marketing pages).
 * From the Public Campaign Page, users branch into Support, Start, or Join.
 * This is NOT a production user screen — it exists purely so the full
 * lifecycle is visible in one place.
 */

type Node = { label: string; group: string };

type Phase = {
  title: string;
  group: string;
  nodes: string[];
};

const GROUP_COLOR: Record<string, string> = {
  Acquisition: "border-sky-300/50 bg-sky-50/60 dark:bg-sky-950/20",
  Profiles: "border-primary/40 bg-primary/5",
  Creation: "border-violet-300/50 bg-violet-50/60 dark:bg-violet-950/20",
  Live: "border-emerald-300/50 bg-emerald-50/60 dark:bg-emerald-950/20",
  Tracking: "border-orange-300/50 bg-orange-50/60 dark:bg-orange-950/20",
  Settlement: "border-rose-300/50 bg-rose-50/60 dark:bg-rose-950/20",
};

const PHASES: Phase[] = [
  {
    title: "Public Acquisition",
    group: "Acquisition",
    nodes: [
      "Public Landing Page",
      "Campaign Directory / Live Campaigns",
      "Public Campaign Page",
    ],
  },
  {
    title: "Profiles",
    group: "Profiles",
    nodes: ["Nonprofit Profile", "Business Profile"],
  },
  {
    title: "Campaign Creation",
    group: "Creation",
    nodes: [
      "Campaign Builder",
      "Business Invitations",
      "Business Acceptance",
      "Review & Launch",
    ],
  },
  {
    title: "Live Campaign",
    group: "Live",
    nodes: ["Public Campaign Page (Live)", "Campaign Dashboard", "Success Engine"],
  },
  {
    title: "Tracking",
    group: "Tracking",
    nodes: ["Receipt Upload", "OCR", "Eligible Sales", "Donation Pool"],
  },
  {
    title: "Reporting / Settlement",
    group: "Settlement",
    nodes: ["Reporting", "Settlement", "Repeat Campaigns"],
  },
];

const BRANCHES: { icon: typeof HeartHandshake; title: string; items: string[] }[] = [
  {
    icon: HeartHandshake,
    title: "Support a campaign",
    items: ["Donate", "Visit a participating business", "Upload receipt", "Share campaign"],
  },
  {
    icon: Rocket,
    title: "Start a campaign",
    items: ["Nonprofit Claim / Create Profile", "Campaign Builder"],
  },
  {
    icon: Store,
    title: "Join as a business",
    items: ["Business Claim / Create Profile", "Business Acceptance Flow"],
  },
];

function NodeCard({ label, group }: Node) {
  return (
    <div
      className={`w-full max-w-md rounded-xl border px-4 py-3 text-center ${GROUP_COLOR[group] ?? "border-border bg-card"}`}
    >
      <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {group}
      </span>
      <div className="text-sm font-semibold">{label}</div>
    </div>
  );
}

export function ArchitectureMap() {
  return (
    <main className="mx-auto max-w-4xl px-5 py-10 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-primary">
          Architecture Review Only — Not a Production Screen
        </span>
      </div>
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight">
        ForkUp V1 Architecture Map
      </h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        A master visual map of the complete V1 system flow — for Anand, Jonathan,
        investors, and future developers. ForkUp starts publicly with discovery:
        the Public Landing Page, Campaign Directory, and Public Campaign Page are
        the public acquisition layer, not separate marketing pages.
      </p>

      <section className="mt-8 flex flex-col items-center">
        {PHASES.map((phase, pi) => (
          <div key={phase.title} className="flex w-full flex-col items-center">
            <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {phase.title}
            </h2>

            {phase.nodes.map((label, ni) => (
              <div key={label} className="flex w-full flex-col items-center">
                <NodeCard label={label} group={phase.group} />
                {ni < phase.nodes.length - 1 && (
                  <ArrowDown className="my-1 size-4 text-muted-foreground" />
                )}
              </div>
            ))}

            {/* Branching actions available from the Public Campaign Page. */}
            {phase.group === "Acquisition" && (
              <div className="mt-4 w-full">
                <p className="mb-3 text-center text-xs font-semibold text-muted-foreground">
                  From the Public Campaign Page, users can:
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {BRANCHES.map(({ icon: Icon, title, items }) => (
                    <div
                      key={title}
                      className="rounded-xl border border-sky-300/50 bg-sky-50/40 p-4 dark:bg-sky-950/20"
                    >
                      <div className="flex items-center gap-2 text-sm font-bold">
                        <Icon className="size-4 text-primary" />
                        {title}
                      </div>
                      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {items.map((it) => (
                          <li key={it}>· {it}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pi < PHASES.length - 1 && (
              <ArrowDown className="my-3 size-5 text-muted-foreground" />
            )}
          </div>
        ))}
      </section>

      <p className="mt-10 text-center text-xs leading-relaxed text-muted-foreground">
        Public Landing Page → Campaign Directory → Public Campaign Page →
        Support / Claim / Create → Profiles → Campaign Builder → Business
        Invitations → Business Acceptance → Review & Launch → Public Campaign
        Page (Live) → Campaign Dashboard → Success Engine → Receipt Upload → OCR
        → Reporting → Settlement → Repeat Campaigns.
      </p>
    </main>
  );
}
