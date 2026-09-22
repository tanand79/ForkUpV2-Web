/**
 * Nick V2 Layer 5 — nonprofit/admin actions to send business lifecycle emails 2/5/6/7.
 *
 * Purpose: Trigger manage API batch sends (reminder, missing info, launch kit, starting soon).
 * Inputs: campaign slug. Outputs: toast feedback; emails via backend templates.
 */
"use client";

import { useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import {
  postCampaignBusinessEmails,
  type BusinessLifecycleEmailKey,
} from "@/lib/api";
import { useCampaign } from "@/lib/campaign-context";
import { InviteFromNameField } from "@/components/campaign/InviteFromNameField";

const ACTIONS: {
  key: BusinessLifecycleEmailKey;
  label: string;
  hint: string;
}[] = [
  {
    key: "invite_reminder",
    label: "Send invite reminders",
    hint: "Email 2 — businesses still awaiting a response",
  },
  {
    key: "missing_info",
    label: "Send missing-info nudges",
    hint: "Email 5 — accepted partners with incomplete setup",
  },
  {
    key: "launch_kit",
    label: "Send launch kit ready",
    hint: "Email 6 — accepted / ready partners",
  },
  {
    key: "starting_soon",
    label: "Send starting-soon checklist",
    hint: "Email 7 — staff checklist before start/event",
  },
];

type Props = {
  slug: string;
};

export function BusinessEmailActions({ slug }: Props) {
  const { state, update } = useCampaign();
  const [loading, setLoading] = useState<BusinessLifecycleEmailKey | null>(null);

  const run = async (templateKey: BusinessLifecycleEmailKey) => {
    if (!slug) return;
    setLoading(templateKey);
    try {
      const res = await postCampaignBusinessEmails(slug, {
        templateKey,
        inviteFromName: state.inviteFromName?.trim() || undefined,
      });
      if (res.sent > 0) {
        toast.success(
          `Sent ${res.sent} email${res.sent === 1 ? "" : "s"} (${res.templateKey}).`,
        );
      } else {
        toast.info(
          `No new emails sent for ${res.templateKey} (${res.skipped} skipped / not eligible).`,
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send business emails");
    } finally {
      setLoading(null);
    }
  };

  return (
    <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-base font-bold">
        <Mail className="size-4 text-primary" />
        Business email actions
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Nick V2 templates 2, 5, 6, and 7. Initial invites (1), accept/decline (3–4), and settlement
        (8) send automatically from the campaign flow. Nothing is shown publicly until a business
        accepts.
      </p>
      {state.nonprofitProfile?.id ? (
        <div className="mt-4 max-w-md">
          <InviteFromNameField
            value={state.inviteFromName}
            onChange={(name) => update({ inviteFromName: name })}
          />
        </div>
      ) : null}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {ACTIONS.map((a) => (
          <button
            key={a.key}
            type="button"
            disabled={!!loading}
            onClick={() => void run(a.key)}
            className="rounded-2xl border border-border bg-background px-4 py-3 text-left transition-colors hover:bg-secondary disabled:opacity-60"
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              {loading === a.key ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : null}
              {a.label}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">{a.hint}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
