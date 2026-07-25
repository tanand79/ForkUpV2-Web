import { useEffect, useRef, useState } from "react";
import {
  Calendar,
  MapPin,
  Percent,
  Rocket,
  Store,
  Pencil,
  Heart,
  ImageIcon,
  Sparkles,
  Clock,
  CheckCircle2,
  Circle,
  ArrowRight,
  Eye,
  Loader2,
} from "lucide-react";
import { useCampaign, SUPPORT_METHOD_META, type SupportMethod } from "@/lib/campaign-context";
import { createCampaign, updateCampaign } from "@/lib/api";
import { buildCreateCampaignPayload } from "@/lib/builder-submit";

function formatDate(d: string) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const PREP_STEPS = [
  "Saving campaign",
  "Creating campaign page",
  "Preparing invitations",
  "Building your Success Toolkit",
];

export function ReviewLaunch() {
  const {
    state,
    selectedBusinesses,
    goTo,
    launchCampaign,
    update,
    discardLocalDraft,
    requiredRemaining,
  } = useCampaign();
  const activeMethods = (Object.keys(state.methods) as SupportMethod[]).filter((m) => state.methods[m]);
  const willActivateLater = state.methods.guestBartending || state.methods.ambassador;
  const termsAccepted = state.termsAccepted;

  const invitedBusinesses = selectedBusinesses;
  const hasStory = !!state.description;
  const hasDates = !!state.startDate && !!state.endDate;
  const hasLogo = !!state.logo;
  const hasCover = !!state.cover;
  // Lovable: featured image is required for launch readiness; logo is optional.
  const hasAssets = hasCover;
  const businessesRequired = state.methods.giveback || state.methods.guestBartending;
  const hasBusinesses =
    invitedBusinesses.length > 0 || (state.lockedBusinessPartners?.length ?? 0) > 0;

  const canLaunch = requiredRemaining === 0 && termsAccepted;
  // Informational only — never gates launch.
  const verificationPending =
    state.nonprofitProfile?.verificationStatus === "needs_review";

  // ── Launch preparation animation ──────────────────────────────────────────
  const [launching, setLaunching] = useState(false);
  const [prepDone, setPrepDone] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const [launchError, setLaunchError] = useState<string | null>(null);

  const handleLaunch = async () => {
    if (!canLaunch) return;
    if (!state.nonprofitProfile) {
      goTo("nonprofit-claim");
      return;
    }

    setLaunching(true);
    setLaunchError(null);
    setPrepDone(0);

    PREP_STEPS.forEach((_, i) => {
      timers.current.push(setTimeout(() => setPrepDone(i + 1), 700 * (i + 1)));
    });

    try {
      const payload = buildCreateCampaignPayload(
        state,
        state.nonprofitProfile,
        selectedBusinesses,
        { launch: true },
      );
      const result = state.campaignSlug
        ? await updateCampaign(state.campaignSlug, payload)
        : await createCampaign(payload);
      update({
        campaignSlug: result.slug,
        invited: state.invited.map((b) => ({ ...b, persisted: true })),
      });
      discardLocalDraft({ force: true });
      timers.current.push(
        setTimeout(() => {
          launchCampaign();
        }, 700 * (PREP_STEPS.length + 1)),
      );
    } catch (err) {
      setLaunching(false);
      setPrepDone(0);
      setLaunchError(err instanceof Error ? err.message : "Failed to launch campaign");
    }
  };




  if (launching) {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col items-center justify-center px-5 py-12 text-center">
        <div className="animate-pop flex size-16 items-center justify-center rounded-full bg-primary/10">
          <Loader2 className="size-7 animate-spin text-primary" />
        </div>
        <h1 className="mt-6 text-2xl font-bold tracking-tight">Preparing your campaign&hellip;</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Hang tight — ForkUp is getting everything ready to go live.
        </p>
        <ul className="mt-8 w-full space-y-3 text-left">
          {PREP_STEPS.map((label, i) => {
            const done = i < prepDone;
            const active = i === prepDone;
            return (
              <li
                key={label}
                className={`flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-opacity duration-300 ${
                  done || active ? "opacity-100" : "opacity-50"
                }`}
              >
                {done ? (
                  <CheckCircle2 className="size-5 shrink-0 text-primary" />
                ) : active ? (
                  <Loader2 className="size-5 shrink-0 animate-spin text-primary" />
                ) : (
                  <Circle className="size-5 shrink-0 text-muted-foreground/40" />
                )}
                <span className={`text-sm ${done ? "font-medium" : "text-muted-foreground"}`}>{label}</span>
              </li>
            );
          })}
        </ul>
      </main>
    );
  }

  return (
    <>
      <main className="mx-auto max-w-3xl px-5 py-10 pb-48 sm:px-6 sm:py-12">
        <div className="animate-rise mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Review &amp; Launch</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
            You&rsquo;re about to launch something meaningful.
          </h1>
          <p className="mt-3 text-pretty text-muted-foreground">
            Take one final look before your campaign goes live. Once launched, ForkUp will help you
            invite supporters, engage local businesses, and build momentum around your cause.
          </p>
        </div>

        {/* Campaign Preview — what supporters will see */}
        <div className="animate-rise mb-6 [animation-delay:45ms]">
          <div className="mb-3 flex items-center gap-2">
            <Eye className="size-4 text-primary" />
            <p className="text-sm font-semibold">Campaign Preview</p>
          </div>
          <p className="mb-3 text-sm text-muted-foreground">
            This is what supporters will see when your campaign goes live.
          </p>

          <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
            {/* Featured photo */}
            {hasCover ? (
              <div className="aspect-[16/9] overflow-hidden bg-secondary">
                <img src={state.cover!.url} alt="Featured campaign photo" className="size-full object-cover" />
              </div>
            ) : (
              <PreviewPrompt
                label="Add a featured campaign photo"
                onClick={() => goTo("campaign-review")}
                className="aspect-[16/9] rounded-none border-0 border-b"
              />
            )}

            <div className="p-5 sm:p-6">
              {/* Logo + title */}
              <div className="flex items-center gap-3">
                {hasLogo ? (
                  <img
                    src={state.logo!.url}
                    alt="Organization logo"
                    className="size-12 shrink-0 rounded-xl border border-border object-cover"
                  />
                ) : (
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-dashed border-border text-muted-foreground">
                    <ImageIcon className="size-5" />
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-bold">{state.title || "Untitled campaign"}</h3>
                  {hasDates ? (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="size-3" />
                      {formatDate(state.startDate)} → {formatDate(state.endDate)}
                    </p>
                  ) : (
                    <button
                      onClick={() => goTo("campaign-review")}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Add your campaign dates →
                    </button>
                  )}
                </div>
                {state.methods.giveback && (
                  <span className="ml-auto shrink-0 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
                    {state.giveback}% giveback
                  </span>
                )}
              </div>

              {/* Story */}
              {hasStory ? (
                <p className="mt-4 text-pretty text-sm text-muted-foreground">{state.description}</p>
              ) : (
                <PreviewPrompt label="Add your campaign story" onClick={() => goTo("campaign-review")} className="mt-4" />
              )}

              {/* Support methods */}
              {activeMethods.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {activeMethods.map((m) => (
                    <span
                      key={m}
                      className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground"
                    >
                      {SUPPORT_METHOD_META[m].title}
                    </span>
                  ))}
                </div>
              )}

              {/* Businesses */}
              {businessesRequired && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Participating businesses
                  </p>
                  {hasBusinesses ? (
                    <div className="flex flex-wrap gap-2">
                      {invitedBusinesses.map((b) => (
                        <span
                          key={b.id}
                          className="inline-flex items-center gap-2 rounded-full border border-border py-1 pl-1 pr-3 text-xs font-medium"
                        >
                          <img src={b.image} alt={b.name} className="size-6 rounded-full object-cover" />
                          {b.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <PreviewPrompt label="Invite at least one business" onClick={() => goTo("businesses")} />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Open the full canonical Public Campaign Page supporters will see. */}
        <button
          onClick={() => goTo("campaign-page")}
          className="animate-rise mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-sm font-semibold transition-colors hover:bg-secondary [animation-delay:50ms]"
        >
          <Eye className="size-4 text-primary" />
          View full public campaign page
        </button>


        <div className="animate-rise overflow-hidden rounded-3xl border border-border bg-card shadow-sm [animation-delay:60ms]">
          <div className="space-y-6 p-6 sm:p-8">
            {/* Your Cause */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Your Cause
              </p>
              <h2 className="mt-1 text-2xl font-bold">{state.title || "Untitled campaign"}</h2>
              {hasStory ? (
                <p className="mt-2 text-pretty text-sm text-muted-foreground">{state.description}</p>
              ) : (
                <MissingItem
                  lines={[
                    "Your campaign story hasn\u2019t been added yet.",
                    "Tell supporters why this matters and how they can make a difference.",
                  ]}
                  action="Add Story"
                  onClick={() => goTo("campaign-review")}
                />
              )}
            </div>

            {/* How supporters can help */}
            <div>
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Heart className="size-4 text-primary" />
                How supporters can help
              </p>
              <div className="flex flex-wrap gap-2">
                {activeMethods.map((m) => (
                  <span
                    key={m}
                    className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground"
                  >
                    {SUPPORT_METHOD_META[m].title}
                  </span>
                ))}
              </div>
            </div>

            {/* Dates + Giveback */}
            <div className="grid gap-4 sm:grid-cols-2">
              <SummaryRow icon={<Calendar className="size-4" />} label="Campaign Dates" complete={hasDates}>
                {hasDates ? (
                  `${formatDate(state.startDate)} → ${formatDate(state.endDate)}`
                ) : (
                  <MissingItem lines={["Campaign dates needed before launch."]} action="Add Dates" onClick={() => goTo("campaign-review")} compact />
                )}
              </SummaryRow>
              {state.methods.giveback && (
                <SummaryRow icon={<Percent className="size-4" />} label="Giveback" complete>
                  {state.giveback}%
                </SummaryRow>
              )}
            </div>

            {/* Invited Businesses */}
            {businessesRequired && (
              <div>
                <p className="mb-1 flex items-center gap-2 text-sm font-semibold">
                  <Store className="size-4 text-primary" />
                  Invited Businesses
                </p>
                <p className="mb-3 text-xs text-muted-foreground">
                  {state.campaignOrigin === "business_invite"
                    ? "Your business partner is already confirmed for this campaign."
                    : "These businesses will receive your campaign invitation after launch. Businesses can accept their invitation and complete their profile after launch."}
                </p>
                {hasBusinesses ? (
                  <div className="space-y-2">
                    {invitedBusinesses.map((b) => (
                      <div key={b.id} className="flex items-center gap-3 rounded-xl border border-border p-2.5">
                        <img src={b.image} alt={b.name} className="size-11 rounded-lg object-cover" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{b.name}</p>
                          <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="size-3" />
                            {b.location}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : state.campaignOrigin === "business_invite" ? null : (
                  <MissingItem lines={["No businesses added yet."]} action="Invite Businesses" onClick={() => goTo("businesses")} />
                )}
              </div>
            )}

            {/* Campaign Assets */}
            <div>
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <ImageIcon className="size-4 text-primary" />
                Campaign Assets
              </p>
              {hasAssets ? (
                <div className="flex items-center gap-3">
                  {state.logo && (
                    <img
                      src={state.logo.url}
                      alt="Campaign logo"
                      className="size-14 rounded-xl border border-border object-cover"
                    />
                  )}
                  {state.cover && (
                    <img
                      src={state.cover.url}
                      alt="Featured photo"
                      className="h-14 flex-1 rounded-xl border border-border object-cover"
                    />
                  )}
                </div>
              ) : (
                <MissingItem lines={["Add a featured campaign photo before launch."]} action="Add Assets" onClick={() => goTo("campaign-review")} />
              )}
            </div>
          </div>
        </div>

        {willActivateLater && (
          <div className="animate-rise mt-6 rounded-2xl border border-primary/30 bg-primary/5 p-5 [animation-delay:120ms]">
            <div className="flex items-start gap-2.5">
              <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-semibold">
                  You can launch now — people get added after you go live.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {state.methods.guestBartending && state.methods.ambassador
                    ? "After launch, your Campaign Success Dashboard will guide you through adding guest bartenders and ambassadors at the right time."
                    : state.methods.guestBartending
                      ? "After launch, your Campaign Success Dashboard will help you add guest bartenders and send them their links and QR codes."
                      : "After launch, your Campaign Success Dashboard will help you add ambassadors and send them their personal share links."}
                </p>
              </div>
            </div>
          </div>
        )}

        {verificationPending && (
          <div className="animate-rise mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/40 [animation-delay:140ms]">
            <div className="flex items-start gap-2.5">
              <Clock className="mt-0.5 size-5 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  Your organization&rsquo;s verification is pending.
                </p>
                <p className="mt-1 text-sm text-amber-800 dark:text-amber-300/90">
                  You can launch now — a ForkUp team member is reviewing your
                  organization. Verification may be required before settlement and
                  payouts can be finalized.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Ready to launch — final confirmation */}
        <div className="animate-rise mt-6 rounded-2xl border border-border bg-card p-5 [animation-delay:150ms] sm:p-6">
          <h2 className="text-lg font-bold tracking-tight">Ready to launch?</h2>
          <p className="mt-2 text-pretty text-sm text-muted-foreground">
            I&rsquo;ve reviewed my campaign and I&rsquo;m ready for ForkUp to begin preparing invitations,
            campaign materials, and supporter outreach.
          </p>
          <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-secondary/30 p-4">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => update({ termsAccepted: e.target.checked })}
              className="size-5 shrink-0 cursor-pointer rounded border-border accent-primary"
            />
            <span className="text-sm font-semibold">I&rsquo;m ready to launch this campaign.</span>
          </label>
          {launchError && (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {launchError}
            </p>
          )}
        </div>
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-4 sm:px-6">
          <button
            onClick={() => goTo("campaign-review")}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
          >
            <Pencil className="size-4" />
            Edit Campaign
          </button>
          <div className="flex items-center gap-3">
            <span className="hidden max-w-[16rem] text-xs text-muted-foreground sm:inline">
              {canLaunch
                ? "Your campaign is ready to launch."
                : "Almost there. Complete the remaining items above and we\u2019ll prepare your campaign for launch."}
            </span>
            <button
              onClick={handleLaunch}
              disabled={!canLaunch}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary-dark active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-primary"
            >
              <Rocket className="size-4" />
              Launch Campaign
            </button>
          </div>
        </div>
      </footer>
    </>
  );
}

function PreviewPrompt({
  label,
  onClick,
  className = "",
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-secondary/30 p-4 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground ${className}`}
    >
      {label}
      <ArrowRight className="size-3.5" />
    </button>
  );
}

function MissingItem({
  lines,
  action,
  onClick,
  compact = false,
}: {
  lines: string[];
  action: string;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "" : "rounded-xl border border-dashed border-border p-4"}>
      <div className="text-sm text-muted-foreground">
        {lines.map((l) => (
          <p key={l} className="text-pretty first:mt-0 [&:not(:first-child)]:mt-1">
            {l}
          </p>
        ))}
      </div>
      <button
        onClick={onClick}
        className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
      >
        {action}
        <ArrowRight className="size-3.5" />
      </button>
    </div>
  );
}

function SummaryRow({
  icon,
  label,
  children,
  complete = true,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  complete?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {label}
      </p>
      <div className={`mt-1.5 text-sm font-semibold ${complete ? "" : "font-medium"}`}>{children}</div>
    </div>
  );
}
