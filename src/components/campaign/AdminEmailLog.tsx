"use client";

import { useCallback, useEffect, useState } from "react";
import { Mail, Lock, Loader2, RefreshCw } from "lucide-react";

import { fetchEmailLog, type EmailLogEntry } from "@/lib/api";
import { formatDateTimeUs } from "@/lib/date-only";

const STATUS_STYLE: Record<string, string> = {
  sent: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  skipped: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  failed: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  queued: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
};

const STATUS_OPTIONS = ["", "sent", "skipped", "failed", "queued"];
const ROLE_OPTIONS = ["", "nonprofit", "business", "ambassador", "supporter", "admin"];

function formatWhen(value: string): string {
  return formatDateTimeUs(value);
}

export function AdminEmailLog() {
  const [entries, setEntries] = useState<EmailLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [role, setRole] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchEmailLog({
        status: status || undefined,
        role: role || undefined,
        limit: 200,
      });
      setEntries(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load email log");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [status, role]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-rose-800 dark:bg-rose-950 dark:text-rose-300">
          <Lock className="size-3" />
          Admin Only — Hidden From Public Users
        </span>
      </div>

      <h1 className="mt-4 flex items-center gap-2 text-3xl font-extrabold tracking-tight">
        <Mail className="size-7 text-primary" />
        Email Log
      </h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Every email ForkUp attempted to send — invitations, acceptance
        confirmations, settlement notices, receipt updates, and Success Engine
        messages. <strong>skipped</strong> means SES is not configured, so the
        message was logged but not delivered.
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s || "All"}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          Role
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r || "All"}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-border bg-card px-4 text-xs font-semibold transition-colors hover:bg-secondary"
        >
          <RefreshCw className="size-3.5" />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : error ? (
        <p className="mt-6 text-sm text-destructive">{error}</p>
      ) : entries.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-border bg-background p-6 text-sm text-muted-foreground">
          No emails logged yet.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-secondary/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">When</th>
                <th className="px-4 py-3 font-semibold">Recipient</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Campaign</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-border align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {formatWhen(e.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="block font-medium">{e.recipientEmail}</span>
                    {e.stakeholderRole && (
                      <span className="text-xs text-muted-foreground">{e.stakeholderRole}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="block">{e.emailType}</span>
                    <span className="text-xs text-muted-foreground">{e.subject}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {e.campaignName ?? e.campaignSlug ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                        STATUS_STYLE[e.status] ?? STATUS_STYLE.queued
                      }`}
                    >
                      {e.status}
                    </span>
                    {e.errorMessage && (
                      <span className="mt-1 block text-xs text-destructive">{e.errorMessage}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
