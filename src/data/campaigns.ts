import restaurant from "@/assets/campaign-restaurant.jpg";
import { assetSrc } from "@/lib/utils";
import animals from "@/assets/campaign-animals.jpg";
import arts from "@/assets/campaign-arts.jpg";
import foodbank from "@/assets/campaign-foodbank.jpg";
import market from "@/assets/campaign-market.jpg";
import sports from "@/assets/campaign-sports.jpg";
import library from "@/assets/campaign-library.jpg";
import environment from "@/assets/campaign-environment.jpg";
import seniors from "@/assets/campaign-seniors.jpg";
import coffee from "@/assets/campaign-coffee.jpg";

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
}

export const campaigns: Campaign[] = [
  {
    slug: "bayside-animal-rescue",
    name: "Dine for Paws",
    nonprofit: "Bayside Animal Rescue",
    image: assetSrc(animals),
    dateRange: "May 1 – May 14",
    raised: 12480,
    goal: 20000,
    supporters: 312,
    topEvent: true,
    city: "Bayside, CA",
    description:
      "Two weeks of dining out to fund medical care, shelter, and adoption services for rescued animals across the Bay Area.",
    businesses: [
      { name: "Olive & Oak", initials: "OO", color: "hsl(18 70% 60%)" },
      { name: "Harbor Coffee", initials: "HC", color: "hsl(28 60% 45%)" },
      { name: "Pier Pizza", initials: "PP", color: "hsl(0 70% 55%)" },
      { name: "The Garden", initials: "TG", color: "hsl(140 50% 45%)" },
    ],
  },
  {
    slug: "riverdale-youth-arts",
    name: "Spring Arts Drive",
    nonprofit: "Riverdale Youth Arts",
    image: assetSrc(arts),
    dateRange: "Apr 28 – May 12",
    raised: 8920,
    goal: 15000,
    supporters: 204,
    city: "Riverdale, NY",
    description:
      "Help us fund free art classes, supplies, and instructors for kids in our after-school program this summer.",
    businesses: [
      { name: "Maker Studio", initials: "MS", color: "hsl(280 60% 55%)" },
      { name: "Color Cafe", initials: "CC", color: "hsl(340 70% 60%)" },
      { name: "Brush & Co", initials: "BC", color: "hsl(200 60% 50%)" },
    ],
  },
  {
    slug: "greenleaf-food-bank",
    name: "Fill the Table",
    nonprofit: "GreenLeaf Food Bank",
    image: assetSrc(foodbank),
    dateRange: "May 5 – May 19",
    raised: 23150,
    goal: 30000,
    supporters: 587,
    topEvent: true,
    city: "Portland, OR",
    description:
      "Every meal at participating restaurants funds groceries for families facing food insecurity in our community.",
    businesses: [
      { name: "Farm Table", initials: "FT", color: "hsl(90 50% 40%)" },
      { name: "Sourdough Co", initials: "SC", color: "hsl(35 65% 50%)" },
      { name: "Green Bowl", initials: "GB", color: "hsl(140 60% 40%)" },
      { name: "Citrus Kitchen", initials: "CK", color: "hsl(45 80% 55%)" },
      { name: "Rye House", initials: "RH", color: "hsl(20 50% 40%)" },
    ],
  },
  {
    slug: "oak-street-restaurant-week",
    name: "Oak Street Restaurant Week",
    nonprofit: "Oak Street Neighborhood Trust",
    image: assetSrc(restaurant),
    dateRange: "May 10 – May 17",
    raised: 18760,
    goal: 25000,
    supporters: 421,
    city: "Austin, TX",
    description:
      "A week of dining experiences supporting local placemaking and small business grants on Oak Street.",
    businesses: [
      { name: "Lumen", initials: "LU", color: "hsl(220 50% 45%)" },
      { name: "Ember", initials: "EM", color: "hsl(15 75% 55%)" },
      { name: "Wildflour", initials: "WF", color: "hsl(35 60% 50%)" },
    ],
  },
  {
    slug: "saturday-market-give",
    name: "Saturday Market Give-Back",
    nonprofit: "Downtown Community Foundation",
    image: assetSrc(market),
    dateRange: "Every Sat in May",
    raised: 6420,
    goal: 10000,
    supporters: 178,
    city: "Madison, WI",
    description:
      "Shop the Saturday market and a portion of every vendor sale supports neighborhood revitalization.",
    businesses: [
      { name: "Riverbend Farm", initials: "RF", color: "hsl(120 40% 40%)" },
      { name: "Honey Hive", initials: "HH", color: "hsl(45 80% 55%)" },
      { name: "Bloom Co", initials: "BL", color: "hsl(330 60% 60%)" },
    ],
  },
  {
    slug: "kickoff-for-kids",
    name: "Kickoff for Kids",
    nonprofit: "United Youth Sports",
    image: assetSrc(sports),
    dateRange: "May 6 – May 20",
    raised: 14210,
    goal: 18000,
    supporters: 356,
    city: "Denver, CO",
    description:
      "Funding cleats, jerseys, and league fees so every kid can play, regardless of family income.",
    businesses: [
      { name: "Field House", initials: "FH", color: "hsl(140 50% 40%)" },
      { name: "Game Day Grill", initials: "GG", color: "hsl(0 70% 50%)" },
      { name: "Trail Tap", initials: "TT", color: "hsl(30 65% 45%)" },
    ],
  },
  {
    slug: "page-turner-week",
    name: "Page Turner Week",
    nonprofit: "Friends of the Public Library",
    image: assetSrc(library),
    dateRange: "May 12 – May 18",
    raised: 5340,
    goal: 8000,
    supporters: 142,
    city: "Brooklyn, NY",
    description:
      "A literary week with bookstores and cafes raising funds for new library programs and youth literacy.",
    businesses: [
      { name: "Inkwell Books", initials: "IB", color: "hsl(220 60% 35%)" },
      { name: "Chapter Cafe", initials: "CH", color: "hsl(25 60% 45%)" },
    ],
  },
  {
    slug: "plant-the-block",
    name: "Plant the Block",
    nonprofit: "GreenCity Initiative",
    image: assetSrc(environment),
    dateRange: "May 3 – May 17",
    raised: 9870,
    goal: 12000,
    supporters: 245,
    city: "Seattle, WA",
    description:
      "Two weeks of supporting local businesses to fund tree planting and community gardens across the city.",
    businesses: [
      { name: "Cedar Cafe", initials: "CC", color: "hsl(140 45% 40%)" },
      { name: "Mossy Bar", initials: "MB", color: "hsl(160 40% 35%)" },
      { name: "Fern & Co", initials: "FC", color: "hsl(120 50% 45%)" },
    ],
  },
  {
    slug: "elders-table",
    name: "Elders' Table",
    nonprofit: "Heritage Senior Services",
    image: assetSrc(seniors),
    dateRange: "May 8 – May 22",
    raised: 11320,
    goal: 16000,
    supporters: 289,
    city: "Minneapolis, MN",
    description:
      "Funding home-delivered meals, transportation, and community programs for seniors who live alone.",
    businesses: [
      { name: "Sunday Supper", initials: "SS", color: "hsl(20 65% 50%)" },
      { name: "Daisy Diner", initials: "DD", color: "hsl(50 75% 55%)" },
      { name: "The Hearth", initials: "TH", color: "hsl(0 50% 45%)" },
    ],
  },
  {
    slug: "morning-brew-give",
    name: "Morning Brew Give-Back",
    nonprofit: "Sunrise Mental Health Co-op",
    image: assetSrc(coffee),
    dateRange: "May 1 – May 31",
    raised: 7680,
    goal: 12000,
    supporters: 401,
    city: "Asheville, NC",
    description:
      "Every coffee bought at participating cafes funds free counseling sessions for community members.",
    businesses: [
      { name: "Daybreak Coffee", initials: "DC", color: "hsl(25 60% 45%)" },
      { name: "Slow Pour", initials: "SP", color: "hsl(35 50% 40%)" },
      { name: "Morning Glory", initials: "MG", color: "hsl(45 70% 55%)" },
      { name: "Beanstalk", initials: "BS", color: "hsl(120 40% 40%)" },
    ],
  },
];

export const getCampaign = (slug: string) => campaigns.find((c) => c.slug === slug);

export const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
