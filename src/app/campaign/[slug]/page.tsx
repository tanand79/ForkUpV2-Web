import CampaignPageClient from "./CampaignPageClient";
import type { CampaignDetail } from "@/lib/campaign-types";

async function fetchCampaignServer(slug: string): Promise<CampaignDetail | null> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  try {
    const res = await fetch(`${base}/api/campaigns/${encodeURIComponent(slug)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as CampaignDetail;
  } catch {
    return null;
  }
}

/**
 * Single catch-all shell for all campaign slugs. Apache serves this HTML for any
 * `/campaign/{slug}/` URL; the client reads the slug from the browser path and
 * fetches live data — so new campaigns work without rebuilding the static site.
 */
export async function generateStaticParams() {
  return [{ slug: "_" }];
}

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = await params;
  const slug = rawSlug === "_" ? "" : decodeURIComponent(rawSlug);
  const initialCampaign = slug ? await fetchCampaignServer(slug) : null;

  return <CampaignPageClient initialCampaign={initialCampaign} />;
}
