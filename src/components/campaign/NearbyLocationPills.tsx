"use client";

/**
 * Location trigger next to Live Campaigns / Business.
 * Purpose: Default "Near Me"; click opens Change Location dialog.
 * Inputs: return value from useCampaignNearby() in the parent.
 */
import { useState } from "react";
import { ChevronDown, MapPin } from "lucide-react";
import {
  LocationSearchDialog,
  type LocationSearchVariant,
} from "@/components/campaign/LocationSearchDialog";

type NearbyPillsProps = {
  locationLabel: string;
  zipInput: string;
  setZipInput: (zip: string) => void;
  zipError: string | null;
  radiusMiles: number;
  setRadiusMiles: (miles: number) => void;
  allLocations: boolean;
  nearMe: boolean;
  setAllLocations: (value: boolean) => void;
  setNearMe: () => void;
  variant?: LocationSearchVariant;
};

export function NearbyLocationPills({
  locationLabel,
  zipInput,
  setZipInput,
  zipError,
  radiusMiles,
  setRadiusMiles,
  allLocations,
  nearMe,
  setAllLocations,
  setNearMe,
  variant = "campaigns",
}: NearbyPillsProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex max-w-[200px] items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium sm:max-w-[240px] sm:text-xs"
      >
        <MapPin className="size-3 shrink-0 text-primary" />
        <span className="truncate">{locationLabel}</span>
        {!allLocations ? (
          <span className="shrink-0 text-muted-foreground">· {radiusMiles} mi</span>
        ) : null}
        <ChevronDown className="size-3 shrink-0 opacity-50" />
      </button>

      <LocationSearchDialog
        open={open}
        onOpenChange={setOpen}
        locationLabel={locationLabel}
        zipInput={zipInput}
        setZipInput={setZipInput}
        zipError={zipError}
        radiusMiles={radiusMiles}
        setRadiusMiles={setRadiusMiles}
        allLocations={allLocations}
        nearMe={nearMe}
        setAllLocations={setAllLocations}
        setNearMe={setNearMe}
        variant={variant}
      />
    </div>
  );
}
