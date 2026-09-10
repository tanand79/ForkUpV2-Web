/**
 * SuperAdminDirectory — v1 admin parity tabs (list/view) appended to Super Admin.
 *
 * Purpose: Users, Roles, Nonprofits, Businesses (+ ACH summary), Campaigns,
 * Fundraisers, Donations, and Overview counts. Does not remove existing tabs.
 * Users tab also supports delete of non-platform-admin accounts (confirm dialog).
 *
 * Inputs: Super Admin bearer session via existing fetch helpers.
 * Outputs: searchable tables; Businesses expand locations for ACH status.
 */
"use client";

import { useCallback, useEffect, useState, Fragment } from "react";
import { ChevronDown, ChevronRight, Eye, Loader2, Search, Trash2 } from "lucide-react";
import {
  deleteSuperAdminLiveCampaign,
  deleteSuperAdminUser,
  fetchSuperAdminBusinesses,
  fetchSuperAdminCampaigns,
  fetchSuperAdminDonations,
  fetchSuperAdminFundraisers,
  fetchSuperAdminNonprofits,
  fetchSuperAdminOverview,
  fetchSuperAdminRoles,
  fetchSuperAdminUsers,
  type SuperAdminBusinessRow,
  type SuperAdminCampaignRow,
  type SuperAdminDonationRow,
  type SuperAdminFundraiserRow,
  type SuperAdminNonprofitRow,
  type SuperAdminOverview,
  type SuperAdminRoleRow,
  type SuperAdminDirectoryUser,
} from "@/lib/api";
import { netAfterPlatformFee } from "@/lib/platform-config";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const fieldClass =
  "w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20";
const tableWrap = "overflow-x-auto rounded-2xl border border-border";
const th = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground";
const td = "px-3 py-2.5 text-sm text-foreground";

function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative max-w-sm">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${fieldClass} pl-9`}
      />
    </div>
  );
}

function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-8 text-center text-sm text-muted-foreground">
        {message}
      </td>
    </tr>
  );
}

export function SuperAdminOverviewTab() {
  const [data, setData] = useState<SuperAdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchSuperAdminOverview()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return null;

  const cards: { label: string; value: number }[] = [
    { label: "Users", value: data.users },
    { label: "Nonprofits", value: data.nonprofits },
    { label: "Businesses", value: data.businesses },
    { label: "Campaigns", value: data.campaigns },
    { label: "Fundraisers", value: data.fundraisers },
    { label: "Donations", value: data.donations },
  ];

  return (
    <div>
      <h2 className="text-lg font-semibold">Platform overview</h2>
      <p className="mt-1 text-sm text-muted-foreground">Counts across the live directory.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {c.label}
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SuperAdminUsersTab() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [rows, setRows] = useState<SuperAdminDirectoryUser[]>([]);
  const [roles, setRoles] = useState<SuperAdminRoleRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<number | null>(null);
  const [deleteUser, setDeleteUser] = useState<SuperAdminDirectoryUser | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        fetchSuperAdminUsers({ search: debounced || undefined, limit: 100 }),
        fetchSuperAdminRoles(),
      ]);
      setRows(usersRes.users);
      setTotal(usersRes.totalCount);
      setRoles(rolesRes.roles);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [debounced]);

  useEffect(() => {
    void load();
  }, [load]);

  const confirmDeleteUser = async () => {
    if (!deleteUser) return;
    setActingId(deleteUser.id);
    setError(null);
    try {
      await deleteSuperAdminUser(deleteUser.id);
      setDeleteUser(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Users &amp; roles</h2>
          <p className="text-sm text-muted-foreground">
            {total} users · non-admin accounts can be deleted
          </p>
        </div>
        <SearchBox value={search} onChange={setSearch} placeholder="Search email or name…" />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}

      {!loading && roles.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-card px-3 py-2.5">
              <p className="text-xs font-semibold text-muted-foreground">{r.roleName}</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums">{r.userCount}</p>
              <p className="text-xs text-muted-foreground">{r.description}</p>
            </div>
          ))}
        </div>
      )}

      <div className={tableWrap}>
        <table className="w-full min-w-[720px]">
          <thead className="border-b border-border bg-secondary/40">
            <tr>
              <th className={th}>ID</th>
              <th className={th}>Email</th>
              <th className={th}>Name</th>
              <th className={th}>Admin</th>
              <th className={th}>Memberships</th>
              <th className={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-10 text-center">
                  <Loader2 className="mx-auto size-5 animate-spin text-primary" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <EmptyRow colSpan={6} message="No users found." />
            ) : (
              rows.map((u) => (
                <tr key={u.id} className="border-b border-border/60 last:border-0">
                  <td className={td}>{u.id}</td>
                  <td className={td}>{u.email}</td>
                  <td className={td}>{u.fullName || u.username || "—"}</td>
                  <td className={td}>{u.isPlatformAdmin ? "Yes" : "—"}</td>
                  <td className={`${td} text-xs text-muted-foreground`}>
                    {u.memberships.length === 0
                      ? "—"
                      : u.memberships
                          .map((m) => `${m.organizationType}:${m.organizationId}/${m.role}`)
                          .join(", ")}
                  </td>
                  <td className={td}>
                    {u.isPlatformAdmin ? (
                      <span className="text-xs text-muted-foreground">Protected</span>
                    ) : (
                      <button
                        type="button"
                        disabled={actingId === u.id}
                        onClick={() => setDeleteUser(u)}
                        className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-800 disabled:opacity-40"
                      >
                        <Trash2 className="size-3.5" /> Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog
        open={deleteUser != null}
        onOpenChange={(open) => {
          if (!open) setDeleteUser(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete user account?</DialogTitle>
            <DialogDescription>
              This permanently removes{" "}
              <span className="font-semibold text-foreground">
                {deleteUser?.email ?? "this account"}
              </span>
              , their sessions, and related email records. Organizations and campaigns are kept.
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold"
              onClick={() => setDeleteUser(null)}
              disabled={actingId === deleteUser?.id}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={actingId === deleteUser?.id}
              onClick={() => void confirmDeleteUser()}
              className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
            >
              {actingId === deleteUser?.id ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
              Delete user
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function SuperAdminRolesTab() {
  return <SuperAdminUsersTab />;
}

export function SuperAdminNonprofitsTab() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [rows, setRows] = useState<SuperAdminNonprofitRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setLoading(true);
    void fetchSuperAdminNonprofits({ search: debounced || undefined, limit: 100 })
      .then((r) => {
        setRows(r.nonprofits);
        setTotal(r.totalCount);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [debounced]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Nonprofits</h2>
          <p className="text-sm text-muted-foreground">{total} total</p>
        </div>
        <SearchBox value={search} onChange={setSearch} placeholder="Search name, EIN, email…" />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className={tableWrap}>
        <table className="w-full min-w-[720px]">
          <thead className="border-b border-border bg-secondary/40">
            <tr>
              <th className={th}>Name</th>
              <th className={th}>Contact</th>
              <th className={th}>Location</th>
              <th className={th}>Verification</th>
              <th className={th}>Claim</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="py-10 text-center">
                  <Loader2 className="mx-auto size-5 animate-spin text-primary" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <EmptyRow colSpan={5} message="No nonprofits found." />
            ) : (
              rows.map((n) => (
                <tr key={n.id} className="border-b border-border/60 last:border-0">
                  <td className={td}>
                    <div className="font-medium">{n.organizationName}</div>
                    <div className="text-xs text-muted-foreground">{n.slug}</div>
                  </td>
                  <td className={td}>
                    <div>{n.contactName || "—"}</div>
                    <div className="text-xs text-muted-foreground">{n.contactEmail || ""}</div>
                  </td>
                  <td className={td}>
                    {[n.city, n.state].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className={td}>{n.verificationStatus || "—"}</td>
                  <td className={td}>{n.claimStatus || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SuperAdminBusinessesTab() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [rows, setRows] = useState<SuperAdminBusinessRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setLoading(true);
    void fetchSuperAdminBusinesses({ search: debounced || undefined, limit: 100 })
      .then((r) => {
        setRows(r.businesses);
        setTotal(r.totalCount);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [debounced]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Businesses</h2>
          <p className="text-sm text-muted-foreground">
            {total} total · expand a row for locations / ACH status
          </p>
        </div>
        <SearchBox value={search} onChange={setSearch} placeholder="Search business…" />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className={tableWrap}>
        <table className="w-full min-w-[720px]">
          <thead className="border-b border-border bg-secondary/40">
            <tr>
              <th className={th} />
              <th className={th}>Business</th>
              <th className={th}>Contact</th>
              <th className={th}>Status</th>
              <th className={th}>Locations</th>
              <th className={th}>ACH</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-10 text-center">
                  <Loader2 className="mx-auto size-5 animate-spin text-primary" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <EmptyRow colSpan={6} message="No businesses found." />
            ) : (
              rows.map((b) => {
                const open = openId === b.id;
                return (
                  <Fragment key={b.id}>
                    <tr className="border-b border-border/60">
                      <td className={td}>
                        <button
                          type="button"
                          className="rounded p-1 text-muted-foreground hover:bg-secondary"
                          onClick={() => setOpenId(open ? null : b.id)}
                          aria-label={open ? "Collapse" : "Expand"}
                        >
                          {open ? (
                            <ChevronDown className="size-4" />
                          ) : (
                            <ChevronRight className="size-4" />
                          )}
                        </button>
                      </td>
                      <td className={td}>
                        <div className="font-medium">{b.businessName}</div>
                        <div className="text-xs text-muted-foreground">{b.slug}</div>
                      </td>
                      <td className={td}>
                        <div>{b.contactName || "—"}</div>
                        <div className="text-xs text-muted-foreground">{b.contactEmail || ""}</div>
                      </td>
                      <td className={td}>{b.claimStatus || b.businessStatus || "—"}</td>
                      <td className={`${td} tabular-nums`}>{b.locationCount}</td>
                      <td className={`${td} tabular-nums`}>
                        {b.achLocationCount > 0 ? (
                          <span className="font-semibold text-emerald-700">
                            {b.achLocationCount} ready
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                    {open && (
                      <tr className="border-b border-border/60 bg-secondary/20">
                        <td colSpan={6} className="px-4 py-3">
                          {b.locations.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No locations.</p>
                          ) : (
                            <ul className="space-y-2">
                              {b.locations.map((loc) => (
                                <li
                                  key={loc.id}
                                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm"
                                >
                                  <div>
                                    <span className="font-medium">{loc.locationName}</span>
                                    <span className="text-muted-foreground">
                                      {" "}
                                      · {[loc.city, loc.state].filter(Boolean).join(", ") || "—"}
                                    </span>
                                  </div>
                                  <div className="text-xs">
                                    {loc.hasAchData ? (
                                      <span className="font-semibold text-emerald-700">
                                        ACH {loc.achBankName || "on file"} ····
                                        {loc.achAccountLast4 || "****"} (
                                        {loc.achAuthorizationStatus || "—"})
                                        {loc.hasSignature ? " · signed" : ""}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground">No ACH</span>
                                    )}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SuperAdminCampaignsDirectoryTab() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<SuperAdminCampaignRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [deleteSlug, setDeleteSlug] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchSuperAdminCampaigns({
        search: debounced || undefined,
        status: status || undefined,
        limit: 100,
      });
      setRows(r.campaigns);
      setTotal(r.totalCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [debounced, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const confirmDelete = async () => {
    if (!deleteSlug) return;
    setActing(deleteSlug);
    setError(null);
    try {
      await deleteSuperAdminLiveCampaign(deleteSlug);
      setDeleteSlug(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete campaign");
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Campaigns</h2>
          <p className="text-sm text-muted-foreground">
            {total} total · filter by status · live rows can be viewed or deleted
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={fieldClass}
          >
            <option value="">All statuses</option>
            <option value="draft">draft</option>
            <option value="in_review">in_review</option>
            <option value="invitation_phase">invitation_phase</option>
            <option value="ready_to_launch">ready_to_launch</option>
            <option value="live">live only</option>
            <option value="closed">closed</option>
            <option value="settlement">settlement</option>
          </select>
          <SearchBox value={search} onChange={setSearch} placeholder="Search campaigns…" />
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className={tableWrap}>
        <table className="w-full min-w-[800px]">
          <thead className="border-b border-border bg-secondary/40">
            <tr>
              <th className={th}>Campaign</th>
              <th className={th}>Nonprofit</th>
              <th className={th}>Status</th>
              <th className={th}>Raised / Goal</th>
              <th className={th}>Dates</th>
              <th className={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-10 text-center">
                  <Loader2 className="mx-auto size-5 animate-spin text-primary" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <EmptyRow colSpan={6} message="No campaigns found." />
            ) : (
              rows.map((c) => (
                <tr key={c.id} className="border-b border-border/60 last:border-0">
                  <td className={td}>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.slug}</div>
                  </td>
                  <td className={td}>{c.nonprofit || "—"}</td>
                  <td className={td}>{c.status || "—"}</td>
                  <td className={`${td} tabular-nums`}>
                    ${netAfterPlatformFee(c.raised).toLocaleString()}
                    {c.goal != null ? ` / $${c.goal.toLocaleString()}` : ""}
                  </td>
                  <td className={`${td} text-xs text-muted-foreground`}>
                    {[c.startDate, c.endDate].filter(Boolean).join(" → ") || "—"}
                  </td>
                  <td className={td}>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          window.open(
                            `/campaign/${encodeURIComponent(c.slug)}`,
                            "_blank",
                            "noopener,noreferrer",
                          )
                        }
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-semibold"
                      >
                        <Eye className="size-3.5" /> View
                      </button>
                      {c.status === "live" && (
                        <button
                          type="button"
                          disabled={acting === c.slug}
                          onClick={() => setDeleteSlug(c.slug)}
                          className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-800 disabled:opacity-40"
                        >
                          <Trash2 className="size-3.5" /> Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog
        open={deleteSlug != null}
        onOpenChange={(open) => {
          if (!open) setDeleteSlug(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete live campaign?</DialogTitle>
            <DialogDescription>
              This permanently removes{" "}
              <span className="font-semibold text-foreground">
                {rows.find((r) => r.slug === deleteSlug)?.name ?? deleteSlug}
              </span>{" "}
              and related data. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold"
              onClick={() => setDeleteSlug(null)}
              disabled={acting === deleteSlug}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={acting === deleteSlug}
              onClick={() => void confirmDelete()}
              className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
            >
              {acting === deleteSlug ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
              Delete permanently
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function SuperAdminFundraisersTab() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [rows, setRows] = useState<SuperAdminFundraiserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setLoading(true);
    void fetchSuperAdminFundraisers({ search: debounced || undefined, limit: 100 })
      .then((r) => {
        setRows(r.fundraisers);
        setTotal(r.totalCount);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [debounced]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Fundraisers</h2>
          <p className="text-sm text-muted-foreground">{total} linked via campaigns</p>
        </div>
        <SearchBox value={search} onChange={setSearch} placeholder="Search fundraiser…" />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className={tableWrap}>
        <table className="w-full min-w-[560px]">
          <thead className="border-b border-border bg-secondary/40">
            <tr>
              <th className={th}>Name</th>
              <th className={th}>Email</th>
              <th className={th}>Campaigns</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="py-10 text-center">
                  <Loader2 className="mx-auto size-5 animate-spin text-primary" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <EmptyRow colSpan={4} message="No fundraisers found." />
            ) : (
              rows.map((f) => (
                <tr key={f.id} className="border-b border-border/60 last:border-0">
                  <td className={td}>{f.fullName || "—"}</td>
                  <td className={td}>{f.email}</td>
                  <td className={`${td} tabular-nums`}>{f.campaignCount}</td>
                  <td className={td}>{f.status || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SuperAdminDonationsTab() {
  const [rows, setRows] = useState<SuperAdminDonationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchSuperAdminDonations({ limit: 100 })
      .then((r) => {
        setRows(r.donations);
        setTotal(r.totalCount);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Donations</h2>
        <p className="text-sm text-muted-foreground">{total} total · latest 100</p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className={tableWrap}>
        <table className="w-full min-w-[640px]">
          <thead className="border-b border-border bg-secondary/40">
            <tr>
              <th className={th}>ID</th>
              <th className={th}>Campaign</th>
              <th className={th}>Amount</th>
              <th className={th}>Type</th>
              <th className={th}>Status</th>
              <th className={th}>Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-10 text-center">
                  <Loader2 className="mx-auto size-5 animate-spin text-primary" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <EmptyRow colSpan={6} message="No donations yet." />
            ) : (
              rows.map((d) => (
                <tr key={d.id} className="border-b border-border/60 last:border-0">
                  <td className={td}>{d.id}</td>
                  <td className={td}>{d.campaignName || d.campaignSlug || "—"}</td>
                  <td className={`${td} tabular-nums`}>${d.amount.toLocaleString()}</td>
                  <td className={td}>{d.donationType || "—"}</td>
                  <td className={td}>{d.paymentStatus || "—"}</td>
                  <td className={`${td} text-xs text-muted-foreground`}>
                    {d.createdAt ? new Date(d.createdAt).toLocaleString() : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
