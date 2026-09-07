import { PublicCampaignSiteHeader } from "@/components/campaign/PublicCampaignSiteHeader";
import { Skeleton } from "@/components/ui/skeleton";

export function PublicCampaignSkeleton() {
  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-12">
      <PublicCampaignSiteHeader />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:py-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10">
          <div className="min-w-0">
            <Skeleton className="aspect-[16/10] w-full rounded-2xl" />
            <Skeleton className="mt-6 h-10 w-full max-w-xl" />
            <div className="mt-5 flex items-center gap-3">
              <Skeleton className="size-11 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
            <div className="mt-6 rounded-2xl border border-border bg-card p-5 lg:hidden">
              <Skeleton className="h-8 w-56" />
              <Skeleton className="mt-3 h-2 w-full rounded-full" />
              <Skeleton className="mt-5 h-11 w-full rounded-full" />
            </div>
            <div className="mt-10 space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[80%]" />
            </div>
          </div>

          <aside className="hidden lg:block">
            <div className="rounded-2xl border border-border bg-card p-6">
              <Skeleton className="h-8 w-56" />
              <Skeleton className="mt-3 h-2 w-full rounded-full" />
              <Skeleton className="mt-5 h-11 w-full rounded-full" />
              <Skeleton className="mt-2.5 h-11 w-full rounded-full" />
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
