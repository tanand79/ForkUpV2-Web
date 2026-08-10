export type CampaignStatus =
  | "draft"
  | "in_review"
  | "invitation_phase"
  | "ready_to_launch"
  | "live"
  | "closed"
  | "settlement";

/** Re-export financial types — business giveback vs online donations stay separate. */
export type {
  GivebackFinancialBreakdown,
  OnlineDonationRecord,
} from "@/lib/platform-config";

export interface CampaignListItem {
  slug: string;
  name: string;
  nonprofit: string;
  nonprofitVerified: boolean;
  image: string;
  dateRange: string;
  raised: number;
  goal: number;
  supportersGoing: number;
  expectedGuests: number;
  verifiedVisits: number;
  topEvent: boolean;
  campaignStatus: CampaignStatus;
  participatingLocationCount: number;
}

export interface CampaignMethod {
  id: number;
  methodType: string;
  methodName: string;
  methodStatus: string;
  requiresBusinessAcceptance: boolean;
}

export interface ParticipatingLocation {
  businessId: number;
  locationId: number;
  methodId: number;
  businessName: string;
  businessType: string;
  locationName: string;
  city: string;
  state: string;
  givebackPercentage: number;
  participationHours: string | null;
  participationMethod: string;
  cta: "reserve" | "visit" | "shop" | "book" | "attend";
  reservationUrl: string | null;
  acceptanceStatus: string;
}

export interface CampaignDetail extends CampaignListItem {
  description: string;
  methods: CampaignMethod[];
  participatingLocations: ParticipatingLocation[];
  /** Guest Bartending event date (YYYY-MM-DD) from public API. Additive; optional for older payloads. */
  eventDate?: string | null;
}

/** Public donation row for campaign page feed. */
export interface CampaignDonation {
  donorName: string;
  amount: number;
  createdAt: string;
  anonymous: boolean;
}

export interface CampaignDonationsResponse {
  totalCount: number;
  donations: CampaignDonation[];
}

/** Public campaign leaderboard row — Top Fundraisers. */
export interface CampaignLeaderboardFundraiser {
  name: string;
  raised: number;
  donationCount: number;
}

/** Public campaign leaderboard row — Top Donors. */
export interface CampaignLeaderboardDonor {
  donorName: string;
  totalAmount: number;
  donationCount: number;
  anonymous: boolean;
}

/**
 * Response for GET /api/campaigns/:slug/leaderboard
 * Inputs: fundraisersLimit?, donorsLimit?
 * Outputs: ranked lists + totals for View-all expand
 */
export interface CampaignLeaderboardResponse {
  fundraisers: CampaignLeaderboardFundraiser[];
  donors: CampaignLeaderboardDonor[];
  fundraisersTotalCount: number;
  donorsTotalCount: number;
}
