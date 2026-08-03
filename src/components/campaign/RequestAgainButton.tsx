"use client";

import { useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import {
  resubmitAccessRequest,
  resubmitCampaignForkupReview,
} from "@/lib/api";

type OrgRequestAgainProps = {
  kind: "organization";
  organizationType: "nonprofit" | "business";
  organizationId: number;
  /** Called after a successful resubmit (e.g. sync session / refresh badge). */
  onSuccess?: () => void | Promise<void>;
  className?: string;
};

type CampaignRequestAgainProps = {
  kind: "campaign";
  campaignSlug: string;
  /** Called after a successful resubmit (e.g. refresh campaign list). */
  onSuccess?: () => void | Promise<void>;
  className?: string;
};

export type RequestAgainButtonProps = OrgRequestAgainProps | CampaignRequestAgainProps;

/**
 * RequestAgainButton
 * Purpose: Let a user resubmit after Super Admin denial (org verification or campaign ForkUp review).
 * Inputs: either organizationType+organizationId, or campaignSlug; optional onSuccess.
 * Outputs: button that calls the matching resubmit API; shows loading / inline error.
 */
export function RequestAgainButton(props: RequestAgainButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    setError(null);
    setLoading(true);
    try {
      if (props.kind === "organization") {
        await resubmitAccessRequest({
          organizationType: props.organizationType,
          organizationId: props.organizationId,
        });
      } else {
        await resubmitCampaignForkupReview(props.campaignSlug);
      }
      await props.onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit request again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <span className={`inline-flex flex-col items-start gap-1 ${props.className ?? ""}`}>
      <button
        type="button"
        disabled={loading}
        onClick={() => void onClick()}
        className="inline-flex items-center gap-1.5 rounded-full border border-rose-300 bg-white px-3 py-1 text-xs font-semibold text-rose-800 transition-colors hover:bg-rose-50 disabled:opacity-60 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200 dark:hover:bg-rose-950/70"
      >
        {loading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <RotateCcw className="size-3.5" />
        )}
        Request again
      </button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </span>
  );
}
