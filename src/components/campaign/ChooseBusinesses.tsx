import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, MapPin, Plus, Search, Send, Store, X } from "lucide-react";
import { inferCapabilities, type Business, type BusinessStatus } from "@/data/businesses";
import { useCampaign } from "@/lib/campaign-context";
import { GIVEBACK_CATEGORY_LABEL, businessParticipationLine } from "@/lib/giveback-terminology";
import { givebackMethodForBusiness, METHOD_TYPE_META } from "@/lib/method-timing";
import { fetchBuilderBusinesses, appendCampaignBusinessInvitations, fetchBuilderCampaign } from "@/lib/api";
import { mapApiBusinessesToUi } from "@/lib/api-businesses";
import { buildAppendBusinessInvitationsPayload } from "@/lib/builder-submit";
import { methodsFromApiList } from "@/lib/campaign-flow";
import { LegacyInviteStatusBadge } from "@/components/campaign/BusinessStatusBadge";
import {
  nearbyQueryParams,
  useBrowserLocation,
} from "@/hooks/use-browser-location";




// Factual ForkUp experience derived from known status only.
const EXPERIENCE_LABELS: Record<BusinessStatus, string> = {
  "On ForkUp": "Existing ForkUp Partner",
  Preloaded: "First-Time Invite",
  "Previously Participated": "Previous Campaign Participant",
  "Invite Needed": "First-Time Invite",
};

const CATEGORY_FILTERS = ["All", "Restaurant", "Coffee", "Retail", "Fitness", "Salon", "Service"];

const BUSINESS_TYPES = [
  "Restaurant",
  "Coffee Shop",
  "Retail",
  "Salon",
  "Fitness",
  "Service",
  "Other",
];

export function ChooseBusinesses() {
  const {
    state,
    update,
    toggleBusiness,
    addInvited,
    removeInvited,
    next,
    back,
    designMode,
    goTo,
    selectedBusinesses: selectedFromState,
  } = useCampaign();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [profileBusiness, setProfileBusiness] = useState<Business | null>(null);
  const [catalog, setCatalog] = useState<Business[]>(state.businessCatalog);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  /** When true, fetch catalog within ~8 miles. Off by default = normal full list. */
  const [nearbyOnly, setNearbyOnly] = useState(false);
  const [sendingAppend, setSendingAppend] = useState(false);
  const [appendError, setAppendError] = useState<string | null>(null);
  const browserLocation = useBrowserLocation(nearbyOnly);
  const nearby = nearbyQueryParams(browserLocation);

  /** Post-launch invite mode (?appendInvites=1) — send via append API, not Review. */
  const appendInvites =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("appendInvites") === "1";
  /** AI create: opened from Dates — Next returns to Preview (not Launch). */
  const returnToAiPreview =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("returnTo") ===
      "ai-campaign-preview";
  const [appendHydrating, setAppendHydrating] = useState(appendInvites);

  useEffect(() => {
    let cancelled = false;
    setCatalogLoading(true);
    setCatalogError(null);
    const geo = nearbyOnly ? nearby : undefined;
    fetchBuilderBusinesses(undefined, geo ?? null)
      .then((rows) => {
        if (cancelled) return;
        const mapped = mapApiBusinessesToUi(rows);
        setCatalog(mapped);
        update({ businessCatalog: mapped });
      })
      .catch(() => {
        if (!cancelled) {
          setCatalog([]);
          setCatalogError("Could not load businesses. Try again or add a business manually.");
        }
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [update, nearbyOnly, nearby?.lat, nearby?.lng, nearby?.radiusMiles]);

  /**
   * Append mode often opens without a full builder hydrate — methods stay at
   * Online/Ambassador defaults and the invite payload becomes empty. Load the
   * campaign methods/dates (not partner selections) before sending.
   */
  useEffect(() => {
    if (!appendInvites) {
      setAppendHydrating(false);
      return;
    }
    const slug = state.campaignSlug?.trim();
    if (!slug) {
      setAppendHydrating(false);
      setAppendError("Campaign is missing. Open Invite from your campaign dashboard.");
      return;
    }
    let cancelled = false;
    setAppendHydrating(true);
    void fetchBuilderCampaign(slug)
      .then((data) => {
        if (cancelled) return;
        const methods = methodsFromApiList(data.methods);
        update({
          campaignSlug: data.slug,
          title: data.campaignName || state.title,
          description: data.campaignStory || state.description,
          startDate: data.startDate ?? state.startDate,
          endDate: data.endDate ?? state.endDate,
          methods,
        });
        if (!methods.giveback && !methods.guestBartending) {
          setAppendError(
            "This campaign has no Dine & Donate or Guest Bartending methods to invite businesses for.",
          );
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setAppendError(
            err instanceof Error ? err.message : "Could not load campaign for inviting businesses.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setAppendHydrating(false);
      });
    return () => {
      cancelled = true;
    };
    // Mount/append once per slug — avoid re-running on every state field change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appendInvites, state.campaignSlug]);

  const selectedCount = state.selectedBusinessIds.length;
  const invitedCount = state.invited.length;
  const totalOnList = selectedCount + invitedCount;

  // Business selection only blocks progression when Local Business Giveback is
  // the ONLY support method. When the campaign also includes Virtual Donations,
  // Ambassador, or Guest Bartender, those can launch while invitations remain
  // pending — so we never block the user from reaching Campaign Assets.
  const givebackOnly =
    state.methods.giveback &&
    !state.methods.donations &&
    !state.methods.ambassador &&
    !state.methods.guestBartending;
  const requireBusiness = givebackOnly && totalOnList === 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const cat = category.toLowerCase();
    return catalog.filter((b) => {
      const matchesSearch =
        !q || [b.name, b.type, b.category, b.location].some((f) => f.toLowerCase().includes(q));
      const matchesCategory =
        category === "All" ||
        [b.type, b.category].some((f) => f.toLowerCase().includes(cat));
      return matchesSearch && matchesCategory;
    });
  }, [query, category, catalog]);

  const selectedBusinesses = catalog.filter((b) =>
    state.selectedBusinessIds.includes(b.id),
  );

  const canSkip = !givebackOnly && totalOnList === 0;

  const newInviteCount =
    state.selectedBusinessIds.length +
    state.invited.filter((b) => !b.persisted).length;

  /**
   * Send newly selected/invited businesses on a live (or inviting) campaign,
   * then return to the success dashboard.
   */
  const handleAppendInvites = async () => {
    const slug = state.campaignSlug?.trim();
    if (appendHydrating) {
      setAppendError("Still loading campaign details — try again in a moment.");
      return;
    }
    if (!slug) {
      setAppendError("Campaign is missing. Open this from your dashboard.");
      return;
    }
    if (!state.methods.giveback && !state.methods.guestBartending) {
      setAppendError(
        "This campaign has no Dine & Donate or Guest Bartending methods to invite businesses for.",
      );
      return;
    }
    if (newInviteCount === 0) {
      setAppendError("Select or invite at least one new business.");
      return;
    }
    setSendingAppend(true);
    setAppendError(null);
    try {
      const nonprofit =
        state.nonprofitProfile ??
        ({
          organizationName: "Nonprofit",
          contactName: "",
          contactEmail: "unknown@local",
        } as const);
      const payload = buildAppendBusinessInvitationsPayload(
        state,
        nonprofit,
        selectedFromState.length > 0 ? selectedFromState : selectedBusinesses,
      );
      if (
        (payload.invitations?.length ?? 0) === 0 &&
        (payload.newBusinessInvites?.length ?? 0) === 0
      ) {
        setAppendError(
          "Could not build invitation details for the selected businesses. Try Invite New Business with name and email.",
        );
        return;
      }
      const result = await appendCampaignBusinessInvitations(slug, payload);
      update({
        invited: state.invited.map((b) => ({ ...b, persisted: true })),
        selectedBusinessIds: [],
      });
      if (result.addedCount === 0) {
        setAppendError(result.message || "No new invitations added.");
        return;
      }
      goTo("dashboard", { query: { appendInvites: undefined, token: undefined } });
    } catch (err) {
      setAppendError(
        err instanceof Error ? err.message : "Failed to send business invitations",
      );
    } finally {
      setSendingAppend(false);
    }
  };

  return (
    <>
      <main className="mx-auto max-w-3xl px-5 py-10 pb-32 sm:px-6 sm:py-12">
        <div className="animate-rise mb-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
            {GIVEBACK_CATEGORY_LABEL} Setup
          </p>
          <h1 className="font-display text-balance text-3xl font-bold leading-[1.12] tracking-tight sm:text-4xl">
            Invite businesses to support your campaign
          </h1>
          <p className="mt-3 max-w-[60ch] text-pretty text-base text-muted-foreground">
            Choose a business from the list or invite a new one. Businesses appear on your campaign
            page after they accept.
          </p>
          {appendInvites && appendError ? (
            <p className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive" role="alert">
              {appendError}
            </p>
          ) : null}
          {appendInvites && appendHydrating ? (
            <p className="mt-2 text-sm text-muted-foreground">Loading campaign methods…</p>
          ) : null}
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={nearbyOnly}
              onChange={(e) => setNearbyOnly(e.target.checked)}
              className="size-4 rounded border-border"
            />
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-3.5 text-muted-foreground" />
              Show businesses within ~8 miles of my location
            </span>
          </label>
          {nearbyOnly ? (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {browserLocation.status === "ready"
                ? "Nearby filter on — unmapped locations still included."
                : browserLocation.status === "prompting"
                  ? "Checking location…"
                  : browserLocation.error ?? "Allow location to filter nearby businesses."}
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Nearby filter is off — showing all businesses.
            </p>
          )}
        </div>

        {/* Search + compact filters */}
        <section className="animate-rise">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by business name, category, or town"
              className="h-12 w-full rounded-xl border border-border bg-card pl-11 pr-4 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {CATEGORY_FILTERS.map((f) => {
              const active = category === f;
              return (
                <button
                  key={f}
                  onClick={() => setCategory(f)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
                  }`}
                >
                  {f}
                </button>
              );
            })}
          </div>
        </section>

        {/* Invite list — only when at least one selected/invited */}
        {totalOnList > 0 && (
          <section className="animate-rise mt-6 rounded-2xl border border-border bg-card p-4">
            <h2 className="text-sm font-bold">Invite List ({totalOnList})</h2>
            <ul className="mt-3 space-y-2">
              {selectedBusinesses.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center justify-between gap-2 rounded-xl bg-secondary/50 px-3 py-2"
                >
                  <span className="min-w-0 truncate text-sm">
                    <span className="font-medium">{b.name}</span>
                    <span className="ml-2">
                      <LegacyInviteStatusBadge
                        status={state.businessStatuses[b.id] ?? "pending"}
                      />
                    </span>
                  </span>
                  <button
                    onClick={() => toggleBusiness(b.id)}
                    aria-label={`Remove ${b.name}`}
                    className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
              {state.invited.map((b, i) => (
                <li
                  key={`inv-${i}`}
                  className="flex items-center justify-between gap-2 rounded-xl bg-accent/30 px-3 py-2"
                >
                  <span className="min-w-0 truncate text-sm">
                    <span className="font-medium">{b.name}</span>
                    <span className="ml-2">
                      <LegacyInviteStatusBadge status={b.status ?? "pending"} />
                    </span>
                  </span>
                  <button
                    onClick={() => removeInvited(i)}
                    aria-label={`Remove ${b.name}`}
                    className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Business cards — compact */}
        <section className="animate-rise mt-6">
          {catalogLoading ? (
            <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              Loading businesses…
            </div>
          ) : catalogError ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center text-sm text-destructive">
              {catalogError}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card p-8 text-center">
              <p className="text-sm font-medium text-foreground">No businesses found.</p>
              <p className="mt-1 max-w-[44ch] text-sm text-muted-foreground">
                Try another search, choose a different category, or invite a new business.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {filtered.map((b, i) => {
                const selected = state.selectedBusinessIds.includes(b.id);
                return (
                  <div
                    key={b.id}
                    style={{ animationDelay: `${i * 40}ms` }}
                    className={`animate-rise relative flex items-center gap-3 overflow-hidden rounded-2xl p-3 transition-all ${
                      selected
                        ? "bg-accent/40 ring-2 ring-primary"
                        : "bg-card ring-1 ring-border hover:ring-primary/40"
                    }`}
                  >
                    <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-secondary">
                      <img
                        src={b.image}
                        alt={b.name}
                        width={120}
                        height={120}
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <h3 className="truncate text-sm font-semibold leading-tight">{b.name}</h3>
                      <p className="truncate text-xs text-muted-foreground">
                        {b.category} · {b.location}
                      </p>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Support Type:</span>{" "}
                        {METHOD_TYPE_META[givebackMethodForBusiness(b)].label}
                      </p>
                      <div className="mt-2 flex items-center gap-3">
                        <button
                          onClick={() => toggleBusiness(b.id)}
                          className={`inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                            selected
                              ? "bg-secondary text-foreground hover:bg-secondary/70"
                              : "bg-primary text-primary-foreground hover:bg-primary-dark"
                          }`}
                        >
                          {selected ? (
                            <>
                              <Check className="size-3.5" strokeWidth={3} />
                              Added
                            </>
                          ) : (
                            <>
                              <Plus className="size-3.5" strokeWidth={3} />
                              Invite
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => setProfileBusiness(b)}
                          className="text-xs font-medium text-primary underline-offset-2 transition-colors hover:underline"
                        >
                          View Profile
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Invite a new business — reduced copy */}
        <section className="animate-rise mt-8">
          <div className="rounded-3xl bg-secondary p-6 ring-1 ring-border">
            {!showForm ? (
              <div className="flex flex-col items-center text-center">
                <h3 className="text-base font-bold">Don’t see the business you want?</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Invite a new local business to join your campaign.
                </p>
                <button
                  onClick={() => setShowForm(true)}
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-transform active:scale-95"
                >
                  <Plus className="size-4" />
                  Invite New Business
                </button>
              </div>
            ) : (
              <InviteForm
                onCancel={() => setShowForm(false)}
                onAdd={(b) => {
                  addInvited(b);
                  setShowForm(false);
                }}
              />
            )}
          </div>
        </section>
      </main>

      <ActionBar
        backLabel="Back"
        onBack={() => {
          if (appendInvites) {
            goTo("dashboard", { query: { appendInvites: undefined } });
            return;
          }
          if (returnToAiPreview) {
            goTo("ai-campaign-dates", {
              query: { returnTo: undefined, appendInvites: undefined },
            });
            return;
          }
          back();
        }}
        meta={
          appendError
            ? appendError
            : appendInvites
              ? newInviteCount > 0
                ? `${newInviteCount} new business${newInviteCount > 1 ? "es" : ""} ready to invite`
                : "Select or invite at least one business to send."
              : requireBusiness
                ? "Select or invite at least one business to continue."
                : canSkip
                  ? returnToAiPreview
                    ? "You can continue to preview and invite more businesses later."
                    : "Other active methods can continue while business invites are pending."
                  : `${totalOnList} business${totalOnList > 1 ? "es" : ""} on your invite list`
        }
        nextLabel={
          appendInvites
            ? sendingAppend
              ? "Sending…"
              : "Send Invites"
            : returnToAiPreview
              ? canSkip
                ? "Skip for now — continue to preview"
                : "Next: Campaign Preview"
              : canSkip
                ? "Skip for now — back to Review"
                : "Next: Review & Launch"
        }
        nextDisabled={
          appendInvites
            ? sendingAppend || appendHydrating || newInviteCount === 0
            : requireBusiness && !designMode
        }
        onNext={() => {
          if (appendInvites) {
            void handleAppendInvites();
            return;
          }
          if (returnToAiPreview) {
            goTo("ai-campaign-preview", {
              query: { returnTo: undefined, appendInvites: undefined },
            });
            return;
          }
          next();
        }}
      />

      {profileBusiness && (
        <BusinessProfileModal
          business={profileBusiness}
          selected={state.selectedBusinessIds.includes(profileBusiness.id)}
          onClose={() => setProfileBusiness(null)}
          onInvite={() => {
            toggleBusiness(profileBusiness.id);
          }}
        />
      )}
    </>
  );
}

function BusinessProfileModal({
  business: b,
  selected,
  onClose,
  onInvite,
}: {
  business: Business;
  selected: boolean;
  onClose: () => void;
  onInvite: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-foreground/40 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="animate-rise max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-card shadow-xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-secondary">
          <img src={b.image} alt={b.name} className="size-full object-cover" />
          <button
            onClick={onClose}
            aria-label="Close profile"
            className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm transition-colors hover:bg-background"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="p-6">
          <h2 className="font-display text-2xl font-bold leading-tight">{b.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{b.category}</p>
          <div className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <MapPin className="size-4" />
            <span>{b.location}</span>
          </div>

          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Store className="size-3.5" />
            {businessParticipationLine(b)}
          </p>

          <p className="mt-4 text-sm leading-relaxed text-foreground">{b.description}</p>


          <div className="mt-6 space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Support Methods Available
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {b.supportMethods.map((m) => (
                  <span
                    key={m}
                    className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-foreground"
                  >
                    <Check className="size-3 text-primary" strokeWidth={3} />
                    {m}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Campaign Experience
              </p>
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <Store className="size-3.5" />
                {EXPERIENCE_LABELS[b.status]}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Support Type
              </p>
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-foreground">
                <Check className="size-3 text-primary" strokeWidth={3} />
                {METHOD_TYPE_META[givebackMethodForBusiness(b)].label}
              </p>
            </div>
          </div>

          <div className="mt-7 flex items-center gap-3">
            <button
              onClick={() => {
                onInvite();
                onClose();
              }}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-colors ${
                selected
                  ? "bg-secondary text-foreground hover:bg-secondary/70"
                  : "bg-primary text-primary-foreground hover:bg-primary-dark"
              }`}
            >
              {selected ? (
                <>
                  <Check className="size-4" strokeWidth={3} />
                  Remove from Invite List
                </>
              ) : (
                <>
                  <Plus className="size-4" strokeWidth={3} />
                  Invite Business
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="rounded-full border border-border px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}



function InviteForm({
  onCancel,
  onAdd,
}: {
  onCancel: () => void;
  onAdd: (b: {
    name: string;
    contactName: string;
    email: string;
    type: string;
    location: string;
    note: string;
    proposedTerms?: string;
    capabilities: ReturnType<typeof inferCapabilities>;
  }) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    contactName: "",
    email: "",
    type: "Restaurant",
    location: "",
    note: "",
    proposedTerms: "",
  });
  const [touched, setTouched] = useState(false);

  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email);
  const valid = form.name.trim().length > 0 && emailValid;

  // The support type is inferred from the chosen business type.
  const capabilities = inferCapabilities({ category: form.type, type: form.type });
  const supportType = givebackMethodForBusiness(capabilities);

  const field =
    "h-11 w-full rounded-xl border border-border bg-card px-4 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring/30";

  const submit = () => {
    if (!valid) {
      setTouched(true);
      return;
    }
    onAdd({
      ...form,
      proposedTerms: form.proposedTerms.trim() || undefined,
      capabilities,
    });
  };

  return (
    <div className="text-left">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">Invite a New Business</h3>
        <button
          onClick={onCancel}
          aria-label="Close invite form"
          className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="mt-5 space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-semibold">
            Business Name <span className="text-primary">*</span>
          </label>
          <input
            className={field}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Sovana Bistro"
          />
          {touched && !form.name.trim() && (
            <p className="text-xs text-destructive">Add the business name so we know who to invite.</p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold">Contact Name</label>
            <input
              className={field}
              value={form.contactName}
              onChange={(e) => setForm({ ...form, contactName: e.target.value })}
              placeholder="Owner or manager"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold">
              Email <span className="text-primary">*</span>
            </label>
            <input
              className={field}
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="name@business.com"
            />
            {touched && !emailValid && (
              <p className="text-xs text-destructive">Add a valid email so the invite reaches them.</p>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold">Business Type</label>
            <select
              className={field}
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              {BUSINESS_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground">
              Support Type: {METHOD_TYPE_META[supportType].label}
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold">Town / Location</label>
            <input
              className={field}
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="e.g. West Chester"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold">
            Optional Note <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <textarea
            className="min-h-20 w-full rounded-xl border border-border bg-card p-4 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring/30"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="Add a personal message to your invitation…"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold">
            Proposed Terms <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <textarea
            className="min-h-16 w-full rounded-xl border border-border bg-card p-4 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring/30"
            value={form.proposedTerms}
            onChange={(e) => setForm({ ...form, proposedTerms: e.target.value })}
            placeholder="e.g. 15% of dine-in sales between 5–9pm; exclude alcohol…"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            onClick={submit}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-dark active:scale-95"
          >
            <Send className="size-4" />
            Add to Invite List
          </button>
          <span className="text-xs text-muted-foreground">
            This creates an invitation — it doesn’t mean they’ve accepted yet.
          </span>
        </div>
      </div>
    </div>
  );
}

export function ActionBar({
  backLabel,
  onBack,
  meta,
  nextLabel,
  nextDisabled,
  onNext,
}: {
  backLabel: string;
  onBack: () => void;
  meta?: string;
  nextLabel: string;
  nextDisabled?: boolean;
  onNext: () => void;
}) {
  return (
    <footer className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4 sm:px-6">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {backLabel}
        </button>

        <div className="flex items-center gap-4">
          {meta && <span className="hidden text-sm text-muted-foreground sm:inline">{meta}</span>}
          <button
            onClick={onNext}
            disabled={nextDisabled}
            className="inline-flex items-center gap-2 rounded-full bg-primary py-2.5 pl-5 pr-4 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary-dark active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-primary"
          >
            {nextLabel}
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    </footer>
  );
}
