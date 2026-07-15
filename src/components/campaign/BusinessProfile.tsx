import { Building2, MapPin, Globe, Phone, Tag, History, BarChart3, ImageIcon, ExternalLink } from "lucide-react";
import { useCampaign } from "@/lib/campaign-context";

/**
 * ⚠️ DESIGN MODE placeholder — Business Profile.
 *
 * Opened when a nonprofit clicks "View Profile" on a business card. Used to
 * evaluate a business before inviting them. Real content (photos, description,
 * location, website, contact, support type, campaign history, insights) will be
 * designed and wired up later.
 *
 * "View Campaign" opens the canonical Public Campaign Page.
 */

const SECTIONS: { icon: typeof Building2; label: string; note: string }[] = [
  { icon: ImageIcon, label: "Photos", note: "Storefront, interior, and brand imagery." },
  { icon: Building2, label: "Description", note: "Who they are and what they offer." },
  { icon: MapPin, label: "Location", note: "Address and service area." },
  { icon: Globe, label: "Website", note: "Public site and social links." },
  { icon: Phone, label: "Contact Information", note: "Owner / manager contact." },
  { icon: Tag, label: "Support Type", note: "Dine & Donate, Shop & Donate, Service Giveback." },
  { icon: History, label: "Campaign History", note: "Past ForkUp participation." },
  { icon: BarChart3, label: "Business Insights", note: "Future analytics & performance." },
];

export function BusinessProfile() {
  const { goTo } = useCampaign();

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Design placeholder
        </span>
        {/* Business dashboard → View Campaign → Public Campaign Page */}
        <button
          onClick={() => goTo("campaign-page")}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold transition-colors hover:bg-secondary"
        >
          <ExternalLink className="size-4 text-primary" />
          View Campaign
        </button>
      </div>
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Business Profile</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        The screen a nonprofit opens to evaluate a business before inviting them
        to a fundraising method.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {SECTIONS.map(({ icon: Icon, label, note }) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Icon className="size-4 text-primary" />
              {label}
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">{note}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
