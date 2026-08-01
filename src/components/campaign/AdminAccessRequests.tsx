"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, Lock, Loader2, RefreshCw, Check, X } from "lucide-react";
import { toast } from "sonner";

import {
  fetchAccessRequests,
  approveAccessRequest,
  denyAccessRequest,
  type AccessRequest,
} from "@/lib/api";
import { formatDateTimeUs } from "@/lib/date-only";

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  denied: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
};

const RISK_STYLE: Record<string, string> = {
  low: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  high: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
};

const STATUS_OPTIONS = ["", "pending", "approved", "denied"];
const RISK_OPTIONS = ["", "low", "medium", "high"];
const ORG_TYPE_OPTIONS = ["", "nonprofit", "business"];

function formatWhen(value: string | null): string {
  return formatDateTimeUs(value);
}

export function AdminAccessRequests() {
  const [entries, setEntries] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("pending");
  const [riskLevel, setRiskLevel] = useState("");
  const [organizationType, setOrganizationType] = useState("");
  const [actingId, setActingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchAccessRequests({
        status: status || undefined,
        riskLevel: riskLevel || undefined,
        organizationType: organizationType || undefined,
        limit: 200,
      });
      setEntries(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load access requests");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [status, riskLevel, organizationType]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (id: number, action: "approve" | "deny") => {
    setActingId(id);
    try {
      if (action === "approve") {
        await approveAccessRequest(id);
        toast.success("Request approved");
      } else {
        await denyAccessRequest(id);
        toast.success("Request denied");
      }
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${action} request`);
    } finally {
      setActingId(null);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-rose-800 dark:bg-rose-950 dark:text-rose-300">
          <Lock className="size-3" />
          Admin Only — Hidden From Public Users
        </span>
      </div>

      <h1 className="mt-4 flex items-center gap-2 text-3xl font-extrabold tracking-tight">
        <ShieldCheck className="size-7 text-primary" />
        Trust &amp; Verification Queue
      </h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Claim and access requests raised during organization onboarding. Each is
        triaged by risk: <strong>low</strong> matched the organization&apos;s
        domain, <strong>medium</strong> needs a closer look, and{" "}
        <strong>high</strong> targets a profile already claimed by someone else.
        Approving a claim marks the organization verified; approving an access
        request links the requester to the organization.
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
          Risk
          <select
            value={riskLevel}
            onChange={(e) => setRiskLevel(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
          >
            {RISK_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r || "All"}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          Organization
          <select
            value={organizationType}
            onChange={(e) => setOrganizationType(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
          >
            {ORG_TYPE_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o || "All"}
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
          No access requests match these filters.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-secondary/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">When</th>
                <th className="px-4 py-3 font-semibold">Organization</th>
                <th className="px-4 py-3 font-semibold">Requester</th>
                <th className="px-4 py-3 font-semibold">Type / Risk</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-border align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {formatWhen(e.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="block font-medium">
                      {e.organizationName ?? e.organizationSlug ?? "—"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {e.organizationType}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="block">{e.requesterName ?? "—"}</span>
                    {e.requesterEmail && (
                      <span className="text-xs text-muted-foreground">
                        {e.requesterEmail}
                      </span>
                    )}
                    {e.relationship && (
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {e.relationship}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="block capitalize">{e.requestType}</span>
                    <span
                      className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                        RISK_STYLE[e.riskLevel] ?? RISK_STYLE.low
                      }`}
                    >
                      {e.riskLevel}
                    </span>
                    {e.riskReason && (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {e.riskReason}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
                        STATUS_STYLE[e.status] ?? STATUS_STYLE.pending
                      }`}
                    >
                      {e.status}
                    </span>
                    {e.reviewedAt && (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        reviewed {formatWhen(e.reviewedAt)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {e.status === "pending" ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={actingId === e.id}
                          onClick={() => void act(e.id, "approve")}
                          className="inline-flex h-8 items-center justify-center gap-1 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
                        >
                          {actingId === e.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Check className="size-3.5" />
                          )}
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={actingId === e.id}
                          onClick={() => void act(e.id, "deny")}
                          className="inline-flex h-8 items-center justify-center gap-1 rounded-full border border-border bg-card px-3 text-xs font-semibold transition-colors hover:bg-secondary disabled:opacity-60"
                        >
                          <X className="size-3.5" />
                          Deny
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
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
