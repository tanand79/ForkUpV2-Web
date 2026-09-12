"use client";

/**
 * Pass 3 — shown after a guest (or signed-out) fundraiser sends an NPO invite.
 *
 * Purpose: Confirm the invite was emailed to the nonprofit's contact on file.
 * Inputs: ?email= (fundraiser), ?hint= (masked NPO email), ?name= (campaign).
 * Outputs: navigation home; no ownership claim here — NPO must accept.
 */
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Mail } from "lucide-react";
import { useCampaign } from "@/lib/campaign-context";

export function FundraiserInviteSent() {
  const { goTo } = useCampaign();
  const params = useSearchParams();
  const email = useMemo(() => params.get("email")?.trim() || "", [params]);
  const hint = useMemo(() => params.get("hint")?.trim() || "", [params]);
  const name = useMemo(() => params.get("name")?.trim() || "your campaign", [params]);

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-5 py-12 text-center">
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10">
        <CheckCircle2 className="size-8 text-primary" />
      </div>
      <h1 className="font-display mt-6 text-3xl font-bold tracking-tight">
        Invite sent
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        We emailed the nonprofit&apos;s contact on file about{" "}
        <span className="font-semibold text-foreground">{name}</span>
        {hint ? (
          <>
            {" "}
            ({hint})
          </>
        ) : null}
        .
      </p>
      <p className="mt-4 flex items-start gap-2 rounded-2xl border border-border bg-card p-4 text-left text-sm text-muted-foreground">
        <Mail className="mt-0.5 size-4 shrink-0 text-primary" />
        {email ? (
          <>
            We&apos;ll use <span className="font-semibold text-foreground">{email}</span>{" "}
            if they reply or need to reach you. Create an account later to manage
            accepted campaigns.
          </>
        ) : (
          <>
            Create an account later to manage campaigns once the nonprofit accepts.
          </>
        )}
      </p>
      <div className="mt-8 flex flex-col gap-3">
        <button
          type="button"
          onClick={() => goTo("website-landing")}
          className="inline-flex w-full items-center justify-center rounded-full bg-primary py-3.5 text-sm font-semibold text-primary-foreground"
        >
          Back to home
        </button>
      </div>
    </main>
  );
}
