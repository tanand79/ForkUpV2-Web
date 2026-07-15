import { assetSrc } from "@/lib/utils";
import restaurant from "@/assets/campaign-restaurant.jpg";
import animals from "@/assets/campaign-animals.jpg";
import arts from "@/assets/campaign-arts.jpg";
import foodbank from "@/assets/campaign-foodbank.jpg";
import market from "@/assets/campaign-market.jpg";
import sports from "@/assets/campaign-sports.jpg";
import library from "@/assets/campaign-library.jpg";
import environment from "@/assets/campaign-environment.jpg";
import seniors from "@/assets/campaign-seniors.jpg";
import coffee from "@/assets/campaign-coffee.jpg";
import heroCampaign from "@/assets/hero-campaign.jpg";

const BY_FILENAME: Record<string, string> = {
  "campaign-restaurant.jpg": assetSrc(restaurant),
  "campaign-animals.jpg": assetSrc(animals),
  "campaign-arts.jpg": assetSrc(arts),
  "campaign-foodbank.jpg": assetSrc(foodbank),
  "campaign-market.jpg": assetSrc(market),
  "campaign-sports.jpg": assetSrc(sports),
  "campaign-library.jpg": assetSrc(library),
  "campaign-environment.jpg": assetSrc(environment),
  "campaign-seniors.jpg": assetSrc(seniors),
  "campaign-coffee.jpg": assetSrc(coffee),
  "/placeholder-cover.jpg": assetSrc(heroCampaign),
  "placeholder-cover.jpg": assetSrc(heroCampaign),
};

/** Resolve API cover_image_url to a browser-loadable src. */
export function resolveCampaignImage(image: string | null | undefined): string {
  if (!image?.trim()) return assetSrc(heroCampaign);
  const trimmed = image.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("/assets/")) return trimmed;
  const key = trimmed.replace(/^\//, "");
  return BY_FILENAME[key] ?? BY_FILENAME[trimmed] ?? assetSrc(heroCampaign);
}
