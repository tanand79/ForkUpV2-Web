import {
  Building2,
  Heart,
  Image as ImageIcon,
  Link2,
  Mail,
  MapPin,
  ShieldCheck,
  Target,
} from "lucide-react";

/**
 * ⚠️ DESIGN MODE — REFERENCE PLACEHOLDER.
 *
 * Nonprofit Profile. A reusable nonprofit asset — independent of any single
 * campaign. The profile is created/claimed once and then referenced by every
 * campaign the nonprofit runs. This placeholder documents the intended fields
 * so the full V1 product map shows the profile as a standalone building block.
 */

const FIELDS: { icon: typeof Building2; label: string; note?: string }[] = [
  { icon: Building2, label: "Organization name" },
  { icon: ShieldCheck, label: "501(c)(3) / EIN verification" },
  { icon: Heart, label: "Mission statement" },
  { icon: Target, label: "Cause / impact focus" },
  { icon: MapPin, label: "Location / service area" },
  { icon: ImageIcon, label: "Logo & brand imagery" },
  { icon: Mail, label: "Primary contact" },
  { icon: Link2, label: "Website & social links" },
];

const CONNECTIONS = [
  "Nonprofit Claim / Create Profile",
  "Campaign Builder",
  "Public Campaign Page",
  "Reporting & Settlement",
];

export function NonprofitProfile() {
  return (
    <main className="mx-auto max-w-4xl px-5 py-10 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-primary">
          Reusable Profile Asset
        </span>
      </div>
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight">
        Nonprofit Profile
      </h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        A reusable nonprofit asset that exists independently of any single
        campaign. Created or claimed once, then referenced by every campaign the
        organization runs — not part of building an individual campaign.
      </p>

      <section className="mt-8 grid gap-3 sm:grid-cols-2">
        {FIELDS.map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
          >
            <Icon className="size-5 shrink-0 text-primary" />
            <span className="text-sm font-medium">{label}</span>
          </div>
        ))}
      </section>

      <section className="mt-10 rounded-2xl border border-amber-300/60 bg-amber-50/60 p-5 dark:border-amber-400/30 dark:bg-amber-950/30">
        <h2 className="text-sm font-bold text-amber-900 dark:text-amber-200">
          Connects to
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {CONNECTIONS.map((c) => (
            <span
              key={c}
              className="rounded-full border border-amber-300/60 bg-white/70 px-3 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
            >
              {c}
            </span>
          ))}
        </div>
      </section>
    </main>
  );
}
