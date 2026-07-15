export type CampaignStatus =
  | "draft"
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
}
