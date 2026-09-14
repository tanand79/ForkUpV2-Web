"use client";

/**
 * Pass C2 — business post-start checklist panel for the business dashboard.
 * Purpose: Show required-before-partner-ready vs later items after Join Us profile draft.
 * Inputs: businessId. Outputs: checklist UI (read-only; no status mutations).
 */
import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Loader2, ListChecks } from "lucide-react";
import {
  fetchBusinessPostStartChecklist,
  type BusinessPostStartChecklist,
  type BusinessPostStartChecklistItem,
} from "@/lib/api";

export type BusinessPostStartChecklistPanelProps = {
  businessId: number;
};

function ItemRow({ item }: { item: BusinessPostStartChecklistItem }) {
  const done = item.status === "done";
  return (
    <li className="flex gap-3 rounded-xl border border-border bg-background px-3.5 py-3">
      {done ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
      ) : (
        <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      )}
      <div>
        <p className="text-sm font-semibold text-foreground">{item.label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{item.hint}</p>
      </div>
    </li>
  );
}

export function BusinessPostStartChecklistPanel({
  businessId,
}: BusinessPostStartChecklistPanelProps) {
  const [data, setData] = useState<BusinessPostStartChecklist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchBusinessPostStartChecklist(businessId)
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load checklist");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  if (loading) {
    return (
      <section className="mt-8 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading your next steps…
        </div>
      </section>
    );
  }

  if (error || !data) {
    return null;
  }

  const role =
    data.joinDoorType === "restaurant" ? "restaurant" : "business";

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ListChecks className="size-4" />
        </span>
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight">
            After you start — {role} checklist
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Finish required items before you are fully partner-ready. Everything else can wait.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Required before live partnership
          </p>
          <ul className="mt-2 space-y-2">
            {data.required.map((item) => (
              <ItemRow key={item.id} item={item} />
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Can complete later
          </p>
          <ul className="mt-2 space-y-2">
            {data.later.map((item) => (
              <ItemRow key={item.id} item={item} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
