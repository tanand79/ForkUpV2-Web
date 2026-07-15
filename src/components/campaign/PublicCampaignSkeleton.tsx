import { ArrowLeft } from "lucide-react";
import { HeaderPillLink, SiteHeader } from "@/components/campaign/SiteHeader";
import { Skeleton } from "@/components/ui/skeleton";

export function PublicCampaignSkeleton() {
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

      <section className="relative border-b border-border bg-muted">
        <Skeleton className="mx-auto block h-[min(520px,70vh)] w-full max-w-5xl rounded-none" />
        <div className="absolute bottom-0 left-0 right-0 mx-auto max-w-3xl space-y-3 px-5 pb-8">
          <Skeleton className="h-3 w-48 bg-background/30" />
          <Skeleton className="h-10 w-full max-w-lg bg-background/30" />
          <Skeleton className="h-4 w-36 bg-background/30" />
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-5 py-10">
        <div className="rounded-2xl border border-border bg-card p-6">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="mt-2 h-4 w-52" />
          <Skeleton className="mt-4 h-2 w-full rounded-full" />
          <div className="mt-4 flex flex-wrap gap-4">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-28" />
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Skeleton className="h-10 w-28 rounded-full" />
            <Skeleton className="h-10 w-44 rounded-full" />
            <Skeleton className="h-10 w-24 rounded-full" />
          </div>
        </div>

        <section className="mt-10 space-y-3">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-[80%]" />
        </section>

        <section className="mt-10 space-y-4">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-full max-w-xl" />
          <div className="rounded-2xl border border-border bg-card p-5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-2 h-4 w-32" />
            <Skeleton className="mt-4 h-4 w-48" />
            <Skeleton className="mt-4 h-9 w-36 rounded-full" />
          </div>
        </section>
      </div>
    </div>
  );
}
