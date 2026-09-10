"use client";

/**
 * Configurable search radius control for nonprofit nearby search.
 *
 * Purpose: ForkUp “Search Radius” card — cream presets + Google Map with
 * radius rings (mockup layout). Map centers on the nearby pin (lat/lng).
 *
 * Inputs: enabled, valueMiles, onChange, optional latitude/longitude.
 * Outputs: UI only; parent owns state / API params.
 *
 * Maps: uses Google Maps JavaScript API when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
 * is set; falls back to embed iframe + SVG rings if the key is missing/fails.
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";

const PRESETS = [8, 15, 25, 50] as const;

const CREAM = "#F6F1E8";
const CREAM_BTN = "#EFE8DC";
const INK = "#2C241C";
const MUTED = "#7A7168";
const TERRACOTTA = "#A65A3A";
const RING_IDLE = "rgba(166, 90, 58, 0.35)";
const RING_ACTIVE = "#C45C28";
const RING_FILL = "rgba(196, 92, 40, 0.14)";

/** Minimal Google Maps typings so we do not add @types/google.maps. */
type GLatLngLiteral = { lat: number; lng: number };
type GMap = {
  setCenter: (c: GLatLngLiteral) => void;
  setZoom: (z: number) => void;
  setOptions?: (opts: Record<string, unknown>) => void;
};
type GMarker = { setPosition: (c: GLatLngLiteral) => void };
type GCircle = { setMap: (map: GMap | null) => void };
type GMapsApi = {
  Map: new (
    el: HTMLElement,
    opts: Record<string, unknown>,
  ) => GMap;
  Marker: new (opts: Record<string, unknown>) => GMarker;
  Circle: new (opts: Record<string, unknown>) => GCircle;
};

type GMapsWindow = Window & {
  google?: { maps?: GMapsApi };
  __forkupMapsLoading?: Promise<void>;
  __forkupMapsReady?: boolean;
};

export type SearchRadiusControlProps = {
  enabled: boolean;
  valueMiles: number;
  onChange: (miles: number) => void;
  /** Map center — visitor coords; map waits until both are set. */
  latitude?: number | null;
  longitude?: number | null;
};

function clampMiles(n: number): number {
  if (!Number.isFinite(n)) return 50;
  return Math.min(100, Math.max(1, Math.round(n)));
}

/** Approximate Google Maps zoom so the active radius fills the panel. */
function zoomForMiles(miles: number): number {
  if (miles <= 5) return 13;
  if (miles <= 8) return 12;
  if (miles <= 15) return 11;
  if (miles <= 25) return 10;
  if (miles <= 50) return 9;
  return 8;
}

/**
 * Search radius picker + Google Map preview with radius rings.
 */
export function SearchRadiusControl({
  enabled,
  valueMiles,
  onChange,
  latitude,
  longitude,
}: SearchRadiusControlProps) {
  const active = clampMiles(valueMiles);
  const isPreset = (PRESETS as readonly number[]).includes(active);
  const [mode, setMode] = useState<"preset" | "custom">(
    isPreset ? "preset" : "custom",
  );
  const [customText, setCustomText] = useState(String(active));

  const hasCenter =
    latitude != null &&
    longitude != null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);
  const lat = hasCenter ? (latitude as number) : null;
  const lng = hasCenter ? (longitude as number) : null;

  useEffect(() => {
    const next = clampMiles(valueMiles);
    if ((PRESETS as readonly number[]).includes(next)) {
      setMode("preset");
    } else {
      setMode("custom");
    }
    setCustomText(String(next));
  }, [valueMiles]);

  const selectPreset = (miles: number) => {
    setMode("preset");
    onChange(miles);
  };

  return (
    <div
      className={`mt-4 overflow-hidden rounded-[1.25rem] border shadow-sm ${
        enabled ? "" : "opacity-55"
      }`}
      style={{ borderColor: "#E4DCD0" }}
      aria-disabled={!enabled}
    >
      <div className="grid sm:grid-cols-2">
        {/* Left — cream controls */}
        <div className="p-5 sm:p-6" style={{ backgroundColor: CREAM }}>
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: MUTED }}
          >
            Search Radius
          </p>
          <h3
            className="font-display mt-2 text-[1.35rem] font-semibold leading-snug tracking-tight sm:text-[1.5rem]"
            style={{ color: INK }}
          >
            How far should we look for nonprofits?
          </h3>

          <div className="mt-4 space-y-2">
            {PRESETS.map((miles) => {
              const selected = enabled && mode === "preset" && active === miles;
              return (
                <button
                  key={miles}
                  type="button"
                  disabled={!enabled}
                  onClick={() => selectPreset(miles)}
                  className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-[15px] transition-colors disabled:cursor-not-allowed"
                  style={
                    selected
                      ? { backgroundColor: TERRACOTTA, color: "#FFFFFF" }
                      : { backgroundColor: CREAM_BTN, color: INK }
                  }
                >
                  <span className="font-medium">
                    {miles} miles
                    {miles === 50 ? (
                      <span
                        className="ml-1.5 font-normal"
                        style={{ opacity: selected ? 0.9 : 0.65 }}
                      >
                        (Default)
                      </span>
                    ) : null}
                  </span>
                  {selected ? (
                    <span className="text-[11px] font-bold uppercase tracking-[0.12em]">
                      On
                    </span>
                  ) : null}
                </button>
              );
            })}

            <div
              className="flex items-center gap-2.5 rounded-2xl px-4 py-3"
              style={{
                backgroundColor: CREAM_BTN,
                outline:
                  enabled && mode === "custom"
                    ? `2px solid ${TERRACOTTA}`
                    : undefined,
                outlineOffset: enabled && mode === "custom" ? -2 : undefined,
              }}
            >
              <button
                type="button"
                disabled={!enabled}
                onClick={() => {
                  setMode("custom");
                  const n = clampMiles(Number(customText));
                  setCustomText(String(n));
                  onChange(n);
                }}
                className="shrink-0 text-[15px] font-medium disabled:cursor-not-allowed"
                style={{ color: INK }}
              >
                Custom
              </button>
              <input
                type="number"
                min={1}
                max={100}
                disabled={!enabled}
                value={customText}
                onFocus={() => {
                  if (enabled) setMode("custom");
                }}
                onChange={(e) => {
                  setCustomText(e.target.value);
                  const n = Number(e.target.value);
                  if (Number.isFinite(n) && n > 0) onChange(clampMiles(n));
                }}
                onBlur={() => {
                  const n = clampMiles(Number(customText));
                  setCustomText(String(n));
                  onChange(n);
                  setMode("custom");
                }}
                className="h-9 w-[4.5rem] rounded-xl border bg-white px-2.5 text-[15px] outline-none disabled:cursor-not-allowed"
                style={{ borderColor: "#D9D0C3", color: INK }}
                aria-label="Custom radius in miles"
              />
              <span className="text-[15px]" style={{ color: MUTED }}>
                miles
              </span>
            </div>
          </div>

          <p
            className="mt-4 text-[12.5px] leading-relaxed"
            style={{ color: MUTED }}
          >
            This helps organizations in suburban and rural areas discover more
            relevant matches within a reachable distance.
          </p>
        </div>

        {/* Right — live Google Map + radius rings (waits for visitor coords) */}
        <div className="relative min-h-[260px] overflow-hidden sm:min-h-full">
          {lat != null && lng != null ? (
            <>
              <GoogleRadiusMap
                latitude={lat}
                longitude={lng}
                radiusMiles={enabled ? active : 50}
                dimmed={!enabled}
              />
              <p
                className="pointer-events-none absolute bottom-3 left-0 right-0 text-center text-xs font-semibold tracking-wide"
                style={{
                  color: INK,
                  textShadow: "0 1px 2px rgba(255,255,255,0.9)",
                }}
              >
                Active: {active} mi
              </p>
            </>
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm"
              style={{ background: CREAM, color: MUTED }}
              aria-live="polite"
            >
              Getting your location…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Google Map (JS API when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set; otherwise
 * Maps embed iframe) with concentric radius rings over the pin.
 */
function GoogleRadiusMap({
  latitude,
  longitude,
  radiusMiles,
  dimmed,
}: {
  latitude: number;
  longitude: number;
  radiusMiles: number;
  dimmed: boolean;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || "";
  const mapHostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GMap | null>(null);
  const circlesRef = useRef<GCircle[]>([]);
  const markerRef = useRef<GMarker | null>(null);
  const [jsReady, setJsReady] = useState(false);
  const [jsFailed, setJsFailed] = useState(false);

  useEffect(() => {
    if (!apiKey) {
      setJsFailed(true);
      return;
    }
    let cancelled = false;

    loadGoogleMaps(apiKey)
      .then(() => {
        if (!cancelled) setJsReady(true);
      })
      .catch(() => {
        if (!cancelled) setJsFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  useEffect(() => {
    const maps = (window as GMapsWindow).google?.maps;
    if (!jsReady || !mapHostRef.current || !maps) return;

    const center = { lat: latitude, lng: longitude };

    if (!mapRef.current) {
      mapRef.current = new maps.Map(mapHostRef.current, {
        center,
        zoom: zoomForMiles(radiusMiles),
        disableDefaultUI: true,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        clickableIcons: false,
        gestureHandling: "cooperative",
        styles: WARM_MAP_STYLES,
      });
      markerRef.current = new maps.Marker({
        map: mapRef.current,
        position: center,
        title: "Your search location",
      });
    } else {
      mapRef.current.setCenter(center);
      mapRef.current.setZoom(zoomForMiles(radiusMiles));
      mapRef.current.setOptions?.({ styles: WARM_MAP_STYLES });
      markerRef.current?.setPosition(center);
    }

    for (const c of circlesRef.current) c.setMap(null);
    circlesRef.current = [];

    const map = mapRef.current;
    for (const miles of PRESETS) {
      const isActive = miles === radiusMiles;
      circlesRef.current.push(
        new maps.Circle({
          map,
          center,
          radius: miles * 1609.344,
          strokeColor: isActive ? RING_ACTIVE : TERRACOTTA,
          strokeOpacity: isActive ? 1 : 0.35,
          strokeWeight: isActive ? 2.5 : 1.25,
          fillColor: RING_ACTIVE,
          fillOpacity: isActive ? 0.12 : 0.03,
          clickable: false,
        }),
      );
    }

    if (!(PRESETS as readonly number[]).includes(radiusMiles)) {
      circlesRef.current.push(
        new maps.Circle({
          map,
          center,
          radius: radiusMiles * 1609.344,
          strokeColor: RING_ACTIVE,
          strokeOpacity: 1,
          strokeWeight: 2.5,
          fillColor: RING_ACTIVE,
          fillOpacity: 0.12,
          clickable: false,
        }),
      );
    }
  }, [jsReady, latitude, longitude, radiusMiles]);

  const embedSrc = useMemo(() => {
    const z = zoomForMiles(radiusMiles);
    return `https://maps.google.com/maps?q=${encodeURIComponent(
      `${latitude},${longitude}`,
    )}&hl=en&z=${z}&output=embed`;
  }, [latitude, longitude, radiusMiles]);

  if (apiKey && jsReady && !jsFailed) {
    return (
      <div
        ref={mapHostRef}
        className="absolute inset-0"
        style={{ opacity: dimmed ? 0.55 : 1 }}
        aria-label="Search radius map"
      />
    );
  }

  // Embed cannot load JSON map styles — warm CSS wash matches ForkUp cream/terracotta.
  return (
    <div
      className="absolute inset-0"
      style={{ opacity: dimmed ? 0.55 : 1 }}
    >
      <iframe
        title="Search radius map"
        src={embedSrc}
        className="absolute inset-0 h-full w-full border-0"
        style={{
          filter:
            "sepia(0.42) saturate(0.55) hue-rotate(-18deg) brightness(1.06) contrast(0.96)",
        }}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(246,241,232,0.22) 0%, rgba(196,92,40,0.06) 100%)",
        }}
        aria-hidden
      />
      <RadiusOverlaySvg radiusMiles={radiusMiles} />
    </div>
  );
}

/** SVG rings over the embed map (used when Maps JS API key is unavailable). */
function RadiusOverlaySvg({ radiusMiles }: { radiusMiles: number }) {
  const uid = useId().replace(/:/g, "");
  const rings = [
    { miles: 50, r: 78 },
    { miles: 25, r: 58 },
    { miles: 15, r: 40 },
    { miles: 8, r: 24 },
  ] as const;
  const activePreset = (PRESETS as readonly number[]).includes(radiusMiles)
    ? radiusMiles
    : rings.reduce(
        (best, r) =>
          Math.abs(r.miles - radiusMiles) < Math.abs(best - radiusMiles)
            ? r.miles
            : best,
        8,
      );

  return (
    <svg
      viewBox="0 0 200 200"
      className="pointer-events-none absolute inset-0 m-auto size-[85%] max-h-[240px] max-w-[240px]"
      aria-hidden
    >
      <defs>
        <radialGradient id={`gmap-ring-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={RING_FILL} />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      {rings.map((ring) => {
        const isActive = activePreset === ring.miles;
        return (
          <g key={ring.miles}>
            <circle
              cx="100"
              cy="100"
              r={ring.r}
              fill={isActive ? `url(#gmap-ring-${uid})` : "none"}
              stroke={isActive ? RING_ACTIVE : RING_IDLE}
              strokeWidth={isActive ? 2.5 : 1.25}
              strokeDasharray={isActive ? undefined : "4 3"}
            />
            <text
              x={100}
              y={100 - ring.r - 3}
              textAnchor="middle"
              fill={isActive ? RING_ACTIVE : "#5C4A3A"}
              style={{
                fontSize: 10,
                fontWeight: isActive ? 700 : 600,
                paintOrder: "stroke",
                stroke: "rgba(255,255,255,0.85)",
                strokeWidth: 3,
              }}
            >
              {ring.miles} mi
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function loadGoogleMaps(apiKey: string): Promise<void> {
  const w = window as GMapsWindow;
  if (w.__forkupMapsReady && w.google?.maps) return Promise.resolve();
  if (w.__forkupMapsLoading) return w.__forkupMapsLoading;

  w.__forkupMapsLoading = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      "script[data-forkup-google-maps]",
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("maps load")));
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    script.async = true;
    script.defer = true;
    script.dataset.forkupGoogleMaps = "1";
    script.onload = () => {
      w.__forkupMapsReady = true;
      resolve();
    };
    script.onerror = () => reject(new Error("maps load failed"));
    document.head.appendChild(script);
  });

  return w.__forkupMapsLoading;
}

/**
 * ForkUp cream / terracotta basemap for Maps JavaScript API.
 * Mirrors card colors: #F6F1E8 cream, #A65A3A terracotta ink.
 */
const WARM_MAP_STYLES: Record<string, unknown>[] = [
  { elementType: "geometry", stylers: [{ color: "#f6f1e8" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#5c4a3a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f6f1e8" }] },
  {
    featureType: "administrative",
    elementType: "geometry.stroke",
    stylers: [{ color: "#d9cfc0" }],
  },
  {
    featureType: "administrative.land_parcel",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#ebe2d6" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#7a7168" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#e0d5c4" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#7a7168" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#fffaf3" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#d8cbbb" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#e8d5c4" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#d4bba6" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#a65a3a" }],
  },
  {
    featureType: "transit",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#d4c4ae" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#8a7a68" }],
  },
];
