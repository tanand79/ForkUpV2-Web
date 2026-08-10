"use client";

/**
 * Browser GPS for nearby (~8 mile) search filters.
 *
 * Purpose: Request device location once and expose coords for API calls
 * (Find Your Organization, Choose Businesses). Denials / errors fall back
 * to null so existing non-geo search still works.
 *
 * Also supports a manual test override (e.g. Richmond, VA) when Chrome
 * Sensors / DevTools is unavailable — VPN never affects this hook.
 *
 * Inputs: none (uses navigator.geolocation) + optional override via setter.
 * Outputs: { status, latitude, longitude, error, refresh, setLocationOverride, isOverride }.
 */

import { useCallback, useEffect, useState } from "react";

export type BrowserLocationStatus =
  | "idle"
  | "prompting"
  | "ready"
  | "denied"
  | "unavailable";

export type LatLngOverride = {
  latitude: number;
  longitude: number;
};

export type BrowserLocationState = {
  status: BrowserLocationStatus;
  latitude: number | null;
  longitude: number | null;
  error: string | null;
  /** Re-request location (e.g. after user enables permission). */
  refresh: () => void;
  /**
   * Force nearby search to use these coords (test helper).
   * Pass null to clear and return to real browser GPS.
   */
  setLocationOverride: (coords: LatLngOverride | null) => void;
  /** True when a manual test override is active. */
  isOverride: boolean;
};

/** Downtown Richmond, VA — for ~8 mile nearby QA without Chrome Sensors. */
export const TEST_LOCATION_RICHMOND_VA: LatLngOverride & { label: string } = {
  latitude: 37.5407,
  longitude: -77.436,
  label: "Richmond, VA",
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
 * Outputs: BrowserLocationState with lat/lng when granted or overridden.
 */
export function useBrowserLocation(enabled = true): BrowserLocationState {
  const [status, setStatus] = useState<BrowserLocationStatus>("idle");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState(0);
  const [override, setOverride] = useState<LatLngOverride | null>(null);

  const refresh = useCallback(() => {
    setToken((n) => n + 1);
  }, []);

  const setLocationOverride = useCallback((coords: LatLngOverride | null) => {
    setOverride(coords);
    if (!coords) {
      setToken((n) => n + 1);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      setLatitude(null);
      setLongitude(null);
      setError(null);
      return;
    }

    // Manual test pin wins over real GPS / VPN / device location.
    if (override) {
      setLatitude(override.latitude);
      setLongitude(override.longitude);
      setStatus("ready");
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
  }, [enabled, token, override]);

  return {
    status,
    latitude,
    longitude,
    error,
    refresh,
    setLocationOverride,
    isOverride: Boolean(override),
  };
}

/** Build optional nearby query params when GPS is ready. */
export function nearbyQueryParams(
  location: Pick<BrowserLocationState, "latitude" | "longitude" | "status" | "isOverride">,
  radiusMiles = 8,
): {
  lat: number;
  lng: number;
  radiusMiles: number;
  /** Passed when using the Richmond test pin so IRS search does not rely on reverse-geocode. */
  state?: string;
  city?: string;
} | undefined {
  if (
    location.status !== "ready" ||
    location.latitude == null ||
    location.longitude == null
  ) {
    return undefined;
  }
  const base = {
    lat: location.latitude,
    lng: location.longitude,
    radiusMiles,
  };
  // Richmond test pin — bake VA bias so slow/blocked reverse-geocode cannot empty results.
  if (
    location.isOverride &&
    Math.abs(location.latitude - TEST_LOCATION_RICHMOND_VA.latitude) < 0.0001 &&
    Math.abs(location.longitude - TEST_LOCATION_RICHMOND_VA.longitude) < 0.0001
  ) {
    return { ...base, state: "VA", city: "Richmond" };
  }
  return base;
}
