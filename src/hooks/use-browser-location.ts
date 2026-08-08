"use client";

/**
 * Browser GPS for nearby (~8 mile) search filters.
 *
 * Purpose: Request device location once and expose coords for API calls
 * (Find Your Organization, Choose Businesses). Denials / errors fall back
 * to null so existing non-geo search still works.
 *
 * Inputs: none (uses navigator.geolocation).
 * Outputs: { status, latitude, longitude, error, refresh }.
 */

import { useCallback, useEffect, useState } from "react";

export type BrowserLocationStatus =
  | "idle"
  | "prompting"
  | "ready"
  | "denied"
  | "unavailable";

export type BrowserLocationState = {
  status: BrowserLocationStatus;
  latitude: number | null;
  longitude: number | null;
  error: string | null;
  /** Re-request location (e.g. after user enables permission). */
  refresh: () => void;
};

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 12000,
  maximumAge: 5 * 60 * 1000,
};

/**
 * Subscribe to browser geolocation for nearby filtering.
 *
 * Inputs: enabled — when false, skips requesting GPS (default true).
 * Outputs: BrowserLocationState with lat/lng when granted.
 */
export function useBrowserLocation(enabled = true): BrowserLocationState {
  const [status, setStatus] = useState<BrowserLocationStatus>("idle");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState(0);

  const refresh = useCallback(() => {
    setToken((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      setLatitude(null);
      setLongitude(null);
      setError(null);
      return;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unavailable");
      setError("Location is not supported in this browser.");
      setLatitude(null);
      setLongitude(null);
      return;
    }

    let cancelled = false;
    setStatus("prompting");
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setStatus("ready");
        setError(null);
      },
      (err) => {
        if (cancelled) return;
        setLatitude(null);
        setLongitude(null);
        if (err.code === err.PERMISSION_DENIED) {
          setStatus("denied");
          setError("Location permission denied. Showing all matches.");
        } else {
          setStatus("unavailable");
          setError("Could not read your location. Showing all matches.");
        }
      },
      GEO_OPTIONS,
    );

    return () => {
      cancelled = true;
    };
  }, [enabled, token]);

  return { status, latitude, longitude, error, refresh };
}

/** Build optional nearby query params when GPS is ready. */
export function nearbyQueryParams(
  location: Pick<BrowserLocationState, "latitude" | "longitude" | "status">,
  radiusMiles = 8,
): { lat: number; lng: number; radiusMiles: number } | undefined {
  if (
    location.status !== "ready" ||
    location.latitude == null ||
    location.longitude == null
  ) {
    return undefined;
  }
  return {
    lat: location.latitude,
    lng: location.longitude,
    radiusMiles,
  };
}
