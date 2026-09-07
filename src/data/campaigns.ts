/**
 * Public discovery lists for Past Campaigns and Success Stories.
 * Live campaigns come from the API (Campaign Directory / landing).
 * Images use /public/assets paths so <img src> resolves in the browser.
 */

export interface Business {
  name: string;
  initials: string;
  color: string;
}

export interface Campaign {
  slug: string;
  name: string;
  nonprofit: string;
  image: string;
  dateRange: string;
  raised: number;
  goal: number;
  supporters: number;
  topEvent?: boolean;
  city: string;
  description: string;
  businesses: Business[];
  /** Discovery bucket. Defaults to "live" when omitted. */
  status?: string;
  /** Final status label shown on completed campaigns (e.g. "Completed"). */
  finalStatus?: string;
  /** Curated Success Story flag — a strong past campaign kept visible as proof. */
  successStory?: boolean;
  /** Short community-impact narrative for Success Story cards. */
  story?: string;
  /** Community-impact highlight (non-leaderboard framing). */
  impact?: string;
}

/** Live discovery list stays empty — live campaigns come from the API. */
export const campaigns: Campaign[] = [];

/**
 * Past Campaigns — completed campaigns with final results.
 * Fetched from API (`GET /api/campaigns?status=past`); no static fixtures.
 */
export const pastCampaigns: Campaign[] = [];

/** Curated Success Stories — strong past campaigns kept visible as proof. */
export const successStories: Campaign[] = pastCampaigns.filter((c) => c.successStory);

export const getCampaign = (slug: string) =>
  [...campaigns, ...pastCampaigns].find((c) => c.slug === slug);

export const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
