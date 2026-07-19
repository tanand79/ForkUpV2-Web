"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Library, Loader2, Plus, Check, X, EyeOff, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useCampaign } from "@/lib/campaign-context";
import {
  fetchLibraryItems,
  createLibraryItem,
  updateLibraryItem,
  deleteLibraryItem,
  type OrganizationLibraryItem,
  type LibraryOrgType,
} from "@/lib/api";

const CATEGORY_LABELS: Record<string, string> = {
  logos_brand: "Logos & Brand Files",
  photos_images: "Photos & Images",
  flyers_documents: "Flyers & Documents",
  stories_testimonials: "Stories & Testimonials",
  past_events: "Past Events & Fundraisers",
  results_impact: "Results & Impact",
  reusable_content: "Reusable Campaign Content",
  website_scan: "Website Scan Findings",
  social_links: "Social Links",
  contact_info: "Contact Information",
  brand_assets: "Brand / Visual Assets",
};

const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS);

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  rejected: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  ignored: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

export function OrganizationLibrary() {
  const { state, goTo } = useCampaign();

  const activeOrg = useMemo((): { type: LibraryOrgType; id: number; name: string } | null => {
    if (state.accountIntent === "business" && state.businessProfile?.id) {
      return {
        type: "business",
        id: state.businessProfile.id,
        name: state.businessProfile.businessName,
      };
    }
    if (state.nonprofitProfile?.id) {
      return {
        type: "nonprofit",
        id: state.nonprofitProfile.id,
        name: state.nonprofitProfile.organizationName,
      };
    }
    if (state.businessProfile?.id) {
      return {
        type: "business",
        id: state.businessProfile.id,
        name: state.businessProfile.businessName,
      };
    }
    return null;
  }, [state.accountIntent, state.nonprofitProfile, state.businessProfile]);

  const [items, setItems] = useState<OrganizationLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ category: CATEGORY_ORDER[0], title: "", content: "", sourceUrl: "" });

  const load = useCallback(async () => {
    if (!activeOrg) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchLibraryItems(activeOrg.type, activeOrg.id);
      setItems(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load library");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [activeOrg]);

  useEffect(() => {
    void load();
  }, [load]);

  const setReview = async (id: number, reviewStatus: "approved" | "rejected" | "ignored") => {
    setBusyId(id);
    try {
      const updated = await updateLibraryItem(id, { reviewStatus });
      setItems((prev) => prev.map((it) => (it.id === id ? updated : it)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update item");
    } finally {
      setBusyId(null);
    }
  };

  const removeItem = async (id: number) => {
    setBusyId(id);
    try {
      await deleteLibraryItem(id);
      setItems((prev) => prev.filter((it) => it.id !== id));
      toast.success("Item removed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete item");
    } finally {
      setBusyId(null);
    }
  };

  const addItem = async () => {
    if (!activeOrg) return;
    if (!form.title.trim() && !form.content.trim()) {
      toast.error("Add a title or content for the item.");
      return;
    }
    setSaving(true);
    try {
      const created = await createLibraryItem(activeOrg.type, activeOrg.id, {
        category: form.category,
        title: form.title.trim() || undefined,
        content: form.content.trim() || undefined,
        sourceUrl: form.sourceUrl.trim() || undefined,
      });
      setItems((prev) => [created, ...prev]);
      setForm({ category: CATEGORY_ORDER[0], title: "", content: "", sourceUrl: "" });
      setShowAdd(false);
      toast.success("Item added to the library.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add item");
    } finally {
      setSaving(false);
    }
  };

  const grouped = useMemo(() => {
    const map = new Map<string, OrganizationLibraryItem[]>();
    for (const item of items) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return map;
  }, [items]);

  if (!activeOrg) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-12 text-center">
        <Library className="mx-auto size-8 text-primary" />
        <p className="mt-3 text-muted-foreground">
          Select or claim an organization first to view its Library.
        </p>
        <button
          type="button"
          onClick={() => goTo("account-hub")}
          className="btn-primary mt-4 rounded-full px-6 py-3 text-sm font-semibold"
        >
          Go to account hub
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-5 py-10 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-primary">
          Organization Library
        </span>
      </div>
      <h1 className="mt-4 flex items-center gap-2 text-3xl font-extrabold tracking-tight">
        <Library className="size-7 text-primary" />
        {activeOrg.name}
      </h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Reusable content and assets for your campaigns. Review what ForkUp finds or add your own —
        nothing is used until you approve it.
      </p>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-primary bg-primary px-4 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="size-3.5" />
          Add item
        </button>
      </div>

      {showAdd && (
        <div className="mt-4 rounded-2xl border border-border bg-card p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
              Category
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              >
                {CATEGORY_ORDER.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
              Title
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                placeholder="e.g. Mission statement"
              />
            </label>
          </div>
          <label className="mt-3 flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
            Content
            <textarea
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              rows={3}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              placeholder="Text content, link, or notes"
            />
          </label>
          <label className="mt-3 flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
            Source URL (optional)
            <input
              value={form.sourceUrl}
              onChange={(e) => setForm((f) => ({ ...f, sourceUrl: e.target.value }))}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              placeholder="https://…"
            />
          </label>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void addItem()}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-primary bg-primary px-4 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Save item
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="inline-flex h-9 items-center justify-center rounded-full border border-border bg-card px-4 text-xs font-semibold transition-colors hover:bg-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : error ? (
        <p className="mt-6 text-sm text-destructive">{error}</p>
      ) : items.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-border bg-background p-6 text-sm text-muted-foreground">
          Your Library is empty. Add items above — or once website scanning is enabled, ForkUp will
          suggest content here for you to review.
        </p>
      ) : (
        <div className="mt-6 space-y-8">
          {CATEGORY_ORDER.filter((c) => grouped.has(c)).map((category) => (
            <section key={category}>
              <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                {CATEGORY_LABELS[category]}
              </h2>
              <ul className="mt-3 space-y-3">
                {grouped.get(category)!.map((item) => {
                  const busy = busyId === item.id;
                  return (
                    <li key={item.id} className="rounded-2xl border border-border bg-background p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold">{item.title || "(untitled)"}</p>
                          {item.content && (
                            <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                              {item.content}
                            </p>
                          )}
                          {item.sourceUrl && (
                            <a
                              href={item.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 inline-block break-all text-xs text-primary underline"
                            >
                              {item.sourceUrl}
                            </a>
                          )}
                        </div>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                            STATUS_STYLE[item.reviewStatus] ?? STATUS_STYLE.pending
                          }`}
                        >
                          {item.reviewStatus}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.reviewStatus !== "approved" && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void setReview(item.id, "approved")}
                            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-semibold transition-colors hover:bg-secondary disabled:opacity-60"
                          >
                            <Check className="size-3.5" /> Approve
                          </button>
                        )}
                        {item.reviewStatus !== "ignored" && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void setReview(item.id, "ignored")}
                            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-semibold transition-colors hover:bg-secondary disabled:opacity-60"
                          >
                            <EyeOff className="size-3.5" /> Ignore
                          </button>
                        )}
                        {item.reviewStatus !== "rejected" && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void setReview(item.id, "rejected")}
                            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-semibold transition-colors hover:bg-secondary disabled:opacity-60"
                          >
                            <X className="size-3.5" /> Reject
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void removeItem(item.id)}
                          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-semibold text-destructive transition-colors hover:bg-secondary disabled:opacity-60"
                        >
                          <Trash2 className="size-3.5" /> Delete
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
