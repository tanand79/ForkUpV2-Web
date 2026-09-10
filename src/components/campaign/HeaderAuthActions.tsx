"use client";



import { useCallback, useEffect, useState } from "react";
import { useClientMounted } from "@/lib/use-client-mounted";

import { LayoutGrid, LogOut } from "lucide-react";

import { useCampaign } from "@/lib/campaign-context";

import { fetchCurrentUser, logoutUser } from "@/lib/api";

import { getAuthToken } from "@/lib/auth-storage";

import { clearAuthAndSession } from "@/lib/auth-session";

import { HeaderPillButton, headerPillClass } from "./SiteHeader";
import { AiEngineDropdown } from "./AiEngineDropdown";



export function HeaderAuthActions({ step: _step }: { step: string }) {

  const { goTo, setNonprofitProfile, setBusinessProfile, update, switchActiveRole } = useCampaign();

  const mounted = useClientMounted();

  const [signedIn, setSignedIn] = useState(false);

  const [label, setLabel] = useState<string | null>(null);



  const refresh = useCallback(async () => {

    if (!getAuthToken()) {

      setSignedIn(false);

      setLabel(null);

      return;

    }

    setSignedIn(true);

    try {

      const user = await fetchCurrentUser();

      setLabel(user.fullName?.trim() || user.email);

    } catch {

      clearAuthAndSession();

      setSignedIn(false);

      setLabel(null);

    }

  }, []);



  useEffect(() => {

    if (!mounted) return;

    void refresh();

  }, [refresh, mounted]);



  useEffect(() => {

    const onAuthChange = () => void refresh();

    window.addEventListener("forkup-auth-change", onAuthChange);

    return () => window.removeEventListener("forkup-auth-change", onAuthChange);

  }, [refresh]);



  const signOut = async () => {

    try {

      await logoutUser();

    } catch {

      /* ignore */

    }

    clearAuthAndSession();

    setNonprofitProfile(null);

    setBusinessProfile(null);

    update({
      accountIntent: null,
      nonprofitProfile: null,
      businessProfile: null,
      nonprofitMemberships: [],
      businessMemberships: [],
    });

    setSignedIn(false);
    setLabel(null);
    goTo("website-landing");

  };



  if (!mounted) {

    return (

      <>

        <AiEngineDropdown />

        <span className={`${headerPillClass} invisible`} aria-hidden>

          Sign in

        </span>

      </>

    );

  }



  if (signedIn) {

    return (

      <>

        <AiEngineDropdown />

        {label && (

          <span

            className={`${headerPillClass} max-w-[5.5rem] sm:max-w-[7rem]`}

            title={label}

          >

            <LayoutGrid className="size-3.5 shrink-0" />

            <span className="truncate">{label}</span>

          </span>

        )}

        <HeaderPillButton onClick={() => void signOut()}>

          <LogOut className="size-3.5" />

          Sign out

        </HeaderPillButton>

      </>

    );

  }



  return (

    <>

      <AiEngineDropdown />

      <button type="button" onClick={() => goTo("auth-login")} className={headerPillClass}>

        Sign in

      </button>

    </>

  );

}


