import {
  ShieldCheck,
  Building2,
  HeartHandshake,
  Plus,
  Pencil,
  BadgeCheck,
  Send,
  GitMerge,
  Link2,
  Lock,
} from "lucide-react";

/**
 * ⚠️ DESIGN MODE reference — Admin / Data Setup: Preload Nonprofits & Businesses.
 *
 * Admin Only — Hidden From Public Users.
 *
 * Backend admin-only function for ForkUp to preload nonprofit and local
 * business profiles BEFORE public users claim or create their accounts. This
 * mirrors the public Nonprofit Claim / Business Claim flows, but is the
 * admin-side version. Public users may later CLAIM a preloaded profile instead
 * of creating a duplicate.
 *
 * This module is not exposed in public navigation and is reachable only from
 * Design Mode. It exists so the V1 architecture clearly shows where profile
 * preloading connects to claim flows, invitations, and campaign creation.
 */

type Status = "Unclaimed" | "Claimed" | "Verified" | "Needs Review";

const STATUS_META: Record<Status, string> = {
  Unclaimed:
    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  Claimed:
    "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  Verified:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  "Needs Review":
    "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
};

const NONPROFIT_FIELDS = [
  "Organization name",
  "Contact person",
  "Email",
  "Phone",
  "Address / service area",
  "Website",
  "Logo",
  "Mission / description",
  "EIN or verification fields",
  "Category / cause type",
];

const BUSINESS_FIELDS = [
  "Business name",
  "Contact person",
  "Email",
  "Phone",
  "Address",
  "Website",
  "Business type (Restaurant, Retail, Service, Salon, Fitness, Other)",
  "Logo / photo",
  "Description",
  "Booking / reservation / website URL",
  "Default giveback percentage",
  "Notes",
];

const ADMIN_ACTIONS: { icon: typeof Plus; label: string; note: string }[] = [
  { icon: Plus, label: "Create preloaded profile", note: "Add a new unclaimed profile." },
  { icon: Pencil, label: "Edit preloaded profile", note: "Update details before claim." },
  { icon: BadgeCheck, label: "Mark as verified", note: "Confirm authenticity." },
  { icon: Send, label: "Send claim invite", note: "Invite the owner to claim it." },
  { icon: GitMerge, label: "Merge duplicate profiles", note: "Combine duplicates into one." },
  { icon: Link2, label: "Connect profile to a campaign", note: "Attach to an active campaign." },
];

const SAMPLE: { name: string; type: string; kind: "Business" | "Nonprofit"; status: Status }[] = [
  { name: "Sovana Bistro", type: "Restaurant", kind: "Business", status: "Unclaimed" },
  { name: "Loaf & Bloom", type: "Bakery", kind: "Business", status: "Verified" },
  { name: "Paper & Pine", type: "Retail", kind: "Business", status: "Needs Review" },
  { name: "West Chester Food Cupboard", type: "Hunger Relief", kind: "Nonprofit", status: "Unclaimed" },
  { name: "Bright Futures Foundation", type: "Education", kind: "Nonprofit", status: "Claimed" },
];

function FieldList({ fields }: { fields: string[] }) {
  return (
    <ul className="mt-3 grid gap-1.5 text-sm text-muted-foreground sm:grid-cols-2">
      {fields.map((f) => (
        <li key={f} className="flex items-start gap-1.5">
          <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" />
          {f}
        </li>
      ))}
    </ul>
  );
}

export function AdminPreload() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Design placeholder
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-rose-800 dark:bg-rose-950 dark:text-rose-300">
          <Lock className="size-3" />
          Admin Only — Hidden From Public Users
        </span>
      </div>

      <h1 className="mt-4 flex items-center gap-2 text-3xl font-extrabold tracking-tight">
        <ShieldCheck className="size-7 text-primary" />
        Preload Nonprofits &amp; Businesses
      </h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        An internal ForkUp admin workflow to preload nonprofit and local
        business profiles before public users claim or create accounts. This
        mirrors the public claim flows, but is the admin-side version — owners
        later <strong>claim</strong> an existing profile instead of creating a
        duplicate.
      </p>

      <div className="mt-5 rounded-2xl border border-border bg-secondary/40 p-4 text-sm">
        <p className="font-semibold">Example</p>
        <p className="mt-1 text-muted-foreground">
          ForkUp Admin preloads <strong>Sovana Bistro</strong>. Later, the
          Sovana owner receives an invite and claims the existing profile
          instead of creating a duplicate. The same applies to nonprofits.
        </p>
      </div>

      {/* Profile statuses */}
      <section className="mt-8">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Profile statuses
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(STATUS_META) as Status[]).map((s) => (
            <span
              key={s}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_META[s]}`}
            >
              {s}
            </span>
          ))}
        </div>
      </section>

      {/* Field schemas */}
      <section className="mt-8 grid gap-4">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-base font-bold">
            <HeartHandshake className="size-5 text-primary" />
            Nonprofit fields
            <span className="ml-auto text-xs font-medium text-muted-foreground">
              mirrors Nonprofit Claim / Create Profile
            </span>
          </div>
          <FieldList fields={NONPROFIT_FIELDS} />
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-base font-bold">
            <Building2 className="size-5 text-primary" />
            Business fields
            <span className="ml-auto text-xs font-medium text-muted-foreground">
              mirrors Business Claim / Create Profile
            </span>
          </div>
          <FieldList fields={BUSINESS_FIELDS} />
        </div>
      </section>

      {/* Admin actions */}
      <section className="mt-8">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Admin actions
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {ADMIN_ACTIONS.map(({ icon: Icon, label, note }) => (
            <div key={label} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Icon className="size-4 text-primary" />
                {label}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Preloaded profiles preview */}
      <section className="mt-8">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Preloaded profiles (preview)
        </h2>
        <div className="mt-3 overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-semibold">Name</th>
                <th className="px-4 py-2 font-semibold">Type</th>
                <th className="px-4 py-2 font-semibold">Kind</th>
                <th className="px-4 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE.map((row) => (
                <tr key={row.name} className="border-t border-border">
                  <td className="px-4 py-2.5 font-medium">{row.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{row.type}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{row.kind}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_META[row.status]}`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mt-8 rounded-2xl border border-dashed border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
        Connects conceptually to: Nonprofit Claim / Create Profile, Business
        Claim / Create Profile, Business Invitations, and Campaign Creation.
        Profile preloading is part of V1 architecture and is never exposed in
        public-facing navigation.
      </p>
    </main>
  );
}
