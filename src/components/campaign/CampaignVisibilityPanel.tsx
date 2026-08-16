/**
 * Nick V2 Layer 6 — Campaign visibility panel.
 *
 * Purpose: Show ready / pending / ForkUp review / business action / next SE action.
 * Inputs: visibility object from GET /api/manage/campaigns/:slug (or compact summary props).
 * Outputs: UI only.
 */
"use client";

import { AlertTriangle, CheckCircle2, Clock3, Sparkles, Store } from "lucide-react";
import type { CampaignVisibility } from "@/lib/api";

type Props = {
  visibility: CampaignVisibility;
  /** Compact mode for nonprofit list cards. */
  compact?: boolean;
  onOpenSuccessEngine?: () => void;
};

function SignalList({
  title,
  icon,
  items,
  tone,
}: {
  title: string;
  icon: React.ReactNode;
  items: string[];
  tone: "good" | "warn" | "muted" | "danger";
}) {
  if (items.length === 0) return null;
  const toneClass =
    tone === "good"
      ? "border-emerald-300/50 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30"
      : tone === "warn"
        ? "border-amber-300/50 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/30"
        : tone === "danger"
          ? "border-rose-300/50 bg-rose-50/70 dark:border-rose-900 dark:bg-rose-950/30"
          : "border-border bg-background";
  return (
    <div className={`rounded-2xl border p-3 ${toneClass}`}>
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide">
        {icon}
        {title}
      </p>
      <ul className="mt-2 space-y-1 text-sm">
        {items.slice(0, 6).map((item) => (
          <li key={item}>{item}</li>
        ))}
        {items.length > 6 && (
          <li className="text-xs text-muted-foreground">+{items.length - 6} more</li>
        )}
      </ul>
    </div>
  );
}

export function CampaignVisibilityPanel({
  visibility,
  compact = false,
  onOpenSuccessEngine,
}: Props) {
  const next = visibility.nextSuccessEngineAction;

  if (compact) {
    return (
      <div className="mt-2 flex flex-wrap gap-1.5">
        {visibility.tracks.slice(0, 4).map((t) => (
          <span
            key={t.id}
            className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
          >
            {t.label}: {t.display}
          </span>
        ))}
        {visibility.needsForkupReview.length > 0 && (
          <span className="rounded-full border border-amber-300/70 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            Needs ForkUp Review
          </span>
        )}
      </div>
    );
  }

  return (
    <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">Campaign visibility</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            What is ready, pending, needs ForkUp review, needs business action, and what Success
            Engine recommends next.
          </p>
        </div>
      </div>

      {visibility.tracks.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {visibility.tracks.map((t) => (
            <span
              key={t.id}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                t.status === "ready"
                  ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                  : t.status === "needs_forkup_review" ||
                      t.status === "tight_timeline"
                    ? "bg-orange-100 text-orange-950 dark:bg-orange-950 dark:text-orange-200"
                    : t.status === "too_soon"
                      ? "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200"
                      : t.status === "limited_promotion_window"
                        ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                        : "bg-secondary text-foreground"
              }`}
            >
              {t.label}: {t.display}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <SignalList
          title="Ready"
          icon={<CheckCircle2 className="size-3.5" />}
          items={visibility.ready}
          tone="good"
        />
        <SignalList
          title="Pending"
          icon={<Clock3 className="size-3.5" />}
          items={visibility.pending}
          tone="muted"
        />
        <SignalList
          title="Needs ForkUp review"
          icon={<AlertTriangle className="size-3.5" />}
          items={visibility.needsForkupReview}
          tone="warn"
        />
        <SignalList
          title="Needs business action"
          icon={<Store className="size-3.5" />}
          items={visibility.needsBusinessAction}
          tone="danger"
        />
      </div>

      {next && (
        <div className="mt-4 rounded-2xl border border-border bg-background p-4">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary">
            <Sparkles className="size-3.5" />
            Success Engine next
          </p>
          <p className="mt-1 text-sm font-semibold">{next.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {next.actionType}
            {next.scheduledDate ? ` · ${next.scheduledDate}` : ""}
          </p>
          {onOpenSuccessEngine && (
            <button
              type="button"
              onClick={onOpenSuccessEngine}
              className="mt-3 text-xs font-semibold text-primary underline-offset-2 hover:underline"
            >
              Open Success Engine
            </button>
          )}
        </div>
      )}
    </section>
  );
}
