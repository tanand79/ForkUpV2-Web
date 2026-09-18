"use client";

/**
 * Claim a guest business profile via email token.
 *
 * Purpose: Laptop→mobile ownership for restaurant/local Join Us. User opens
 * claim link, signs in/up as the emailed address only, then we attach them
 * to the business.
 *
 * Inputs: ?token= from email link.
 * Outputs: claimed → business dashboard; or prompt to auth-login.
 */
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useCampaign } from "@/lib/campaign-context";
import { getAuthToken } from "@/lib/auth-storage";
import { stashAuthReturnStep, stashAccountIntent, stashClaimLockEmail, clearClaimLockEmail } from "@/lib/campaign-auth";
import { fetchGuestBusinessClaim, postGuestBusinessClaim } from "@/lib/api";
import { syncAuthSession, loadUserSession, clearAuthAndSession } from "@/lib/auth-session";
import { flushPendingPartnerJoinRequest } from "@/lib/partner-join-intent";

type ClaimInfo = {
  slug: string;
  businessName: string;
  guestEmail: string;
  businessId: number;
  expired: boolean;
  alreadyClaimed: boolean;
};

export function GuestBusinessClaim() {
  const { goTo, update, setBusinessProfile, switchActiveRole } = useCampaign();
  const params = useSearchParams();
  const token =
    params.get("token")?.trim() ||
    (typeof window !== "undefined"
      ? sessionStorage.getItem("forkup-guest-business-claim-token")?.trim() || ""
      : "");
  const [info, setInfo] = useState<ClaimInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [autoClaimStarted, setAutoClaimStarted] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Missing claim token.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    void fetchGuestBusinessClaim(token)
      .then((data) => {
        if (!cancelled) setInfo(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Claim link not found");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const emailMismatchMessage = (signedInAs: string, expected: string) =>
    `This claim link is for ${expected}. You're signed in as ${signedInAs}. Sign out and create/sign in with ${expected}.`;

  const goSignIn = () => {
    stashAccountIntent("business");
    stashAuthReturnStep("guest-business-claim");
    sessionStorage.setItem("forkup-auth-initial-mode", "register");
    sessionStorage.setItem("forkup-guest-business-claim-token", token);
    if (info?.guestEmail) stashClaimLockEmail(info.guestEmail);
    goTo("auth-login", { query: { email: info?.guestEmail, token: undefined } });
  };

  const claimNow = async () => {
    if (!token || !getAuthToken()) {
      goSignIn();
      return;
    }
    const session = loadUserSession();
    const sessionEmail = session?.email?.trim().toLowerCase() || "";
    const expected = info?.guestEmail?.trim().toLowerCase() || "";
    if (expected && sessionEmail && sessionEmail !== expected) {
      setError(emailMismatchMessage(session!.email, info!.guestEmail));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await postGuestBusinessClaim(token);
      await syncAuthSession("business", { force: true });
      update({ accountIntent: "business" });
      setBusinessProfile({
        id: result.businessId,
        businessName: result.businessName,
        contactName: result.businessName,
        contactEmail: info?.guestEmail || "",
        locationId: 0,
        locationName: "Main Location",
        capabilities: {
          dineAndDonate: false,
          shopAndDonate: false,
          serviceGiveback: false,
          guestBartending: false,
        },
      });
      switchActiveRole("business", result.businessId);
      sessionStorage.removeItem("forkup-guest-business-claim-token");
      clearClaimLockEmail();
      void flushPendingPartnerJoinRequest({ businessId: result.businessId });
      goTo("business-dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not claim business");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (loading || !info || info.expired || info.alreadyClaimed || autoClaimStarted) return;
    if (!getAuthToken()) return;
    const session = loadUserSession();
    const sessionEmail = session?.email?.trim().toLowerCase() || "";
    const expected = info.guestEmail.trim().toLowerCase();
    if (sessionEmail && expected && sessionEmail !== expected) {
      setAutoClaimStarted(true);
      setError(emailMismatchMessage(session!.email, info.guestEmail));
      return;
    }
    setAutoClaimStarted(true);
    void claimNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, info, autoClaimStarted]);

  if (loading) {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col items-center justify-center px-5 py-12">
        <Loader2 className="size-8 animate-spin text-primary" />
      </main>
    );
  }

  if (error || !info) {
    return (
      <main className="mx-auto max-w-md px-5 py-12 text-center">
        <h1 className="font-display text-2xl font-bold">Claim link unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error || "Unknown error"}</p>
        <button
          type="button"
          className="mt-6 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
          onClick={() => goTo("website-landing")}
        >
          Back to home
        </button>
      </main>
    );
  }

  if (info.alreadyClaimed) {
    return (
      <main className="mx-auto max-w-md px-5 py-12 text-center">
        <h1 className="font-display text-2xl font-bold">Already claimed</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {info.businessName} was already linked to an account. Sign in to manage it.
        </p>
        <button
          type="button"
          className="mt-6 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
          onClick={() => goTo("auth-login")}
        >
          Sign in
        </button>
      </main>
    );
  }

  if (info.expired) {
    return (
      <main className="mx-auto max-w-md px-5 py-12 text-center">
        <h1 className="font-display text-2xl font-bold">Link expired</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ask ForkUp support or rejoin with a fresh email claim link.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-5 py-12">
      <h1 className="font-display text-3xl font-bold tracking-tight">
        Claim your business
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{info.businessName}</span>
        {" — "}
        create a free account (or sign in) to manage it. We emailed{" "}
        <span className="font-semibold text-foreground">{info.guestEmail}</span>.
      </p>
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      {error && getAuthToken() && info?.guestEmail ? (
        <button
          type="button"
          className="mt-3 text-sm font-semibold text-primary underline"
          onClick={() => {
            clearAuthAndSession();
            setError(null);
            setAutoClaimStarted(false);
            goSignIn();
          }}
        >
          Sign out and use {info.guestEmail}
        </button>
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => void claimNow()}
        className="mt-8 inline-flex w-full items-center justify-center rounded-full bg-primary py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="size-5 animate-spin" />
        ) : getAuthToken() ? (
          "Claim business"
        ) : (
          "Create account / sign in to claim"
        )}
      </button>
    </main>
  );
}
