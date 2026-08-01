"use client";

import { useCallback, useEffect, useState } from "react";
import { Banknote, Loader2, Plus, Check, X } from "lucide-react";
import {
  fetchCampaignPayouts,
  recordPayout,
  updatePayout,
  type Payout,
  type PayoutStatus,
  type PayoutType,
  type PayoutMethod,
  type SettlementReport,
} from "@/lib/api";
import { formatDateTimeUs, formatDateUs, looksLikeIsoDateTime } from "@/lib/date-only";

const TYPE_LABEL: Record<PayoutType, string> = {
  business_to_forkup: "Business → ForkUp",
  forkup_to_nonprofit: "ForkUp → Nonprofit",
  adjustment: "Adjustment",
};

const STATUS_STYLE: Record<PayoutStatus, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  processing: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  failed: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  cancelled: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

const TYPE_OPTIONS: PayoutType[] = [
  "forkup_to_nonprofit",
  "business_to_forkup",
  "adjustment",
];
const METHOD_OPTIONS: PayoutMethod[] = ["ach", "check", "manual", "other"];

const inputClass =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";

function formatWhen(value: string | null): string {
  if (!value) return "—";
  return looksLikeIsoDateTime(value) ? formatDateTimeUs(value) : formatDateUs(value);
}

export function PayoutsPanel({
  slug,
  businessReports,
}: {
  slug: string;
  businessReports: SettlementReport["businessReports"];
}) {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [summary, setSummary] = useState({ totalPaid: 0, totalPending: 0, count: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<number | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [payoutType, setPayoutType] = useState<PayoutType>("forkup_to_nonprofit");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"" | PayoutMethod>("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [settlementId, setSettlementId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchCampaignPayouts(slug);
      setPayouts(res.payouts);
      setSummary(res.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load payouts");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const resetForm = () => {
    setPayoutType("forkup_to_nonprofit");
    setAmount("");
    setMethod("");
    setReference("");
    setNotes("");
    setSettlementId("");
  };

  const handleRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await recordPayout(slug, {
        payoutType,
        amount: amountNum,
        method: method || undefined,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        settlementId: settlementId ? Number(settlementId) : undefined,
      });
      resetForm();
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record payout");
    } finally {
      setSaving(false);
    }
  };

  const handleStatus = async (id: number, status: PayoutStatus) => {
    setActingId(id);
    setError(null);
    try {
      await updatePayout(slug, id, { status });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update payout");
    } finally {
      setActingId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-bold">
          <Banknote className="size-4 text-primary" />
          Payouts &amp; disbursements
        </h2>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
        >
          <Plus className="size-3.5" />
          Record payout
        </button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Track money moving between businesses, ForkUp, and the nonprofit. Marking a nonprofit
        disbursement paid updates the linked settlement.
      </p>

      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl bg-secondary/40 p-3">
          <p className="text-lg font-bold text-emerald-600">${summary.totalPaid.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground">Paid</p>
        </div>
        <div className="rounded-xl bg-secondary/40 p-3">
          <p className="text-lg font-bold text-amber-600">${summary.totalPending.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground">Outstanding</p>
        </div>
        <div className="rounded-xl bg-secondary/40 p-3">
          <p className="text-lg font-bold">{summary.count}</p>
          <p className="text-xs text-muted-foreground">Records</p>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleRecord} className="mt-5 space-y-3 rounded-2xl border border-border p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs font-semibold text-muted-foreground">
              Type
              <select
                value={payoutType}
                onChange={(e) => setPayoutType(e.target.value as PayoutType)}
                className={inputClass}
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs font-semibold text-muted-foreground">
              Amount
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className={inputClass}
              />
            </label>
            <label className="space-y-1 text-xs font-semibold text-muted-foreground">
              Method
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as "" | PayoutMethod)}
                className={inputClass}
              >
                <option value="">—</option>
                {METHOD_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs font-semibold text-muted-foreground">
              Link to settlement (optional)
              <select
                value={settlementId}
                onChange={(e) => setSettlementId(e.target.value)}
                className={inputClass}
              >
                <option value="">—</option>
                {businessReports.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.businessName} — {b.locationName}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block space-y-1 text-xs font-semibold text-muted-foreground">
            Reference (transfer / invoice id)
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. ACH-2026-0012"
              className={inputClass}
            />
          </label>
          <label className="block space-y-1 text-xs font-semibold text-muted-foreground">
            Notes
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={inputClass}
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              className="rounded-full border border-border px-4 py-2 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
              Save payout
            </button>
          </div>
        </form>
      )}

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      {loading ? (
        <div className="mt-6 flex justify-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : payouts.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
          No payouts recorded yet.
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {payouts.map((p) => (
            <li key={p.id} className="rounded-xl border border-border p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {TYPE_LABEL[p.payoutType]} · ${p.amount.toFixed(2)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {p.businessName ? `${p.businessName}${p.locationName ? ` — ${p.locationName}` : ""} · ` : ""}
                    {p.method ? `${p.method.toUpperCase()} · ` : ""}
                    {p.reference ? `${p.reference} · ` : ""}
                    {p.status === "paid" ? `Paid ${formatWhen(p.paidAt)}` : `Created ${formatWhen(p.createdAt)}`}
                  </p>
                  {p.notes && <p className="mt-1 text-xs text-muted-foreground">{p.notes}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${STATUS_STYLE[p.status]}`}
                  >
                    {p.status}
                  </span>
                  {(p.status === "pending" || p.status === "processing") && (
                    <div className="flex gap-1.5">
                      {p.status === "pending" && (
                        <button
                          type="button"
                          disabled={actingId === p.id}
                          onClick={() => handleStatus(p.id, "processing")}
                          className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold disabled:opacity-60"
                        >
                          Processing
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={actingId === p.id}
                        onClick={() => handleStatus(p.id, "paid")}
                        className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                      >
                        {actingId === p.id ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Check className="size-3" />
                        )}
                        Paid
                      </button>
                      <button
                        type="button"
                        disabled={actingId === p.id}
                        onClick={() => handleStatus(p.id, "cancelled")}
                        className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-semibold disabled:opacity-60"
                      >
                        <X className="size-3" />
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
