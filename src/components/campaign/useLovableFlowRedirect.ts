"use client";

import { useEffect } from "react";
import { useCampaign } from "@/lib/campaign-context";

/**
 * Soft-redirect legacy builder screens (methods / details / media) into the
 * Lovable flow. Old components are kept for Design Mode; production navigation
 * never stays on them.
 *
 * Inputs: none (reads campaign state).
 * Output: navigates to quick-start or campaign-review (no-op in Design Mode).
 */
export function useLovableFlowRedirect() {
  const { goTo, state, designMode } = useCampaign();

  useEffect(() => {
    if (designMode) return;
    const prepared =
      Boolean(state.aiDrafted) ||
      (Boolean(state.title.trim()) && Boolean(state.description.trim()));
    goTo(prepared ? "campaign-review" : "quick-start");
  }, [goTo, designMode, state.aiDrafted, state.title, state.description]);
}
