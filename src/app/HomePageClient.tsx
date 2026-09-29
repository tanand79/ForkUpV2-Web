"use client";

import { useSearchParams } from "next/navigation";
import { CampaignApp } from "@/components/campaign/CampaignApp";
import { stepFromSearchParams } from "@/lib/campaign-routes";

export default function HomePageClient() {
  const searchParams = useSearchParams();
  // SSR-safe: only ?step= from Next searchParams (no window reads).
  // Path-slug / Amplify fallbacks are corrected in CampaignProvider after mount.
  const initialStep = stepFromSearchParams(searchParams.get("step") ?? undefined);

  return <CampaignApp initialStep={initialStep} />;
}
