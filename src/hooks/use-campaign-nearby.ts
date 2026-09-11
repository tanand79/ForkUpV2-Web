"use client";

/**
 * Browser location + ZIP override + radius for nearby campaign lists.
 * Default: all live campaigns (no distance filter). Location filter applies
 * only after a ZIP / popular city geocode succeeds — never via raw GPS alone.
 */
import { useCallback, useEffect, useState } from "react";
import { geocodeUsZip } from "@/lib/geocode-us-zip";
import { useBrowserLocation } from "@/hooks/use-browser-location";

const ZIP_KEY = "forkup-homepage-zip";
const ALL_LOCATIONS_KEY = "forkup-homepage-all-locations";
export const RADIUS_PRESETS = [8, 20, 35, 50] as const;
export const DEFAULT_RADIUS_MILES = 20;

export function useCampaignNearby() {
  const [radiusMiles, setRadiusMiles] = useState(DEFAULT_RADIUS_MILES);
  const [zipInput, setZipInputState] = useState("");
  const [zipPlace, setZipPlace] = useState<{ city: string | null; state: string | null } | null>(null);
  const [zipCoords, setZipCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [zipError, setZipError] = useState<string | null>(null);
  const [allLocations, setAllLocationsState] = useState(true);
  const browserLocation = useBrowserLocation(true);

  useEffect(() => {
    const mode = sessionStorage.getItem(ALL_LOCATIONS_KEY);
    const savedZip = sessionStorage.getItem(ZIP_KEY);
    // Restore ZIP draft; nearby activates only after geocode sets zipCoords.
    if (mode === "0" && savedZip && savedZip.replace(/\D/g, "").length === 5) {
      setZipInputState(savedZip);
      return;
    }
    setAllLocationsState(true);
    sessionStorage.setItem(ALL_LOCATIONS_KEY, "1");
    sessionStorage.removeItem(ZIP_KEY);
  }, []);

  const setAllLocations = useCallback(
    (value: boolean) => {
      setAllLocationsState(value);
      sessionStorage.setItem(ALL_LOCATIONS_KEY, value ? "1" : "0");
      if (value) {
        sessionStorage.removeItem(ZIP_KEY);
        setZipInputState("");
        setZipPlace(null);
        setZipCoords(null);
        setZipError(null);
        browserLocation.setLocationOverride(null);
      }
    },
    [browserLocation.setLocationOverride],
  );

  const setZipInput = useCallback(
    (value: string) => {
      const zip = value.replace(/\D/g, "").slice(0, 5);
      setZipInputState(zip);
      if (zip.length === 5) {
        sessionStorage.setItem(ZIP_KEY, zip);
        // Stay on "all" until geocode succeeds — avoids filtering by GPS first.
      } else {
        sessionStorage.removeItem(ZIP_KEY);
        setZipPlace(null);
        setZipCoords(null);
        setZipError(null);
        browserLocation.setLocationOverride(null);
        setAllLocationsState(true);
        sessionStorage.setItem(ALL_LOCATIONS_KEY, "1");
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
        setAllLocationsState(true);
        sessionStorage.setItem(ALL_LOCATIONS_KEY, "1");
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

  const nearby =
    allLocations || zipCoords == null
      ? undefined
      : { lat: zipCoords.lat, lng: zipCoords.lng, radiusMiles };

  const locationLabel = allLocations
    ? "Search location"
    : zipInput.length === 5 && zipPlace?.city && zipPlace.state
      ? `${zipPlace.city}, ${zipPlace.state}`
      : zipInput.length === 5
        ? "Locating…"
        : "Search location";

  return {
    nearby,
    allLocations,
    setAllLocations,
    radiusMiles,
    setRadiusMiles: setRadiusMilesOnly,
    zipInput,
    setZipInput,
    zipError,
    locationLabel,
    locationReady: allLocations || nearby != null,
  };
}
