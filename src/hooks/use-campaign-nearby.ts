"use client";

/**
 * Browser location + ZIP override + radius for nearby campaign lists.
 * Default: all locations (no distance filter). ZIP persists in sessionStorage.
 */
import { useCallback, useEffect, useState } from "react";
import { geocodeUsZip } from "@/lib/geocode-us-zip";
import { nearbyQueryParams, useBrowserLocation } from "@/hooks/use-browser-location";

const ZIP_KEY = "forkup-homepage-zip";
const ALL_LOCATIONS_KEY = "forkup-homepage-all-locations";
export const RADIUS_PRESETS = [8, 15, 25, 50] as const;
export const DEFAULT_RADIUS_MILES = 25;

export function useCampaignNearby() {
  const [radiusMiles, setRadiusMiles] = useState(DEFAULT_RADIUS_MILES);
  const [zipInput, setZipInputState] = useState("");
  const [zipPlace, setZipPlace] = useState<{ city: string | null; state: string | null } | null>(null);
  const [zipError, setZipError] = useState<string | null>(null);
  const [allLocations, setAllLocationsState] = useState(true);
  const browserLocation = useBrowserLocation(true);

  useEffect(() => {
    const mode = sessionStorage.getItem(ALL_LOCATIONS_KEY);
    if (mode === "0") {
      setAllLocationsState(false);
      const savedZip = sessionStorage.getItem(ZIP_KEY);
      if (savedZip) setZipInputState(savedZip);
      return;
    }
    setAllLocationsState(true);
    sessionStorage.setItem(ALL_LOCATIONS_KEY, "1");
  }, []);

  const setAllLocations = useCallback((value: boolean) => {
    setAllLocationsState(value);
    sessionStorage.setItem(ALL_LOCATIONS_KEY, value ? "1" : "0");
    if (value) {
      sessionStorage.removeItem(ZIP_KEY);
      setZipInputState("");
      setZipPlace(null);
      setZipError(null);
    }
  }, []);

  const setZipInput = useCallback(
    (value: string) => {
      const zip = value.replace(/\D/g, "").slice(0, 5);
      setZipInputState(zip);
      if (zip) {
        sessionStorage.setItem(ZIP_KEY, zip);
        setAllLocations(false);
      } else sessionStorage.removeItem(ZIP_KEY);
      if (!zip) {
        setZipPlace(null);
        setZipError(null);
        browserLocation.setLocationOverride(null);
        setAllLocations(true);
      }
    },
    [browserLocation.setLocationOverride, setAllLocations],
  );

  const setRadiusMilesWithNearby = useCallback(
    (miles: number) => {
      setRadiusMiles(miles);
      setAllLocations(false);
    },
    [setAllLocations],
  );

  useEffect(() => {
    const zip = zipInput.replace(/\D/g, "").slice(0, 5);
    if (zip.length !== 5) return;
    let cancelled = false;
    void geocodeUsZip(zip).then((result) => {
      if (cancelled || !result) {
        if (!cancelled && !result) setZipError("ZIP not found");
        return;
      }
      setZipError(null);
      setZipPlace({ city: result.city, state: result.state });
      browserLocation.setLocationOverride({
        latitude: result.latitude,
        longitude: result.longitude,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [zipInput, browserLocation.setLocationOverride]);

  const nearby = allLocations ? undefined : nearbyQueryParams(browserLocation, radiusMiles);
  const locationLabel = allLocations
    ? "All locations"
    : zipInput.length === 5 && zipPlace?.city && zipPlace.state
      ? `${zipPlace.city}, ${zipPlace.state}`
      : browserLocation.city && browserLocation.state
        ? `${browserLocation.city}, ${browserLocation.state}`
        : browserLocation.usedAutoFallback
          ? "Set ZIP"
          : browserLocation.status === "prompting"
            ? "Locating…"
            : "Your location";

  return {
    nearby,
    allLocations,
    setAllLocations,
    radiusMiles,
    setRadiusMiles: setRadiusMilesWithNearby,
    zipInput,
    setZipInput,
    zipError,
    locationLabel,
    locationReady: allLocations || (browserLocation.status === "ready" && nearby != null),
  };
}
