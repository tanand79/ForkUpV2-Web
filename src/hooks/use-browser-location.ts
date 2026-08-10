"use client";

/**
 * Browser location for nearby (~8 mile) search filters.
 *
 * Purpose: Expose coords (+ city/state) for nearby API calls.
 * Order: US device GPS → else Browser IP / VPN geolocation (US only) →
 * else Richmond VA test pin (overseas QA).
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
  city: string | null;
  state: string | null;
  error: string | null;
  refresh: () => void;
  setLocationOverride: (coords: LatLngOverride | null) => void;
  isOverride: boolean;
  /** True when using Richmond fallback because real GPS is unusable for US nearby. */
  usedAutoFallback: boolean;
};

/** Downtown Richmond, VA — nearby QA when Sensors/VPN cannot set US GPS. */
export const TEST_LOCATION_RICHMOND_VA: LatLngOverride & {
  label: string;
  city: string;
  state: string;
} = {
  latitude: 37.5407,
  longitude: -77.436,
  label: "Richmond, VA",
  city: "Richmond",
  state: "VA",
};

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 10000,
  maximumAge: 10 * 60 * 1000,
};

type PlaceHint = { city: string | null; state: string | null };

type IpPlace = {
  latitude: number;
  longitude: number;
  city: string | null;
  state: string | null;
};

function isLikelyOutsideUs(lat: number, lng: number): boolean {
  // Contiguous US + Alaska/Hawaii rough box. Outside → US IRS nearby cannot apply.
  if (lat >= 24 && lat <= 50 && lng >= -125 && lng <= -66) return false;
  if (lat >= 51 && lat <= 72 && lng >= -180 && lng <= -129) return false; // AK
  if (lat >= 18 && lat <= 23 && lng >= -161 && lng <= -154) return false; // HI
  return true;
}

function stateFromSubdivisionCode(code: string | undefined): string | null {
  const subdiv = (code ?? "").trim().toUpperCase();
  if (/^US-[A-Z]{2}$/.test(subdiv)) return subdiv.slice(3);
  if (/^[A-Z]{2}$/.test(subdiv)) return subdiv;
  return null;
}

/**
 * Client reverse-geocode via BigDataCloud (no API key) so every nearby request
 * can send city/state without waiting on the server Nominatim path.
 */
async function reverseGeocodeClient(
  latitude: number,
  longitude: number,
): Promise<PlaceHint> {
  try {
    const url = new URL(
      "https://api.bigdatacloud.net/data/reverse-geocode-client",
    );
    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    url.searchParams.set("localityLanguage", "en");
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return { city: null, state: null };
    const data = (await res.json()) as {
      city?: string;
      locality?: string;
      principalSubdivisionCode?: string;
      countryCode?: string;
    };
    if ((data.countryCode ?? "").toUpperCase() !== "US") {
      return { city: null, state: null };
    }
    return {
      city: data.city || data.locality || null,
      state: stateFromSubdivisionCode(data.principalSubdivisionCode),
    };
  } catch {
    return { city: null, state: null };
  }
}

/**
 * Geolocate via the browser's public IP (follows VPN exit node).
 * Returns null when IP is outside the US or the lookup fails.
 * Uses ipwho.is (no key); BigDataCloud client IP endpoint requires a paid/key path.
 */
async function ipGeolocateUsClient(): Promise<IpPlace | null> {
  try {
    const res = await fetch("https://ipwho.is/", {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      success?: boolean;
      latitude?: number;
      longitude?: number;
      country_code?: string;
      city?: string;
      region_code?: string;
    };
    if (data.success === false) return null;
    const country = (data.country_code ?? "").toUpperCase();
    const lat = data.latitude;
    const lng = data.longitude;
    if (country !== "US" || lat == null || lng == null) return null;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (isLikelyOutsideUs(lat, lng)) return null;
    const region = (data.region_code ?? "").trim().toUpperCase();
    return {
      latitude: lat,
      longitude: lng,
      city: data.city || null,
      state: /^[A-Z]{2}$/.test(region) ? region : null,
    };
  } catch {
    return null;
  }
}

/**
 * Subscribe to browser geolocation for nearby filtering.
 *
 * Inputs: enabled — when false, clears coords (normal search mode).
 * Outputs: BrowserLocationState with lat/lng/city/state when ready.
 */
export function useBrowserLocation(enabled = true): BrowserLocationState {
  const [status, setStatus] = useState<BrowserLocationStatus>("idle");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [stateCode, setStateCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState(0);
  const [override, setOverride] = useState<LatLngOverride | null>(null);
  const [usedAutoFallback, setUsedAutoFallback] = useState(false);

  const refresh = useCallback(() => {
    setToken((n) => n + 1);
  }, []);

  const setLocationOverride = useCallback((coords: LatLngOverride | null) => {
    setOverride(coords);
    setUsedAutoFallback(false);
    if (!coords) {
      setToken((n) => n + 1);
    }
  }, []);

  const applyRichmondFallback = useCallback((reason: string) => {
    setLatitude(TEST_LOCATION_RICHMOND_VA.latitude);
    setLongitude(TEST_LOCATION_RICHMOND_VA.longitude);
    setCity(TEST_LOCATION_RICHMOND_VA.city);
    setStateCode(TEST_LOCATION_RICHMOND_VA.state);
    setStatus("ready");
    setUsedAutoFallback(true);
    setError(reason);
  }, []);

  /**
   * Prefer US IP / VPN when GPS is missing or overseas; Richmond only if IP is also unusable.
   */
  const applyIpOrRichmond = useCallback(
    async (cancelled: () => boolean, gpsNote: string) => {
      const ip = await ipGeolocateUsClient();
      if (cancelled()) return;
      if (ip) {
        setLatitude(ip.latitude);
        setLongitude(ip.longitude);
        setCity(ip.city);
        setStateCode(ip.state);
        setStatus("ready");
        setUsedAutoFallback(false);
        setError(
          `${gpsNote} Using browser IP / VPN location${ip.city ? ` (${ip.city}${ip.state ? `, ${ip.state}` : ""})` : ""}.`,
        );
        if (!ip.city || !ip.state) {
          void reverseGeocodeClient(ip.latitude, ip.longitude).then((place) => {
            if (cancelled()) return;
            if (place.city) setCity(place.city);
            if (place.state) setStateCode(place.state);
          });
        }
        return;
      }
      applyRichmondFallback(
        `${gpsNote} No US IP / VPN detected — using Richmond, VA test pin so nearby (~8 mi) can work.`,
      );
    },
    [applyRichmondFallback],
  );

  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      setLatitude(null);
      setLongitude(null);
      setCity(null);
      setStateCode(null);
      setError(null);
      setUsedAutoFallback(false);
      return;
    }

    if (override) {
      setLatitude(override.latitude);
      setLongitude(override.longitude);
      setStatus("ready");
      setUsedAutoFallback(false);
      setError(null);
      // Resolve city/state for manual pins (Richmond known; others via reverse).
      if (
        Math.abs(override.latitude - TEST_LOCATION_RICHMOND_VA.latitude) < 0.0001 &&
        Math.abs(override.longitude - TEST_LOCATION_RICHMOND_VA.longitude) < 0.0001
      ) {
        setCity(TEST_LOCATION_RICHMOND_VA.city);
        setStateCode(TEST_LOCATION_RICHMOND_VA.state);
        return;
      }
      let cancelled = false;
      void reverseGeocodeClient(override.latitude, override.longitude).then(
        (place) => {
          if (cancelled) return;
          setCity(place.city);
          setStateCode(place.state);
        },
      );
      return () => {
        cancelled = true;
      };
    }

    let cancelled = false;
    const isCancelled = () => cancelled;
    setStatus("prompting");
    setError(null);
    setUsedAutoFallback(false);

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      void applyIpOrRichmond(
        isCancelled,
        "Location unsupported.",
      );
      return () => {
        cancelled = true;
      };
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        if (isLikelyOutsideUs(lat, lng)) {
          void applyIpOrRichmond(
            isCancelled,
            "Device GPS is outside the US.",
          );
          return;
        }

        setLatitude(lat);
        setLongitude(lng);
        setStatus("ready");
        setError(null);
        void reverseGeocodeClient(lat, lng).then((place) => {
          if (cancelled) return;
          setCity(place.city);
          setStateCode(place.state);
          if (!place.state) {
            // US box matched but reverse failed — still usable for distance, may lack IRS state bias.
            setError("Location ready; city/state lookup was limited.");
          }
        });
      },
      (err) => {
        if (cancelled) return;
        const note =
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied."
            : "Could not read GPS.";
        void applyIpOrRichmond(isCancelled, note);
      },
      GEO_OPTIONS,
    );

    return () => {
      cancelled = true;
    };
  }, [enabled, token, override, applyIpOrRichmond]);

  return {
    status,
    latitude,
    longitude,
    city,
    state: stateCode,
    error,
    refresh,
    setLocationOverride,
    isOverride: Boolean(override) || usedAutoFallback,
    usedAutoFallback,
  };
}

/** Build optional nearby query params when GPS/fallback is ready. */
export function nearbyQueryParams(
  location: Pick<
    BrowserLocationState,
    | "latitude"
    | "longitude"
    | "status"
    | "isOverride"
    | "city"
    | "state"
    | "usedAutoFallback"
  >,
  radiusMiles = 8,
): {
  lat: number;
  lng: number;
  radiusMiles: number;
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
  const params: {
    lat: number;
    lng: number;
    radiusMiles: number;
    state?: string;
    city?: string;
  } = {
    lat: location.latitude,
    lng: location.longitude,
    radiusMiles,
  };
  if (location.state) params.state = location.state;
  if (location.city) params.city = location.city;

  // Richmond pin / auto-fallback always bias VA + Richmond.
  if (
    location.isOverride &&
    Math.abs(location.latitude - TEST_LOCATION_RICHMOND_VA.latitude) < 0.0001 &&
    Math.abs(location.longitude - TEST_LOCATION_RICHMOND_VA.longitude) < 0.0001
  ) {
    params.state = "VA";
    params.city = "Richmond";
  }
  return params;
}
