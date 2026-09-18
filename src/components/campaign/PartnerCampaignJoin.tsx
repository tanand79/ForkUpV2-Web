"use client";

/**
 * Public-campaign → business partner join request screen.
 *
 * Purpose: After Find My Restaurant / giveback join, confirm and send the
 * join request for a specific campaign. Does not run while the user is still
 * in nonprofit-organizer mode without completing Find.
 *
 * Inputs: ?campaign=slug and/or session partner-join intent (findCompleted).
 * Outputs: pending request to NPO; then wait for NPO accept → normal invite.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Store,
} from "lucide-react";
import { useCampaign } from "@/lib/campaign-context";
import { fetchCampaign } from "@/lib/api";
import type { CampaignDetail } from "@/lib/campaign-types";
import { getAuthToken } from "@/lib/auth-storage";
import { loadUserSession } from "@/lib/auth-session";
import {
  prepareBusinessJoinAuth,
  stashAccountIntent,
  stashAuthReturnStep,
  stashRoleHint,
} from "@/lib/campaign-auth";
import { campaignPublicPath } from "@/lib/campaign-paths";
import {
  flushPendingPartnerJoinRequest,
  markPartnerJoinFindCompleted,
  readPartnerJoinIntent,
  reconcilePartnerJoinIntentForUser,
  stashPartnerJoinIntent,
  seedBusinessJoinDraftForCampaign,
} from "@/lib/partner-join-intent";
import { stashBusinessDoor } from "@/lib/business-door";

type Phase = "loading" | "ready" | "submitting" | "done" | "error";

function ownedBusinessIdsFromState(state: {
  businessMemberships: { id: number }[];
  businessProfile: { id: number } | null;
}): number[] {
  const ids = state.businessMemberships.map((b) => b.id);
  if (state.businessProfile?.id) ids.push(state.businessProfile.id);
  return ids.filter((id) => Number.isFinite(id) && id > 0);
}

export function PartnerCampaignJoin() {
  const { goTo, state, switchActiveRole } = useCampaign();
  const params = useSearchParams();
  const campaignParam = params.get("campaign")?.trim() || "";
  const slugFromIntent = readPartnerJoinIntent()?.campaignSlug || "";
  const slug = campaignParam || slugFromIntent;

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [bindEpoch, setBindEpoch] = useState(0);
  const redirectedRef = useRef(false);

  const ownedIds = useMemo(
    () => ownedBusinessIdsFromState(state),
    [state.businessMemberships, state.businessProfile?.id],
  );

  // Prefer intent-bound owned business; else active/first membership for this account.
  const intent = readPartnerJoinIntent();
  void bindEpoch;
  const fallbackBiz =
    state.businessProfile ?? state.businessMemberships[0] ?? null;
  const businessId =
    (intent?.businessId && ownedIds.includes(intent.businessId)
      ? intent.businessId
      : undefined) ??
    (ownedIds.length > 0 ? fallbackBiz?.id : undefined);
  const locationId =
    businessId != null
      ? intent?.locationId ??
        (state.businessProfile?.id === businessId
          ? state.businessProfile.locationId
          : state.businessMemberships.find((b) => b.id === businessId)
              ?.locationId)
      : undefined;
  const businessName =
    (businessId != null &&
      (state.businessProfile?.id === businessId
        ? state.businessProfile.businessName
        : state.businessMemberships.find((b) => b.id === businessId)
            ?.businessName)) ||
    "Your business";
  const hasOwnedBoundBusiness = Boolean(businessId && ownedIds.includes(businessId));

  useEffect(() => {
    if (!slug) {
      setError("Missing campaign. Open Join from a public campaign page.");
      setPhase("error");
      return;
    }

    const current = readPartnerJoinIntent();
    const door = current?.doorType ?? "restaurant";
    stashBusinessDoor(door);
    stashPartnerJoinIntent({
      campaignSlug: slug,
      doorType: door,
      requireFind: current?.requireFind,
      findCompleted: current?.findCompleted,
      businessId: current?.businessId,
      locationId: current?.locationId,
      ownerUserId: current?.ownerUserId,
    });
    seedBusinessJoinDraftForCampaign(slug, door);
    stashRoleHint("business");
    stashAccountIntent("business");
    stashAuthReturnStep("partner-campaign-join");

    let cancelled = false;
    void fetchCampaign(slug)
      .then((c) => {
        if (!cancelled) {
          setCampaign(c);
          setPhase("ready");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Campaign not found");
          setPhase("error");
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Signed-in with a business → bind and stay on Send request UI.
  // No business → Find My Restaurant.
  useEffect(() => {
    if (phase !== "ready" || !slug || redirectedRef.current) return;
    if (!getAuthToken()) return;

    const session = loadUserSession();
    if (!session?.userId) return;

    reconcilePartnerJoinIntentForUser({
      userId: session.userId,
      ownedBusinessIds: ownedIds,
    });

    const ownedBiz =
      (intent?.businessId && ownedIds.includes(intent.businessId)
        ? state.businessMemberships.find((b) => b.id === intent.businessId) ??
          (state.businessProfile?.id === intent.businessId
            ? state.businessProfile
            : null)
        : null) ??
      state.businessProfile ??
      state.businessMemberships[0] ??
      null;

    if (ownedBiz?.id) {
      const already =
        intent?.findCompleted &&
        intent.businessId === ownedBiz.id &&
        intent.ownerUserId === session.userId;
      if (!already) {
        markPartnerJoinFindCompleted({
          businessId: ownedBiz.id,
          locationId:
            "locationId" in ownedBiz
              ? Number(ownedBiz.locationId) || undefined
              : undefined,
          ownerUserId: session.userId,
        });
        setBindEpoch((n) => n + 1);
      }
      return;
    }

    redirectedRef.current = true;
    stashPartnerJoinIntent({
      campaignSlug: slug,
      doorType: readPartnerJoinIntent()?.doorType ?? "restaurant",
      requireFind: true,
      findCompleted: false,
    });
    stashAuthReturnStep("partner-campaign-join");
    goTo("business-giveback-join", { query: { campaign: slug } });
  }, [
    phase,
    slug,
    ownedIds,
    goTo,
    intent?.businessId,
    intent?.findCompleted,
    intent?.ownerUserId,
    state.businessProfile,
    state.businessMemberships,
  ]);

  // Must finish Find My Restaurant first when no owned business yet.
  useEffect(() => {
    if (phase !== "ready" || !slug || redirectedRef.current) return;
    if (hasOwnedBoundBusiness) return;
    const current = readPartnerJoinIntent();
    if (current?.requireFind && !current.findCompleted) {
      redirectedRef.current = true;
      stashAuthReturnStep("partner-campaign-join");
      goTo("business-giveback-join", { query: { campaign: slug } });
    }
  }, [phase, slug, goTo, hasOwnedBoundBusiness]);

  // Not signed in → auth as business, then return here.
  useEffect(() => {
    if (phase !== "ready" || !slug || redirectedRef.current) return;
    if (getAuthToken()) return;
    redirectedRef.current = true;
    stashAuthReturnStep("partner-campaign-join");
    prepareBusinessJoinAuth();
    goTo("auth-login", {
      query: { campaign: slug, token: undefined },
    });
  }, [phase, slug, goTo]);

  // Force business role in the header (not nonprofit organizer).
  useEffect(() => {
    if (!hasOwnedBoundBusiness || !businessId) return;
    switchActiveRole("business", businessId);
    stashAccountIntent("business");
    stashRoleHint("business");
  }, [hasOwnedBoundBusiness, businessId, switchActiveRole]);

  const sendRequest = async () => {
    if (!slug || !businessId) return;
    const session = loadUserSession();
    if (!ownedIds.includes(businessId)) {
      goTo("business-giveback-join", { query: { campaign: slug } });
      return;
    }
    setPhase("submitting");
    setError(null);
    switchActiveRole("business", businessId);
    stashPartnerJoinIntent({
      campaignSlug: slug,
      doorType: readPartnerJoinIntent()?.doorType ?? "restaurant",
      businessId,
      locationId: locationId || undefined,
      requireFind: false,
      findCompleted: true,
      ownerUserId: session?.userId,
    });
    const status = await flushPendingPartnerJoinRequest({
      businessId,
      locationId: locationId || undefined,
    });
    if (status === "submitted") {
      setPhase("done");
      return;
    }
    if (status === "skipped" && !readPartnerJoinIntent()) {
      setPhase("done");
      return;
    }
    setError(
      status === "error"
        ? "Could not send your join request. Try again."
        : "Finish Find My Restaurant, then send your request.",
    );
    setPhase("ready");
  };

  if (phase === "loading" || phase === "submitting") {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg flex-col items-center justify-center px-5 py-12">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">
          {phase === "submitting"
            ? "Sending your join request to the nonprofit…"
            : "Loading campaign…"}
        </p>
      </main>
    );
  }

  if (phase === "error") {
    return (
      <main className="mx-auto max-w-lg px-5 py-12 text-center">
        <h1 className="font-display text-2xl font-bold">Couldn’t continue</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
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

  if (phase === "done") {
    return (
      <main className="mx-auto max-w-lg px-5 py-12">
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <CheckCircle2 className="mx-auto size-10 text-primary" />
          <h1 className="mt-4 font-display text-2xl font-bold">Request sent</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{businessName}</span> asked to
            join
            {campaign ? (
              <>
                {" "}
                “{campaign.name}” with {campaign.nonprofit}
              </>
            ) : (
              " this campaign"
            )}
            . The nonprofit will review your request. If they accept, you’ll get the normal
            partnership invitation to finish terms and ACH.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                if (businessId) switchActiveRole("business", businessId);
                goTo("business-dashboard");
              }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
            >
              Go to business dashboard
              <ArrowRight className="size-4" />
            </button>
            {slug && (
              <a
                href={campaignPublicPath(slug)}
                className="text-sm font-semibold text-primary"
              >
                Back to campaign page
              </a>
            )}
          </div>
        </div>
      </main>
    );
  }

  // Redirecting to Find My Restaurant — avoid flashing "Sending as …" for unbound accounts.
  if (!hasOwnedBoundBusiness) {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg flex-col items-center justify-center px-5 py-12">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">
          Opening Find My Restaurant…
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-5 py-10 sm:px-6">
      <button
        type="button"
        onClick={() =>
          slug
            ? (window.location.href = campaignPublicPath(slug))
            : goTo("website-landing")
        }
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to campaign
      </button>

      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-accent text-primary">
          <Store className="size-5" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Business partner — join campaign
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {campaign?.name ?? "Campaign"}
          </h1>
        </div>
      </div>

      {campaign && (
        <p className="mt-3 text-sm text-muted-foreground">
          Organized by{" "}
          <span className="font-semibold text-foreground">{campaign.nonprofit}</span>
          {campaign.dateRange ? ` · ${campaign.dateRange}` : ""}
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="mt-8 rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">
          Sending as{" "}
          <span className="font-semibold text-foreground">{businessName}</span>. The
          nonprofit accepts or declines — same gate as a normal invite.
        </p>
        <button
          type="button"
          disabled={!businessId || !getAuthToken()}
          onClick={() => void sendRequest()}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          Send join request
          <ArrowRight className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            stashPartnerJoinIntent({
              campaignSlug: slug,
              doorType: readPartnerJoinIntent()?.doorType ?? "restaurant",
              requireFind: true,
              findCompleted: false,
              forceFind: true,
            });
            goTo("business-giveback-join", {
              query: { campaign: slug || undefined },
            });
          }}
          className="mt-3 w-full text-center text-sm font-semibold text-primary"
        >
          Find a different restaurant / business
        </button>
      </div>
    </main>
  );
}
