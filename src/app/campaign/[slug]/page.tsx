import CampaignPageClient from "./CampaignPageClient";

/**
 * Single catch-all shell for all campaign slugs. Static export (.htaccess) and
 * Amplify SSR (middleware) both route every `/campaign/{slug}/` here via the `_`
 * placeholder; the client reads the slug from the browser path and fetches live data.
 */
export async function generateStaticParams() {
  return [{ slug: "_" }];
}

export default function CampaignPage() {
  return <CampaignPageClient />;
}
