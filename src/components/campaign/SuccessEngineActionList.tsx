"use client";



import { useEffect, useMemo, useState } from "react";

import {

  Mail,

  MessageSquare,

  Share2,

  Check,

  Copy,

  Loader2,

  type LucideIcon,

} from "lucide-react";

import {

  fetchSuccessEngineActions,

  updateSuccessEngineAction,

  type SuccessEngineAction,

} from "@/lib/api";



const CHANNEL_ICON: Record<string, LucideIcon> = {

  email: Mail,

  text: MessageSquare,

  social: Share2,

};



const STATUS_STYLE: Record<string, { label: string; className: string }> = {

  scheduled: {

    label: "Scheduled",

    className: "bg-secondary text-secondary-foreground",

  },

  ready: {

    label: "Ready",

    className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",

  },

  completed: {

    label: "Completed",

    className: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",

  },

};



/** Stable default — never use `= []` inline or useEffect deps change every render. */

const EMPTY_EXCLUDE_TYPES: string[] = [];



const FETCH_TIMEOUT_MS = 30_000;



function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {

  return Promise.race([

    promise,

    new Promise<T>((_, reject) => {

      setTimeout(() => reject(new Error("Request timed out")), ms);

    }),

  ]);

}



function formatActionDate(d: string | null): string {

  if (!d) return "Anytime";

  const raw = d.includes("T") ? d : `${d}T00:00:00`;

  return new Date(raw).toLocaleDateString(undefined, {

    month: "short",

    day: "numeric",

    year: "numeric",

  });

}



function channelLabel(channel: string): string {

  if (channel === "email") return "Email Message";

  if (channel === "text") return "Text Message";

  if (channel === "social") return "Social Post";

  return channel;

}



function purposeLabel(actionType: string): string {

  const labels: Record<string, string> = {

    launch_email: "Launch reminder",

    one_week_reminder: "One week reminder",

    mid_campaign_reminder: "Mid-campaign reminder",

    final_push_reminder: "Final push",

    results_email: "Results summary",

    ambassador_recruitment: "Ambassador recruitment",

    guest_bartender_recruitment: "Guest bartender recruitment",

    business_promotion: "Business promotion",

    receipt_reminder: "Receipt reminder",

  };

  return labels[actionType] ?? actionType.replace(/_/g, " ");

}



export function SuccessEngineActionList({

  slug,

  excludeTypes = EMPTY_EXCLUDE_TYPES,

}: {

  slug: string;

  excludeTypes?: string[];

}) {

  const [actions, setActions] = useState<SuccessEngineAction[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [copiedId, setCopiedId] = useState<number | null>(null);

  const [previewIds, setPreviewIds] = useState<Record<number, boolean>>({});

  const [busyId, setBusyId] = useState<number | null>(null);



  const excludeKey = useMemo(() => excludeTypes.join("\0"), [excludeTypes]);



  useEffect(() => {

    let cancelled = false;

    setLoading(true);

    setError(null);



    void withTimeout(fetchSuccessEngineActions(slug), FETCH_TIMEOUT_MS)

      .then((rows) => {

        if (cancelled) return;

        const excluded = new Set(excludeTypes);

        setActions(rows.filter((a) => !excluded.has(a.actionType)));

      })

      .catch((err) => {

        if (cancelled) return;

        setError(err instanceof Error ? err.message : "Failed to load actions");

        setActions([]);

      })

      .finally(() => {

        if (!cancelled) setLoading(false);

      });



    return () => {

      cancelled = true;

    };

  }, [slug, excludeKey]);



  const copyContent = async (id: number, text: string) => {

    await navigator.clipboard.writeText(text);

    setCopiedId(id);

    setTimeout(() => setCopiedId(null), 2000);

  };



  const markComplete = async (id: number) => {

    setBusyId(id);

    try {

      await updateSuccessEngineAction(id, { status: "completed" });

      const rows = await withTimeout(fetchSuccessEngineActions(slug), FETCH_TIMEOUT_MS);

      const excluded = new Set(excludeTypes);

      setActions(rows.filter((a) => !excluded.has(a.actionType)));

      setError(null);

    } catch (err) {

      setError(err instanceof Error ? err.message : "Failed to update");

    } finally {

      setBusyId(null);

    }

  };



  if (loading) {

    return (

      <div className="flex justify-center py-8">

        <Loader2 className="size-6 animate-spin text-primary" />

      </div>

    );

  }



  if (error) {

    return <p className="text-sm text-destructive">{error}</p>;

  }



  if (actions.length === 0) {

    return (

      <p className="rounded-2xl border border-dashed border-border bg-background p-6 text-sm text-muted-foreground">

        No Success Engine actions yet. They are created when you launch a campaign or when seed data

        includes them for live campaigns.

      </p>

    );

  }



  return (

    <ul className="space-y-3">

      {actions.map((action) => {

        const Icon = CHANNEL_ICON[action.channel] ?? Mail;

        const pill = STATUS_STYLE[action.status] ?? STATUS_STYLE.scheduled;

        const isPreview = previewIds[action.id];

        const copied = copiedId === action.id;

        const busy = busyId === action.id;



        return (

          <li key={action.id} className="rounded-2xl border border-border bg-background p-4">

            <div className="flex flex-wrap items-start justify-between gap-2">

              <span className="flex items-center gap-2.5 text-sm font-semibold">

                <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">

                  <Icon className="size-4" />

                </span>

                <span>

                  <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">

                    {formatActionDate(action.scheduledDate)}

                  </span>

                  {action.title || channelLabel(action.channel)}

                </span>

              </span>

              <span

                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${pill.className}`}

              >

                {pill.label}

              </span>

            </div>

            <p className="mt-2 text-sm text-muted-foreground">{purposeLabel(action.actionType)}</p>

            {isPreview && (

              <div className="mt-3 rounded-xl border border-border bg-card p-3">

                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">

                  {channelLabel(action.channel)} copy

                </p>

                <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{action.content}</p>

              </div>

            )}

            <div className="mt-3 flex flex-wrap gap-2">

              <button

                type="button"

                onClick={() => setPreviewIds((p) => ({ ...p, [action.id]: !p[action.id] }))}

                className="inline-flex h-9 items-center justify-center rounded-full border border-border bg-card px-4 text-xs font-semibold transition-colors hover:bg-secondary"

              >

                {isPreview ? "Hide" : "Preview"}

              </button>

              <button

                type="button"

                onClick={() => void copyContent(action.id, action.content)}

                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-border bg-card px-4 text-xs font-semibold transition-colors hover:bg-secondary"

              >

                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}

                {copied ? "Copied" : "Copy"}

              </button>

              {action.status !== "completed" && (

                <button

                  type="button"

                  disabled={busy}

                  onClick={() => void markComplete(action.id)}

                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-border bg-card px-4 text-xs font-semibold transition-colors hover:bg-secondary disabled:opacity-60"

                >

                  {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}

                  Mark complete

                </button>

              )}

            </div>

          </li>

        );

      })}

    </ul>

  );

}


