import { useCallback, useEffect, useState } from "react";
import { Trophy, LinkIcon, Plus, Trash2, Pencil, Users, Clock, CheckCircle2, X, Loader2 } from "lucide-react";
import { useCampaign, type Ambassador, type AmbassadorRole } from "@/lib/campaign-context";
import { formatDateUs } from "@/lib/date-only";
import { ActionBar } from "./ChooseBusinesses";
import {
  addCampaignParticipant,
  fetchCampaignParticipants,
  removeCampaignParticipant,
  type CampaignParticipant,
} from "@/lib/api";

const ROLES: AmbassadorRole[] = [
  "Board Member",
  "Parent",
  "Player",
  "Coach",
  "Volunteer",
  "Ambassador",
  "Local Personality",
  "Other",
];

const REMINDER_TASK_ID = "task-add-ambassadors";

const emptyForm: Ambassador = {
  name: "",
  email: "",
  role: "Ambassador",
  status: "Invited",
};

const field =
  "h-12 w-full rounded-xl border border-border bg-card px-4 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring/30";

// Suggested due date for the "Add ambassador team" reminder. Aim for 7 days
// before the campaign start; if the campaign is less than 7 days away, the due
// date is as soon as possible (today).
function reminderDueDate(startDate: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const toISO = (d: Date) => d.toISOString().slice(0, 10);
  if (!startDate) {
    const d = new Date(today);
    d.setDate(d.getDate() + 7);
    return toISO(d);
  }
  const start = new Date(startDate + "T00:00:00");
  const sevenBefore = new Date(start);
  sevenBefore.setDate(sevenBefore.getDate() - 7);
  return sevenBefore <= today ? toISO(today) : toISO(sevenBefore);
}

function formatDate(d: string) {
  if (!d) return "—";
  return formatDateUs(d);
}

export function AmbassadorSetup() {
  const { goTo, state, addAmbassador, editAmbassador, removeAmbassador, addTask, removeTask } =
    useCampaign();
  const slug = state.campaignSlug;
  const [form, setForm] = useState<Ambassador>(emptyForm);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [touched, setTouched] = useState(false);
  const [apiAmbassadors, setApiAmbassadors] = useState<CampaignParticipant[]>([]);
  const [loading, setLoading] = useState(!!slug);
  const [apiError, setApiError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadApi = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setApiError(null);
    try {
      const rows = await fetchCampaignParticipants(slug);
      setApiAmbassadors(rows.filter((p) => p.participantType === "ambassador"));
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Failed to load ambassadors");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadApi();
  }, [loadApi]);

  const ambassadors = slug ? [] : state.ambassadors;
  const displayAmbassadors = slug
    ? apiAmbassadors.map((a) => ({
        id: a.id,
        name: a.name,
        email: a.email ?? "",
        role: (a.roleLabel as AmbassadorRole) || "Ambassador",
        status: a.status === "active" ? "Active" : "Invited",
        shareUrl: a.shareUrl,
      }))
    : ambassadors.map((a, i) => ({ ...a, id: i, shareUrl: null as string | null }));
  const reminderTask = state.tasks.find((t) => t.id === REMINDER_TASK_ID);
  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email);
  const valid = form.name.trim() && emailValid;

  const resetForm = () => {
    setForm(emptyForm);
    setEditingIndex(null);
    setTouched(false);
  };

  const submit = async () => {
    if (!valid) {
      setTouched(true);
      return;
    }
    if (slug) {
      setBusy(true);
      setApiError(null);
      try {
        await addCampaignParticipant(slug, {
          participantType: "ambassador",
          name: form.name.trim(),
          email: form.email.trim(),
          roleLabel: form.role,
        });
        await loadApi();
        resetForm();
      } catch (err) {
        setApiError(err instanceof Error ? err.message : "Failed to add ambassador");
      } finally {
        setBusy(false);
      }
      return;
    }
    if (editingIndex !== null) {
      editAmbassador(editingIndex, form);
    } else {
      addAmbassador(form);
    }
    resetForm();
  };

  const startEdit = (i: number) => {
    if (slug) return;
    setForm(ambassadors[i]);
    setEditingIndex(i);
    setTouched(false);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remindLater = () => {
    addTask({
      id: REMINDER_TASK_ID,
      title: "Add ambassador team",
      dueDate: reminderDueDate(state.startDate),
      done: false,
    });
  };

  return (
    <>
      <main className="mx-auto max-w-3xl px-5 py-10 pb-44 sm:px-6 sm:py-12">
        <div className="animate-rise mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Expand your reach through people who believe in your cause.
          </h1>
          <p className="mt-3 max-w-[58ch] text-pretty text-muted-foreground">
            The people you invite can share your campaign with their own networks and bring new
            supporters you'd never reach alone.
          </p>
          <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-accent/60 p-3.5 text-sm text-accent-foreground">
            <LinkIcon className="mt-0.5 size-4 shrink-0" />
            <p>
              Each ambassador gets a personal link so you can see exactly how much support they help
              bring in.
            </p>
          </div>
        </div>

        {/* Add now or later */}
        {reminderTask ? (
          <div className="animate-rise mb-6 flex items-start justify-between gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-semibold">Reminder set — “Add ambassador team”</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Due {formatDate(reminderTask.dueDate)}. You can launch now and add ambassadors
                  later.
                </p>
              </div>
            </div>
            <button
              onClick={() => removeTask(REMINDER_TASK_ID)}
              className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Remove reminder"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <div className="animate-rise mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="flex items-start gap-2.5">
              <Clock className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-semibold">Not ready to add ambassadors yet?</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  No problem. You can launch your campaign now and add ambassadors later.
                </p>
              </div>
            </div>
            <button
              onClick={remindLater}
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-border bg-background px-5 text-sm font-semibold transition-colors hover:bg-secondary"
            >
              Remind Me Later
            </button>
          </div>
        )}

        {/* Add ambassador form */}
        {apiError && <p className="mb-4 text-sm text-destructive">{apiError}</p>}
        <div className="animate-rise space-y-5 rounded-3xl border border-border bg-card p-6 sm:p-8 [animation-delay:60ms]">
          <h2 className="flex items-center gap-2 font-semibold">
            {editingIndex !== null ? (
              <>
                <Pencil className="size-4 text-primary" />
                Edit ambassador
              </>
            ) : (
              <>
                <Plus className="size-4 text-primary" />
                Add an ambassador
              </>
            )}
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Ambassador Name *</label>
              <input
                className={field}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Jordan Miller"
              />
              {touched && !form.name.trim() && (
                <p className="text-xs text-destructive">Add a name so you know who's rallying support.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Email *</label>
              <input
                className={field}
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="ambassador@email.com"
              />
              {touched && !emailValid && (
                <p className="text-xs text-destructive">
                  Add a valid email so we can send their personal share link.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold">
              Role / Type <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <select
              className={field}
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as AmbassadorRole })}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              onClick={() => void submit()}
              disabled={busy}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-dark active:scale-95 disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : editingIndex !== null ? (
                <>
                  <CheckCircle2 className="size-4" />
                  Save Changes
                </>
              ) : (
                <>
                  <Plus className="size-4" />
                  Add Ambassador
                </>
              )}
            </button>
            {editingIndex !== null ? (
              <button
                onClick={resetForm}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Cancel
              </button>
            ) : (
              <span className="text-xs text-muted-foreground">
                Their personal share link is generated after the campaign launches.
              </span>
            )}
          </div>
        </div>

        {/* Ambassador team */}
        {loading && (
          <div className="mt-8 flex justify-center">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        )}
        {!loading && displayAmbassadors.length > 0 && (
          <div className="animate-rise mt-8 [animation-delay:120ms]">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Users className="size-4 text-primary" />
              Ambassador Team ({displayAmbassadors.length})
            </h2>

            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="hidden grid-cols-[1.4fr_1fr_0.8fr_1fr_auto] gap-3 border-b border-border bg-secondary/50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:grid">
                <span>Name</span>
                <span>Role</span>
                <span>Status</span>
                <span>Link Status</span>
                <span className="text-right">Actions</span>
              </div>
              <ul>
                {displayAmbassadors.map((a, i) => (
                  <li
                    key={slug ? a.id : `${a.email}-${i}`}
                    className="grid grid-cols-1 gap-1.5 border-b border-border px-4 py-3 last:border-b-0 sm:grid-cols-[1.4fr_1fr_0.8fr_1fr_auto] sm:items-center sm:gap-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{a.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{a.email}</p>
                    </div>
                    <div>
                      <span className="inline-flex rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
                        {a.role}
                      </span>
                    </div>
                    <div>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
                        <span className="size-1.5 rounded-full bg-primary" />
                        {a.status}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {a.shareUrl ? (
                        <span className="font-medium text-primary">{a.shareUrl}</span>
                      ) : (
                        "Generated after launch"
                      )}
                    </div>
                    <div className="flex items-center gap-1 sm:justify-end">
                      {!slug && (
                        <>
                          <button
                            onClick={() => startEdit(i)}
                            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            aria-label={`Edit ${a.name}`}
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (editingIndex === i) resetForm();
                              removeAmbassador(i);
                            }}
                            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                            aria-label={`Remove ${a.name}`}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </>
                      )}
                      {slug && (
                        <button
                          onClick={async () => {
                            setBusy(true);
                            try {
                              await removeCampaignParticipant(slug, a.id as number);
                              await loadApi();
                            } catch (err) {
                              setApiError(err instanceof Error ? err.message : "Failed to remove");
                            } finally {
                              setBusy(false);
                            }
                          }}
                          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                          aria-label={`Remove ${a.name}`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="animate-rise mt-8 flex items-start gap-2.5 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground [animation-delay:160ms]">
          <Trophy className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>
            After launch, every ambassador appears on the leaderboard, ranked by the donations
            generated through their personal link — a simple way to see who's driving support.
          </p>
        </div>
      </main>

      <ActionBar
        backLabel="Back to Dashboard"
        onBack={() => goTo("dashboard")}
        meta={
          displayAmbassadors.length > 0
            ? `${displayAmbassadors.length} added`
            : "Add ambassadors now or come back later from your dashboard."
        }
        nextLabel="Done — Back to Dashboard"
        nextDisabled={false}
        onNext={() => goTo("dashboard")}
      />

    </>
  );
}
