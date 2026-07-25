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

/**
 * Public discovery lists — no sample/dummy campaigns.
 * Live data comes from the API (Campaign Directory / landing).
 * Past / success lists stay empty until a real completed-campaign API is wired.
 */
export const campaigns: Campaign[] = [];

export const pastCampaigns: Campaign[] = [];

/** Curated Success Stories — empty until real completed campaigns are available. */
export const successStories: Campaign[] = pastCampaigns.filter((c) => c.successStory);

export const getCampaign = (slug: string) => campaigns.find((c) => c.slug === slug);

export const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
