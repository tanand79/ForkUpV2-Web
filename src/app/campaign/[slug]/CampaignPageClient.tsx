"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchCampaign } from "@/lib/api";
import type { CampaignDetail } from "@/lib/campaign-types";
import { PublicCampaignView } from "@/components/campaign/PublicCampaignView";
import { PublicCampaignSkeleton } from "@/components/campaign/PublicCampaignSkeleton";
import { HeaderPillLink, SiteHeader } from "@/components/campaign/SiteHeader";
import { ArrowLeft } from "lucide-react";

function slugFromPathname(pathname: string): string {
  const match = pathname.match(/\/campaign\/([^/]+)/);
  const raw = match?.[1] ?? "";
  if (!raw || raw === "_") return "";
  return decodeURIComponent(raw);
}

/** Static Apache hosts rewrite to /campaign/_/index.html — read slug from the URL bar. */
function useCampaignSlugFromUrl(): string {
  const [slug, setSlug] = useState(() =>
    typeof window !== "undefined" ? slugFromPathname(window.location.pathname) : "",
  );

  useEffect(() => {
    const read = () => setSlug(slugFromPathname(window.location.pathname));
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);

  return slug;
}

function CampaignPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader
        trailing={
          <>
            <span className="hidden text-sm font-semibold text-foreground sm:inline">Campaign</span>
            <HeaderPillLink href="/?step=campaign-directory">
              <ArrowLeft className="size-3.5" />
              Back to campaigns
            </HeaderPillLink>
            <HeaderPillLink href="/">
              <ArrowLeft className="size-3.5" />
              Back to home
            </HeaderPillLink>
          </>
        }
      />
      <div className="mx-auto max-w-3xl px-5 py-16">{children}</div>
    </div>
  );
}

export default function CampaignPageClient({
  initialCampaign = null,
}: {
  initialCampaign?: CampaignDetail | null;
}) {
  const slug = useCampaignSlugFromUrl();

  const { data: campaign, isPending, isError } = useQuery({
    queryKey: ["campaigns", slug],
    queryFn: () => fetchCampaign(slug),
    enabled: Boolean(slug),
    initialData: initialCampaign ?? undefined,
    staleTime: 30_000,
  });

  if (!slug) {
    return (
      <CampaignPageShell>
        <p className="text-muted-foreground">Select a campaign from the directory.</p>
        <Link href="/?step=campaign-directory" className="mt-4 inline-block text-primary underline">
          Browse live campaigns
        </Link>
      </CampaignPageShell>
    );
  }

  if (isPending && !campaign) {
    return <PublicCampaignSkeleton />;
  }

  if (isError || !campaign) {
    return (
      <CampaignPageShell>
        <p className="text-destructive">Campaign not found.</p>
        <Link href="/?step=campaign-directory" className="mt-4 inline-block text-primary underline">
          Browse live campaigns
        </Link>
      </CampaignPageShell>
    );
  }

  return <PublicCampaignView campaign={campaign} />;
}
