"use client";

/**
 * Fundraiser home — list sent org invites + start a new AI campaign for any nonprofit.
 *
 * Purpose: Fundraisers partner with many nonprofits (invite-based), unlike nonprofit
 * organizers who only create for their own org.
 */
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Loader2, Megaphone } from "lucide-react";
import { useCampaign } from "@/lib/campaign-context";
import { fetchMyFundraiserInvites, type FundraiserMyInvite } from "@/lib/api";
import { stashAccountIntent } from "@/lib/campaign-auth";

export function FundraiserDashboard() {
  const { goTo, update } = useCampaign();
  const [invites, setInvites] = useState<FundraiserMyInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

      <section className="mt-10">
        <h2 className="font-display text-lg font-bold">Your invitations</h2>
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
            {invites.map((inv) => (
              <li
                key={inv.token}
                className="rounded-2xl border border-border bg-card p-4"
              >
                <p className="font-semibold">{inv.campaignName}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {inv.nonprofitName} · {inv.invitationStatus}
                </p>
              </li>
            ))}
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
