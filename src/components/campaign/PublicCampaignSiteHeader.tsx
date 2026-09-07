import { SiteHeader } from "@/components/campaign/SiteHeader";

/**
 * Purpose: Donor-facing header for /campaign/{slug}/ — logo only, no internal app navigation.
 * Inputs: none. Outputs: sticky header with ForkUp logo linking to the public landing page.
 */
export function PublicCampaignSiteHeader() {
  return <SiteHeader logoHref="/?step=website-landing" trailing={null} />;
}
