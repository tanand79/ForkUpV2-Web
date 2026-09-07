"use client";

/**
 * Compact location + radius pills (header use). No map, no calendar.
 * Inputs: return value from useCampaignNearby() in the parent.
 */
import { useEffect, useRef, useState } from "react";
import { ChevronDown, MapPin } from "lucide-react";
import { RADIUS_PRESETS } from "@/hooks/use-campaign-nearby";

type NearbyPillsProps = {
  locationLabel: string;
  zipInput: string;
  setZipInput: (zip: string) => void;
  zipError: string | null;
  radiusMiles: number;
  setRadiusMiles: (miles: number) => void;
  allLocations: boolean;
  setAllLocations: (value: boolean) => void;
};

export function NearbyLocationPills({
  locationLabel,
  zipInput,
  setZipInput,
  zipError,
  radiusMiles,
  setRadiusMiles,
  allLocations,
  setAllLocations,
}: NearbyPillsProps) {
  const [locOpen, setLocOpen] = useState(false);
  const [radOpen, setRadOpen] = useState(false);
  const locRef = useRef<HTMLDivElement>(null);
  const radRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!locOpen && !radOpen) return;
    const close = (e: PointerEvent) => {
      if (locOpen && !locRef.current?.contains(e.target as Node)) setLocOpen(false);
      if (radOpen && !radRef.current?.contains(e.target as Node)) setRadOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [locOpen, radOpen]);

  return (
    <div className="flex items-center gap-1.5">
      <div className="relative" ref={locRef}>
        <button
          type="button"
          onClick={() => {
            setLocOpen((v) => !v);
            setRadOpen(false);
          }}
          className="inline-flex max-w-[140px] items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium sm:max-w-[180px] sm:text-xs"
        >
          <MapPin className="size-3 shrink-0 text-primary" />
          <span className="truncate">{locationLabel}</span>
          <ChevronDown className="size-3 shrink-0 opacity-50" />
        </button>
        {locOpen && (
          <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-xl border border-border bg-popover p-2.5 shadow-lg">
            <button
              type="button"
              onClick={() => {
                setAllLocations(true);
                setLocOpen(false);
              }}
              className={`block w-full rounded-lg px-2.5 py-2 text-left text-xs hover:bg-accent ${
                allLocations ? "font-semibold text-primary" : ""
              }`}
            >
              All locations
            </button>
            <p className="px-2.5 pb-2 text-[10px] leading-snug text-muted-foreground">
              Show every live campaign, not just nearby.
            </p>
            <div className="mb-2 border-t border-border" />
            <label className="text-[11px] font-medium text-muted-foreground">Or search by ZIP</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={5}
              value={zipInput}
              onChange={(e) => setZipInput(e.target.value)}
              placeholder="e.g. 19311"
              className="mt-1 w-full rounded-lg border border-border px-2.5 py-1.5 text-sm"
            />
            {zipError && <p className="mt-1 text-[11px] text-destructive">{zipError}</p>}
          </div>
        )}
      </div>
      {!allLocations && (
      <div className="relative" ref={radRef}>
        <button
          type="button"
          onClick={() => {
            setRadOpen((v) => !v);
            setLocOpen(false);
          }}
          className="inline-flex items-center gap-0.5 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold sm:text-xs"
        >
          {radiusMiles} mi
          <ChevronDown className="size-3 opacity-50" />
        </button>
        {radOpen && (
          <div className="absolute right-0 top-full z-50 mt-1 w-28 rounded-xl border border-border bg-popover p-1 shadow-lg">
            {RADIUS_PRESETS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setRadiusMiles(m);
                  setRadOpen(false);
                }}
                className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-xs hover:bg-accent ${
                  radiusMiles === m ? "font-semibold text-primary" : ""
                }`}
              >
                {m} mi
              </button>
            ))}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
