"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { useCampaign } from "@/lib/campaign-context";

/**
 * Old guided/advanced mode picker — hidden from the primary AI create flow.
 * Any deep link resumes a draft or starts the new AI campaign flow (once).
 */
export function ChooseOrganizerMode() {
  const { update, hasDraft, resumeDraft, startNewCampaign } = useCampaign();
  const kickedOff = useRef(false);

  useEffect(() => {
    if (kickedOff.current) return;
    kickedOff.current = true;
    update({ organizerMode: "guided" });
    if (hasDraft) resumeDraft();
    else startNewCampaign();
  }, [update, hasDraft, resumeDraft, startNewCampaign]);

  return (
    <main className="mx-auto flex min-h-[40vh] max-w-2xl flex-col items-center justify-center px-5 py-10">
      <Loader2 className="size-6 animate-spin text-primary" />
      <p className="mt-3 text-sm text-muted-foreground">Starting your campaign…</p>
    </main>
  );
}
