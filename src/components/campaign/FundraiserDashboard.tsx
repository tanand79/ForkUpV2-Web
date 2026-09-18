"use client";

/**
 * Fundraiser home — list sent org invites + start a new AI campaign for any nonprofit.
 *
 * Purpose: Fundraisers partner with many nonprofits (invite-based), unlike nonprofit
 * organizers who only create for their own org.
 *
 * Changelog (Pass B): Show invitation + campaign status; link to public campaign page
 * when the campaign is live / scheduled / in invitation phase.
 */
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Loader2, Megaphone } from "lucide-react";
import { useCampaign } from "@/lib/campaign-context";
import {
  fetchCurrentUser,
  fetchMyFundraiserInvites,
  type FundraiserMyInvite,
} from "@/lib/api";
import { stashAccountIntent } from "@/lib/campaign-auth";
import { campaignPublicPath } from "@/lib/campaign-paths";
import { EmailTemplatesPanel } from "@/components/campaign/EmailTemplatesPanel";
import { getAuthToken } from "@/lib/auth-storage";

/**
 * Human-readable invite + campaign status for the fundraiser list.
 * Inputs: invite from GET /api/fundraiser/my-invites.
 * Output: short status label for the card.
 */
function fundraiserInviteStatusLabel(inv: FundraiserMyInvite): string {
  const invite = (inv.invitationStatus || "").toLowerCase();
  const campaign = (inv.campaignStatus || "").toLowerCase();

  if (invite === "declined") return "Declined";
  if (invite === "pending") return "Pending — waiting for nonprofit";

  if (campaign === "live") return "Accepted · Live";
  if (campaign === "ready_to_launch") return "Accepted · Scheduled";
  if (campaign === "invitation_phase") return "Accepted · Invitation phase";
  if (campaign === "in_review") return "Accepted · In review";
  if (campaign === "closed" || campaign === "completed") return `Accepted · ${campaign}`;
  if (invite === "accepted") return "Accepted · Nonprofit preparing";

  return `${inv.invitationStatus}${inv.campaignStatus ? ` · ${inv.campaignStatus}` : ""}`;
}

/**
 * Whether the public campaign page is useful to open from the fundraiser list.
 * Inputs: campaign_status from my-invites.
 * Output: true when supporters can (or soon can) view the public page.
 */
function canViewPublicCampaign(campaignStatus: string): boolean {
  const s = (campaignStatus || "").toLowerCase();
  return (
    s === "live" ||
    s === "ready_to_launch" ||
    s === "invitation_phase" ||
    s === "in_review"
  );
}

export function FundraiserDashboard() {
  const { goTo, update } = useCampaign();
  const [invites, setInvites] = useState<FundraiserMyInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    void fetchMyFundraiserInvites()
      .then(setInvites)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load invitations"),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!getAuthToken()) return;
    void fetchCurrentUser()
      .then((u) => setUserId(u.id))
      .catch(() => setUserId(null));
  }, []);

  const startForNonprofit = () => {
    stashAccountIntent("fundraiser");
    update({ accountIntent: "fundraiser" });
    goTo("ai-find-org");
  };

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 pb-24 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">
        Fundraiser
      </p>
      <h1 className="font-display mt-1 text-3xl font-extrabold tracking-tight">
        Raise for organizations you support
      </h1>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        Search any nonprofit, build a campaign with AI, and send them an invite. They
        accept on their dashboard — like a business partnership.
      </p>

      <button
        type="button"
        onClick={startForNonprofit}
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
      >
        <Megaphone className="size-4" />
        Find a nonprofit &amp; start
        <ArrowRight className="size-4" />
      </button>

      {userId ? (
        <div className="mt-8">
          <EmailTemplatesPanel
            scopeType="fundraiser_user"
            scopeId={userId}
            title="Email templates"
            description="Edit your nonprofit invite message, set the From name, preview, and send."
          />
        </div>
      ) : null}

      <section className="mt-10">
        <h2 className="font-display text-lg font-bold">Your invitations &amp; campaigns</h2>
        {loading ? (
          <div className="mt-6 flex justify-center">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : error ? (
          <p className="mt-4 text-sm text-destructive">{error}</p>
        ) : invites.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No invitations yet. Start a campaign to propose one.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {invites.map((inv) => {
              const showPublic = canViewPublicCampaign(inv.campaignStatus);
              return (
                <li
                  key={inv.token}
                  className="rounded-2xl border border-border bg-card p-4"
                >
                  <p className="font-semibold">{inv.campaignName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {inv.nonprofitName}
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground/80">
                    {fundraiserInviteStatusLabel(inv)}
                  </p>
                  {showPublic && inv.campaignSlug ? (
                    <a
                      href={campaignPublicPath(inv.campaignSlug)}
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:text-primary-dark"
                    >
                      View public campaign <ArrowRight className="size-3.5" />
                    </a>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <button
        type="button"
        onClick={() => goTo("account-hub")}
        className="mt-8 text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
      >
        ← Account hub
      </button>
    </main>
  );
}
