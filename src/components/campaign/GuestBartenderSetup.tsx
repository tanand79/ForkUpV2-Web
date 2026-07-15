import { useCallback, useEffect, useState } from "react";
import {
  Trophy,
  LinkIcon,
  QrCode,
  Plus,
  Trash2,
  Pencil,
  Users,
  CheckCircle2,
  MapPin,
  Calendar,
  Clock,
  DollarSign,
  Loader2,
} from "lucide-react";
import { useCampaign, type GuestBartender } from "@/lib/campaign-context";
import { ActionBar } from "./ChooseBusinesses";
import {
  addCampaignParticipant,
  fetchCampaignParticipants,
  removeCampaignParticipant,
  type CampaignParticipant,
} from "@/lib/api";

const emptyForm: GuestBartender = {
  name: "",
  email: "",
  business: "",
  eventDate: "",
  startTime: "",
  endTime: "",
  cashTips: false,
  status: "Invited",
};

const field =
  "h-12 w-full rounded-xl border border-border bg-card px-4 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring/30";

function formatDate(d: string) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(t: string) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function GuestBartenderSetup() {
  const { goTo, state, addGuestBartender, editGuestBartender, removeGuestBartender } =
    useCampaign();
  const slug = state.campaignSlug;
  const [form, setForm] = useState<GuestBartender>(emptyForm);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [touched, setTouched] = useState(false);
  const [apiBartenders, setApiBartenders] = useState<CampaignParticipant[]>([]);
  const [loading, setLoading] = useState(!!slug);
  const [apiError, setApiError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadApi = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setApiError(null);
    try {
      const rows = await fetchCampaignParticipants(slug);
      setApiBartenders(rows.filter((p) => p.participantType === "guest_bartender"));
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Failed to load guest bartenders");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadApi();
  }, [loadApi]);

  const bartenders = slug ? [] : state.guestBartenders;
  const displayBartenders = slug
    ? apiBartenders.map((b) => ({
        id: b.id,
        name: b.name,
        email: b.email ?? "",
        business: b.roleLabel ?? "—",
        eventDate: b.eventDate ?? "",
        startTime: b.eventStartTime?.slice(0, 5) ?? "",
        endTime: b.eventEndTime?.slice(0, 5) ?? "",
        cashTips: false,
        status: b.status === "active" ? "Active" : "Invited",
        shareUrl: b.shareUrl,
      }))
    : bartenders.map((b, i) => ({ ...b, id: i, shareUrl: null as string | null }));
  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email);
  const valid =
    form.name.trim() && emailValid && form.business.trim() && form.eventDate.trim();

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
          participantType: "guest_bartender",
          name: form.name.trim(),
          email: form.email.trim(),
          roleLabel: form.business.trim(),
          eventDate: form.eventDate,
          eventStartTime: form.startTime || undefined,
          eventEndTime: form.endTime || undefined,
        });
        await loadApi();
        resetForm();
      } catch (err) {
        setApiError(err instanceof Error ? err.message : "Failed to add guest bartender");
      } finally {
        setBusy(false);
      }
      return;
    }
    if (editingIndex !== null) {
      editGuestBartender(editingIndex, form);
    } else {
      addGuestBartender(form);
    }
    resetForm();
  };

  const startEdit = (i: number) => {
    if (slug) return;
    setForm(bartenders[i]);
    setEditingIndex(i);
    setTouched(false);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <main className="mx-auto max-w-3xl px-5 py-10 pb-44 sm:px-6 sm:py-12">
        <div className="animate-rise mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Turn a night out into a fundraiser for your cause.
          </h1>
          <p className="mt-3 max-w-[58ch] text-pretty text-muted-foreground">
            Guest bartenders rally their friends, bring people out, and turn tips and donations into
            real support for your mission.
          </p>
          <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-accent/60 p-3.5 text-sm text-accent-foreground">
            <QrCode className="mt-0.5 size-4 shrink-0" />
            <p>
              Each guest bartender gets a personal link and QR code so you can see the donations,
              tips, and support they help generate.
            </p>
          </div>
        </div>

        {/* Add guest bartender form */}
        {apiError && <p className="mb-4 text-sm text-destructive">{apiError}</p>}
        <div className="animate-rise space-y-5 rounded-3xl border border-border bg-card p-6 sm:p-8">
          <h2 className="flex items-center gap-2 font-semibold">
            {editingIndex !== null ? (
              <>
                <Pencil className="size-4 text-primary" />
                Edit guest bartender
              </>
            ) : (
              <>
                <Plus className="size-4 text-primary" />
                Add a guest bartender
              </>
            )}
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Guest Bartender Name *</label>
              <input
                className={field}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Jordan Miller"
              />
              {touched && !form.name.trim() && (
                <p className="text-xs text-destructive">Add a name so guests know who's pouring.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Email *</label>
              <input
                className={field}
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="bartender@email.com"
              />
              {touched && !emailValid && (
                <p className="text-xs text-destructive">
                  Add a valid email so we can send their link and QR code.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold">Assigned Business / Location *</label>
            <input
              className={field}
              value={form.business}
              onChange={(e) => setForm({ ...form, business: e.target.value })}
              placeholder="e.g. Sovana Bistro"
            />
            {touched && !form.business.trim() && (
              <p className="text-xs text-destructive">
                Guest bartending happens at a specific bar or restaurant.
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Event Date *</label>
              <input
                className={field}
                type="date"
                value={form.eventDate}
                onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
              />
              {touched && !form.eventDate.trim() && (
                <p className="text-xs text-destructive">Pick the event date.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Start Time</label>
              <input
                className={field}
                type="time"
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">End Time</label>
              <input
                className={field}
                type="time"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-background p-3.5">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={form.cashTips}
              onChange={(e) => setForm({ ...form, cashTips: e.target.checked })}
            />
            <span className="flex items-center gap-2 text-sm font-medium">
              <DollarSign className="size-4 text-primary" />
              Enable cash tip tracking for this bartender
            </span>
          </label>

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
                  Add Guest Bartender
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
                Their personal link and QR tip code are generated after the campaign launches.
              </span>
            )}
          </div>
        </div>

        {/* Guest bartender list */}
        {loading && (
          <div className="mt-8 flex justify-center">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        )}
        {!loading && displayBartenders.length > 0 && (
          <div className="animate-rise mt-8 [animation-delay:120ms]">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Users className="size-4 text-primary" />
              Guest Bartenders ({displayBartenders.length})
            </h2>

            <div className="space-y-3">
              {displayBartenders.map((b, i) => (
                <div
                  key={slug ? b.id : `${b.email}-${i}`}
                  className="rounded-2xl border border-border bg-card p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{b.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{b.email}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {!slug && (
                        <>
                          <button
                            onClick={() => startEdit(i)}
                            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            aria-label={`Edit ${b.name}`}
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (editingIndex === i) resetForm();
                              removeGuestBartender(i);
                            }}
                            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                            aria-label={`Remove ${b.name}`}
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
                              await removeCampaignParticipant(slug, b.id as number);
                              await loadApi();
                            } catch (err) {
                              setApiError(err instanceof Error ? err.message : "Failed to remove");
                            } finally {
                              setBusy(false);
                            }
                          }}
                          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                          aria-label={`Remove ${b.name}`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5" />
                      {b.business}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="size-3.5" />
                      {formatDate(b.eventDate)}
                    </span>
                    {(b.startTime || b.endTime) && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3.5" />
                        {formatTime(b.startTime)}
                        {b.startTime && b.endTime ? " – " : ""}
                        {formatTime(b.endTime)}
                      </span>
                    )}
                    {b.cashTips && (
                      <span className="inline-flex items-center gap-1">
                        <DollarSign className="size-3.5" />
                        Cash tips tracked
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 font-medium text-foreground">
                      <span className="size-1.5 rounded-full bg-primary" />
                      {b.status}
                    </span>
                    {b.shareUrl ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 font-medium text-primary">
                        <LinkIcon className="size-3" />
                        {b.shareUrl}
                      </span>
                    ) : (
                      <>
                        <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-muted-foreground">
                          <LinkIcon className="size-3" />
                          Link generated after launch
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-muted-foreground">
                          <QrCode className="size-3" />
                          QR code generated after launch
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="animate-rise mt-8 flex items-start gap-2.5 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground [animation-delay:160ms]">
          <Trophy className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>
            After launch, every guest bartender appears on the leaderboard — ranked by online
            donations, QR tip jar donations, and cash tips they help bring in.
          </p>
        </div>
      </main>

      <ActionBar
        backLabel="Back to Dashboard"
        onBack={() => goTo("dashboard")}
        meta={
          displayBartenders.length > 0
            ? `${displayBartenders.length} added`
            : "Add the guest bartenders who will work your event."
        }
        nextLabel="Done — Back to Dashboard"
        nextDisabled={false}
        onNext={() => goTo("dashboard")}
      />

    </>
  );
}
