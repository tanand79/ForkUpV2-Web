/**
 * NPO quick-profile join session (Pass A).
 *
 * Purpose: Persist mid-join phase across reload, but clear on intentional
 * "I am nonprofit" entry so a prior done/email screen cannot go stale.
 *
 * Mirrors business clearBusinessJoinDraft() on Join Us.
 */
import {
  clearAiFlowPendingOrg,
  clearAiFlowStore,
} from "@/lib/ai-campaign-flow-storage";

const QUICK_JOIN_PHASE_KEY = "forkup-npo-quick-join-phase";

export type NpoQuickJoinPhase =
  | "confirm"
  | "hydrating"
  | "profile"
  | "email"
  | "done";

export function readNpoQuickJoinPhase(): NpoQuickJoinPhase | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(QUICK_JOIN_PHASE_KEY)?.trim() || "";
  if (
    raw === "confirm" ||
    raw === "hydrating" ||
    raw === "profile" ||
    raw === "email" ||
    raw === "done"
  ) {
    return raw;
  }
  return null;
}

export function writeNpoQuickJoinPhase(
  phase: "find" | NpoQuickJoinPhase,
): void {
  if (typeof window === "undefined") return;
  if (phase === "find") {
    sessionStorage.removeItem(QUICK_JOIN_PHASE_KEY);
    return;
  }
  sessionStorage.setItem(QUICK_JOIN_PHASE_KEY, phase);
}

export function clearNpoQuickJoinPhase(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(QUICK_JOIN_PHASE_KEY);
}

/**
 * Fresh Find entry — drop prior join phase / pending so home CTA never lands on done.
 */
export function beginFreshNpoQuickJoin(): void {
  clearNpoQuickJoinPhase();
  clearAiFlowPendingOrg();
  clearAiFlowStore();
}
