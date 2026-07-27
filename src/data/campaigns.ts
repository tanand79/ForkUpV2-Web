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
 * Selected entries are also flagged as Success Stories.
 */
export const pastCampaigns: Campaign[] = [
  {
    slug: "headstrong-sovana-bistro",
    name: "Dinner for a Cause",
    nonprofit: "Headstrong Foundation",
    image: "/assets/campaign-restaurant.jpg",
    dateRange: "Mar 3 – Mar 17",
    raised: 4820,
    goal: 4500,
    supporters: 132,
    city: "Malvern, PA",
    status: "past",
    finalStatus: "Completed",
    description:
      "A two-week dining campaign with Sovana Bistro and neighbors that funded support programs for families affected by cancer.",
    successStory: true,
    story:
      "Sovana Bistro opened its dining room for the cause and neighbors filled the tables night after night. What started as a single restaurant partnership grew into a community moment.",
    impact:
      "Neighbors turned regular dinners into real support for families facing cancer.",
    businesses: [
      { name: "Sovana Bistro", initials: "SB", color: "hsl(18 70% 55%)" },
      { name: "Main Line Coffee", initials: "MC", color: "hsl(28 60% 45%)" },
      { name: "Anthony's", initials: "AN", color: "hsl(0 60% 50%)" },
    ],
  },
  {
    slug: "wc-youth-lacrosse-spring",
    name: "Spring Season Kickoff",
    nonprofit: "West Chester Youth Lacrosse",
    image: "/assets/campaign-sports.jpg",
    dateRange: "Feb 10 – Feb 24",
    raised: 2915,
    goal: 3000,
    supporters: 87,
    city: "West Chester, PA",
    status: "past",
    finalStatus: "Completed",
    description:
      "Local families and two neighborhood spots teamed up to cover equipment and scholarships so every kid could play.",
    successStory: true,
    story:
      "Two local businesses put out the call and lacrosse families answered. The season started with new gear for kids who might otherwise have sat out.",
    impact:
      "Every player who needed gear or a scholarship got onto the field this season.",
    businesses: [
      { name: "Side Bar", initials: "SB", color: "hsl(200 55% 45%)" },
      { name: "Split Rail", initials: "SR", color: "hsl(30 60% 45%)" },
    ],
  },
  {
    slug: "harvest-food-pantry",
    name: "Harvest Give-Back",
    nonprofit: "Chester County Food Pantry",
    image: "/assets/campaign-foodbank.jpg",
    dateRange: "Nov 1 – Nov 15",
    raised: 16240,
    goal: 15000,
    supporters: 398,
    city: "Downingtown, PA",
    status: "past",
    finalStatus: "Completed",
    description:
      "A fall dining and grocery campaign that stocked the pantry through the holidays.",
    businesses: [
      { name: "Harvest Table", initials: "HT", color: "hsl(90 45% 40%)" },
      { name: "Baker's Dozen", initials: "BD", color: "hsl(35 60% 50%)" },
      { name: "Green Bowl", initials: "GB", color: "hsl(140 55% 40%)" },
    ],
  },
];

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
