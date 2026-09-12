"use client";

/**
 * Pass 2 — shown after guest launch without signup.
 *
 * Purpose: Confirm the campaign is live and that a claim/manage email was sent.
 * Inputs: ?email= & ?slug= from goTo query (also campaign state slug).
 * Outputs: links to public campaign page and home.
 */
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Mail } from "lucide-react";
import { useCampaign } from "@/lib/campaign-context";
import { campaignPublicPath } from "@/lib/campaign-paths";

export function GuestLaunchSent() {
  const { goTo, state } = useCampaign();
  const params = useSearchParams();
  const email = useMemo(() => {
    const q = params.get("email")?.trim();
    return q || "";
  }, [params]);
  const slug = useMemo(() => {
    return params.get("slug")?.trim() || state.campaignSlug || "";
  }, [params, state.campaignSlug]);

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-5 py-12 text-center">
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10">
        <CheckCircle2 className="size-8 text-primary" />
      </div>
      <h1 className="font-display mt-6 text-3xl font-bold tracking-tight">
        Your campaign is live
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        No account was required to launch. We sent a private manage link
        {email ? (
          <>
            {" "}
            to <span className="font-semibold text-foreground">{email}</span>
          </>
        ) : null}
        .
      </p>
      <p className="mt-4 flex items-start gap-2 rounded-2xl border border-border bg-card p-4 text-left text-sm text-muted-foreground">
        <Mail className="mt-0.5 size-4 shrink-0 text-primary" />
        Open that email on this laptop or your phone to claim and manage the campaign.
        Don&apos;t forward the link — it proves ownership.
      </p>
      <div className="mt-8 flex flex-col gap-3">
        {slug ? (
          <a
            href={campaignPublicPath(slug)}
            className="inline-flex w-full items-center justify-center rounded-full bg-primary py-3.5 text-sm font-semibold text-primary-foreground"
          >
            View public campaign page
          </a>
        ) : null}
        <button
          type="button"
          onClick={() => goTo("website-landing")}
          className="inline-flex w-full items-center justify-center rounded-full border border-border py-3.5 text-sm font-semibold"
        >
          Back to home
        </button>
      </div>
    </main>
  );
}
