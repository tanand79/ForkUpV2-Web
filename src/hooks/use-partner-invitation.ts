"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCampaign } from "@/lib/campaign-context";
import {
  fetchCampaignDashboard,
  fetchPartnerInvitationDetail,
  type CampaignDashboardData,
  type PartnerInvitationDetail,
} from "@/lib/api";
import { toDateOnlyString } from "@/lib/date-only";

type PartnerInvitation = CampaignDashboardData["invitations"][number];

export function usePartnerInvitation() {
  const { state, update } = useCampaign();
  const searchParams = useSearchParams();
  const campaignFromUrl = searchParams.get("campaign");
  const invitationFromUrl = searchParams.get("invitation");
  const campaignSlug = campaignFromUrl ?? state.campaignSlug ?? null;

  const [apiDashboard, setApiDashboard] = useState<CampaignDashboardData | null>(null);
  const [invitationDetail, setInvitationDetail] = useState<PartnerInvitationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => {
    setReloadToken((n) => n + 1);
  }, []);

  useEffect(() => {
    if (campaignFromUrl && campaignFromUrl !== state.campaignSlug) {
      update({ campaignSlug: campaignFromUrl });
    }
  }, [campaignFromUrl, state.campaignSlug, update]);

  useEffect(() => {
    if (!campaignSlug) {
      setApiDashboard(null);
      setInvitationDetail(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const dashboardPromise = fetchCampaignDashboard(campaignSlug);
    const detailPromise =
      invitationFromUrl && campaignSlug
        ? fetchPartnerInvitationDetail(campaignSlug, invitationFromUrl)
        : Promise.resolve(null);

    void Promise.all([dashboardPromise, detailPromise])
      .then(([dashboard, detail]) => {
        if (cancelled) return;
        setApiDashboard(dashboard);
        setInvitationDetail(detail);
      })
      .catch((err) => {
        if (cancelled) return;
        setApiDashboard(null);
        setInvitationDetail(null);
        setError(err instanceof Error ? err.message : "Failed to load invitation");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [campaignSlug, invitationFromUrl, reloadToken]);

  const invitation: PartnerInvitation | null = useMemo(() => {
    if (invitationDetail) return invitationDetail;
    if (!apiDashboard?.invitations.length) return null;
    if (invitationFromUrl) {
      const match = apiDashboard.invitations.find(
        (inv) => String(inv.id) === invitationFromUrl,
      );
      if (match) return match;
    }
    const changes = apiDashboard.invitations.find(
      (inv) => inv.acceptanceStatus === "changes_requested",
    );
    return changes ?? apiDashboard.invitations[0];
  }, [apiDashboard, invitationDetail, invitationFromUrl]);

  const campaignStartDate = toDateOnlyString(apiDashboard?.startDate) || "";

  return {
    campaignSlug,
    invitationFromUrl,
    apiDashboard,
    invitation,
    campaignStartDate,
    loading,
    error,
    reload,
  };
}
