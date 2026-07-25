"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useCampaign } from "@/lib/campaign-context";

/**
 * Old guided/advanced mode picker — hidden from the Lovable primary flow.
 * Any deep link redirects into Quick Start (Build Your Campaign).
 */
export function ChooseOrganizerMode() {
  const { update, goTo, hasDraft, resumeDraft } = useCampaign();

  useEffect(() => {
    update({ organizerMode: "guided" });
    if (hasDraft) resumeDraft();
    else goTo("quick-start");
  }, [update, goTo, hasDraft, resumeDraft]);

  return (
    <main className="mx-auto flex min-h-[40vh] max-w-2xl flex-col items-center justify-center px-5 py-10">
      <Loader2 className="size-6 animate-spin text-primary" />
      <p className="mt-3 text-sm text-muted-foreground">Starting your campaign…</p>
    </main>
  );
}
