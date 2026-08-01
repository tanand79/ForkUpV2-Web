"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Mail, Sparkles, Send, Loader2, Zap, Clock } from "lucide-react";
import { toast } from "sonner";
import { useCampaign } from "@/lib/campaign-context";
import {
  fetchCampaignAutomation,
  postCampaignAiGenerateCalendar,
  runDueSuccessEngineActions,
  type CampaignAutomation,
} from "@/lib/api";
import { SuccessEngineActionList } from "./SuccessEngineActionList";
import { CampaignAiGuidance } from "./CampaignAiGuidance";

function formatDay(d: string | null): string {
  if (!d) return "Anytime";
  return looksLikeIsoDateTime(d) ? formatDateTimeUs(d) : formatDateUs(d);
}

function formatDateTime(d: string): string {
  return formatDateTimeUs(d);
}

export function SuccessEngine() {
  const { state, goTo } = useCampaign();
  const slug = state.campaignSlug;
  const [runningDue, setRunningDue] = useState(false);
  const [generatingCalendar, setGeneratingCalendar] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [automation, setAutomation] = useState<CampaignAutomation | null>(null);

  const loadAutomation = useCallback(async () => {
    if (!slug) return;
    try {
      setAutomation(await fetchCampaignAutomation(slug));
    } catch {
      // Non-critical panel — leave it hidden if it fails to load.
    }
  }, [slug]);

  useEffect(() => {
    void loadAutomation();
  }, [loadAutomation, refreshKey]);

  const runDue = async () => {
    setRunningDue(true);
    try {
      const result = await runDueSuccessEngineActions();
      if (result.totalSent > 0) {
        toast.success(
          `Sent ${result.totalSent} email${result.totalSent === 1 ? "" : "s"} across ${result.processed} due action${result.processed === 1 ? "" : "s"}.`,
        );
      } else if (result.processed > 0) {
        toast.info(`${result.processed} due action(s) processed, but no recipients were found.`);
      } else {
        toast.info("No due actions to send right now.");
      }
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to run due actions");
    } finally {
      setRunningDue(false);
    }
  };

  /** Nick V2 Layer 4 — rule-based 60→0 calendar; skips business promo until accepted. */
  const generateAiCalendar = async () => {
    if (!slug) return;
    setGeneratingCalendar(true);
    try {
      const result = await postCampaignAiGenerateCalendar(slug);
      toast.success(
        result.message ||
          `Created ${result.created} new Success Engine action${result.created === 1 ? "" : "s"}.`,
      );
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate calendar");
    } finally {
      setGeneratingCalendar(false);
    }
  };

  if (!slug) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-12 text-center">
        <p className="text-muted-foreground">
          Launch a campaign first to view your Success Engine schedule.
        </p>
        <button
          type="button"
          onClick={() => goTo("dashboard")}
          className="btn-primary mt-4 rounded-full px-6 py-3 text-sm font-semibold"
        >
          Go to dashboard
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-5 py-10 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-primary">
          Campaign Management
        </span>
      </div>
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Success Engine</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        ForkUp prepares supporter emails, reminders, and promotion copy after your business roster is
        set. Preview, copy, and mark each action complete when you send it.
      </p>

      <div className="mt-8">
        <CampaignAiGuidance />
      </div>

      <section className="mt-8 rounded-3xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-bold">
              <CalendarClock className="size-4 text-primary" />
              Scheduled campaign actions
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Loaded from your campaign&apos;s Success Engine plan.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={generatingCalendar}
              onClick={() => void generateAiCalendar()}
              title="Build a rule-based Success Engine calendar from campaign dates. Business promo steps wait until a partner accepts."
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-border bg-card px-4 text-xs font-semibold transition-colors hover:bg-secondary disabled:opacity-60"
            >
              {generatingCalendar ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              {generatingCalendar ? "Generating…" : "Generate AI calendar"}
            </button>
            <button
              type="button"
              disabled={runningDue}
              onClick={() => void runDue()}
              title="Send every email action that is marked ready and scheduled for today or earlier (across all campaigns)."
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-border bg-card px-4 text-xs font-semibold transition-colors hover:bg-secondary disabled:opacity-60"
            >
              {runningDue ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
              {runningDue ? "Running…" : "Run due actions now"}
            </button>
          </div>
        </div>
        <div className="mt-4">
          <SuccessEngineActionList key={refreshKey} slug={slug} />
        </div>
        <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Mail className="size-3.5" />
          Organizer reminders are sent by email when scheduled actions are ready.
        </p>
      </section>

      {automation && (automation.automatedActions.length > 0 || automation.lastRun) && (
        <section className="mt-8 rounded-3xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="flex items-center gap-2 font-bold">
              <Zap className="size-4 text-primary" />
              Automated sending
            </h2>
            {automation.lastRun && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="size-3.5" />
                Last run {formatDateTime(automation.lastRun.ranAt)} · {automation.lastRun.emailsSent}{" "}
                sent
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Actions flagged to automate are sent by a scheduled job once they&apos;re ready and their
            date arrives — no manual click needed.
          </p>

          {automation.automatedActions.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
              No actions are set to automate yet. Turn on &ldquo;Automate&rdquo; on any email action
              above to schedule it.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {automation.automatedActions.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-background p-3 text-sm"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <CalendarClock className="size-4 text-muted-foreground" />
                    {a.title}
                    <span className="text-xs text-muted-foreground">{formatDay(a.scheduledDate)}</span>
                  </span>
                  <span className="text-xs font-semibold">
                    {a.status === "completed" ? (
                      <span className="text-green-600 dark:text-green-400">
                        Sent{a.sentAt ? ` · ${formatDay(a.sentAt)}` : ""}
                      </span>
                    ) : a.lastError ? (
                      <span className="text-destructive">Needs attention</span>
                    ) : a.isDue ? (
                      <span className="text-amber-600 dark:text-amber-400">Due — next run</span>
                    ) : (
                      <span className="text-muted-foreground">Scheduled</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="mt-8 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
        <p className="flex items-center gap-2 font-semibold text-foreground">
          <Sparkles className="size-4 text-primary" />
          Activation dependency
        </p>
        <p className="mt-2">
          Actions are generated at campaign launch. Content references your confirmed participating
          businesses once the invitation window closes.
        </p>
      </section>
    </main>
  );
}
