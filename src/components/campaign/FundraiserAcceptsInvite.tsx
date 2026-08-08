"use client";

/**
 * Fundraiser invite accept/decline — nonprofit reviews a campaign proposed by a fundraiser.
 *
 * Purpose: Parallel to NonprofitAcceptsInvite (business→NP), for fundraiser→NP.
 * Inputs: ?token= from email / dashboard acceptPath.
 * Outputs: accept → campaign under nonprofit; decline → closes draft proposal.
 */
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useCampaign } from "@/lib/campaign-context";
import {
  acceptFundraiserCampaignInvite,
  declineFundraiserCampaignInvite,
  fetchFundraiserCampaignInvite,
  type FundraiserCampaignInvite,
} from "@/lib/api";
import { getAuthToken } from "@/lib/auth-storage";
import { stashAuthReturnStep, stashRoleHint } from "@/lib/campaign-auth";

export function FundraiserAcceptsInvite() {
  const { goTo } = useCampaign();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [invite, setInvite] = useState<FundraiserCampaignInvite | null>(null);
  const [loading, setLoading] = useState(!!token);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"accepted" | "declined" | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    void fetchFundraiserCampaignInvite(token)
      .then(setInvite)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load invitation"),
      )
      .finally(() => setLoading(false));
  }, [token]);

  const accept = async () => {
    if (!token) return;
    if (!getAuthToken()) {
      stashRoleHint("nonprofit");
      stashAuthReturnStep("fundraiser-invite-accept");
      goTo("auth-login");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await acceptFundraiserCampaignInvite(token);
      setDone("accepted");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept");
    } finally {
      setBusy(false);
    }
  };

  const decline = async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await declineFundraiserCampaignInvite(token);
      setDone("declined");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to decline");
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <main className="mx-auto max-w-lg px-5 py-12 text-center text-sm text-muted-foreground">
        Missing invitation token. Open the link from your email or dashboard.
      </main>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (done === "accepted") {
    return (
      <main className="mx-auto max-w-lg px-5 py-10 text-center">
        <CheckCircle2 className="mx-auto size-12 text-primary" />
        <h1 className="mt-4 text-2xl font-extrabold">Partnership confirmed</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You accepted the campaign proposal from{" "}
          <strong>{invite?.fundraiser.name}</strong>. Continue setup when you are ready.
        </p>
        <button
          type="button"
          onClick={() => goTo("nonprofit-dashboard")}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
        >
          Open nonprofit dashboard <ArrowRight className="size-4" />
        </button>
      </main>
    );
  }

  if (done === "declined") {
    return (
      <main className="mx-auto max-w-lg px-5 py-10 text-center">
        <XCircle className="mx-auto size-12 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-extrabold">Invitation declined</h1>
        <button
          type="button"
          onClick={() => goTo("nonprofit-dashboard")}
          className="mt-6 text-sm font-medium text-primary"
        >
          Back to dashboard
        </button>
      </main>
    );
  }

  if (!invite) {
    return (
      <main className="mx-auto max-w-lg px-5 py-12 text-center">
        <p className="text-destructive">{error ?? "Invitation not found"}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-5 py-10 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">
        Fundraiser proposal
      </p>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight">
        Review campaign invitation
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        <strong>{invite.fundraiser.name}</strong> ({invite.fundraiser.email}) proposed a
        campaign for <strong>{invite.nonprofit.name}</strong>.
      </p>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5">
        <p className="font-semibold">{invite.campaign.name}</p>
        <p className="mt-2 text-sm text-muted-foreground line-clamp-6">
          {invite.campaign.story}
        </p>
        {invite.message ? (
          <p className="mt-3 border-t border-border pt-3 text-sm">
            <span className="font-medium">Message: </span>
            {invite.message}
          </p>
        ) : null}
      </div>

      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          disabled={busy || invite.invitationStatus !== "pending"}
          onClick={() => void accept()}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          Accept proposal
        </button>
        <button
          type="button"
          disabled={busy || invite.invitationStatus !== "pending"}
          onClick={() => void decline()}
          className="inline-flex flex-1 items-center justify-center rounded-full border border-border bg-card px-6 py-3 text-sm font-medium hover:bg-secondary disabled:opacity-60"
        >
          Decline
        </button>
      </div>
    </main>
  );
}
