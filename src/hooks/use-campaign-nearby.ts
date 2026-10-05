"use client";

/**
 * Browser location + ZIP override + radius for nearby campaign / business lists.
 * Default: Near Me (browser GPS / IP fallback within radius). User may pick a
 * ZIP / popular city or switch to all locations (no distance filter).
 */
import { useCallback, useEffect, useState } from "react";
import { geocodeUsZip } from "@/lib/geocode-us-zip";
import { useBrowserLocation } from "@/hooks/use-browser-location";

const ZIP_KEY = "forkup-homepage-zip";
/** v2: previous key forced "all" on every visit — bump so Near Me is the new default. */
const ALL_LOCATIONS_KEY = "forkup-homepage-all-locations-v2";
export const RADIUS_PRESETS = [8, 20, 35, 50] as const;
export const DEFAULT_RADIUS_MILES = 20;

export function useCampaignNearby() {
  const [radiusMiles, setRadiusMiles] = useState(DEFAULT_RADIUS_MILES);
  const [zipInput, setZipInputState] = useState("");
  const [zipPlace, setZipPlace] = useState<{ city: string | null; state: string | null } | null>(null);
  const [zipCoords, setZipCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [zipError, setZipError] = useState<string | null>(null);
  /** Default Near Me — false until user explicitly chooses "all". */
  const [allLocations, setAllLocationsState] = useState(false);
  const browserLocation = useBrowserLocation(true);

  useEffect(() => {
    const mode = sessionStorage.getItem(ALL_LOCATIONS_KEY);
    const savedZip = sessionStorage.getItem(ZIP_KEY);
    if (mode === "1") {
      setAllLocationsState(true);
      sessionStorage.removeItem(ZIP_KEY);
      return;
    }
    if (savedZip && savedZip.replace(/\D/g, "").length === 5) {
      setAllLocationsState(false);
      sessionStorage.setItem(ALL_LOCATIONS_KEY, "0");
      setZipInputState(savedZip);
      return;
    }
    // Default: Near Me (GPS / IP), no ZIP override.
    setAllLocationsState(false);
    sessionStorage.setItem(ALL_LOCATIONS_KEY, "0");
    sessionStorage.removeItem(ZIP_KEY);
  }, []);

  const clearZipState = useCallback(() => {
    sessionStorage.removeItem(ZIP_KEY);
    setZipInputState("");
    setZipPlace(null);
    setZipCoords(null);
    setZipError(null);
    browserLocation.setLocationOverride(null);
  }, [browserLocation.setLocationOverride]);

  const setNearMe = useCallback(() => {
    setAllLocationsState(false);
    sessionStorage.setItem(ALL_LOCATIONS_KEY, "0");
    clearZipState();
  }, [clearZipState]);

  const setAllLocations = useCallback(
    (value: boolean) => {
      if (!value) {
        setNearMe();
        return;
      }
      setAllLocationsState(true);
      sessionStorage.setItem(ALL_LOCATIONS_KEY, "1");
      clearZipState();
    },
    [clearZipState, setNearMe],
  );

  const setZipInput = useCallback(
    (value: string) => {
      const zip = value.replace(/\D/g, "").slice(0, 5);
      setZipInputState(zip);
      if (zip.length === 5) {
        sessionStorage.setItem(ZIP_KEY, zip);
        // Nearby activates after geocode; stay off "all" while typing a ZIP.
        setAllLocationsState(false);
        sessionStorage.setItem(ALL_LOCATIONS_KEY, "0");
      } else {
        // Incomplete / cleared ZIP → Near Me (keep typed digits; don't wipe input).
        sessionStorage.removeItem(ZIP_KEY);
        setZipPlace(null);
        setZipCoords(null);
        setZipError(null);
        browserLocation.setLocationOverride(null);
        setAllLocationsState(false);
        sessionStorage.setItem(ALL_LOCATIONS_KEY, "0");
      }
    },
    [browserLocation.setLocationOverride],
  );

  const setRadiusMilesOnly = useCallback((miles: number) => {
    setRadiusMiles(miles);
  }, []);

  useEffect(() => {
    const zip = zipInput.replace(/\D/g, "").slice(0, 5);
    if (zip.length !== 5) return;
    let cancelled = false;
    void geocodeUsZip(zip).then((result) => {
      if (cancelled) return;
      if (!result) {
        setZipError("ZIP not found");
        setZipCoords(null);
        setZipPlace(null);
        // Fall back to Near Me rather than national "all".
        setAllLocationsState(false);
        sessionStorage.setItem(ALL_LOCATIONS_KEY, "0");
        browserLocation.setLocationOverride(null);
        return;
      }
      setZipError(null);
      setZipPlace({ city: result.city, state: result.state });
      setZipCoords({ lat: result.latitude, lng: result.longitude });
      setAllLocationsState(false);
      sessionStorage.setItem(ALL_LOCATIONS_KEY, "0");
      browserLocation.setLocationOverride({
        latitude: result.latitude,
        longitude: result.longitude,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [zipInput, browserLocation.setLocationOverride]);

  const gpsReady =
    browserLocation.status === "ready" &&
    browserLocation.latitude != null &&
    browserLocation.longitude != null;

  const nearby = allLocations
    ? undefined
    : zipCoords != null
      ? { lat: zipCoords.lat, lng: zipCoords.lng, radiusMiles }
      : gpsReady
        ? {
            lat: browserLocation.latitude!,
            lng: browserLocation.longitude!,
            radiusMiles,
          }
        : undefined;

  const usingZip = !allLocations && zipInput.replace(/\D/g, "").length === 5;
  const nearMe = !allLocations && !usingZip;

  const locationLabel = allLocations
    ? "All locations"
    : usingZip && zipPlace?.city && zipPlace.state
      ? `${zipPlace.city}, ${zipPlace.state}`
      : usingZip
        ? "Locating…"
        : nearMe && browserLocation.city && browserLocation.state
          ? `${browserLocation.city}, ${browserLocation.state}`
          : "Near Me";

  return {
    nearby,
    allLocations,
    nearMe,
    setAllLocations,
    setNearMe,
    radiusMiles,
    setRadiusMiles: setRadiusMilesOnly,
    zipInput,
    setZipInput,
    zipError,
    locationLabel,
    locationReady: allLocations || nearby != null,
  };
}
