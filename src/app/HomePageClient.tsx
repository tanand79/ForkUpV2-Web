"use client";

import { useSearchParams } from "next/navigation";
import { CampaignApp } from "@/components/campaign/CampaignApp";
import { stepFromSearchParams } from "@/lib/campaign-routes";

export default function HomePageClient() {
  const searchParams = useSearchParams();
  const initialStep = stepFromSearchParams(searchParams.get("step") ?? undefined);

  return <CampaignApp initialStep={initialStep} />;
}
