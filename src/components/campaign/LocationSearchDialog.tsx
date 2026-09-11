"use client";

/**
 * Resy-style Change Location dialog for Live Campaigns.
 * Purpose: Full search overlay (not a tiny dropdown) — ZIP + radius (default 20 mi).
 * Inputs: open state, place label, zip/radius from useCampaignNearby().
 * Outputs: calls setZipInput / setRadiusMiles; closes on select.
 */
import { MapPin, Search, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { RADIUS_PRESETS } from "@/hooks/use-campaign-nearby";

/** Curated US metros → representative ZIP (quick-pick grid, Resy-style columns). */
const POPULAR_LOCATIONS: { label: string; zip: string }[] = [
  { label: "Atlanta", zip: "30303" },
  { label: "Austin", zip: "78701" },
  { label: "Boston", zip: "02108" },
  { label: "Chicago", zip: "60601" },
  { label: "Dallas", zip: "75201" },
  { label: "Denver", zip: "80202" },
  { label: "Houston", zip: "77002" },
  { label: "Los Angeles", zip: "90012" },
  { label: "Miami", zip: "33131" },
  { label: "Nashville", zip: "37203" },
  { label: "New York", zip: "10001" },
  { label: "Philadelphia", zip: "19102" },
  { label: "Phoenix", zip: "85003" },
  { label: "Portland", zip: "97201" },
  { label: "San Francisco", zip: "94102" },
  { label: "Seattle", zip: "98101" },
  { label: "Washington D.C.", zip: "20001" },
];

type LocationSearchDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationLabel: string;
  zipInput: string;
  setZipInput: (zip: string) => void;
  zipError: string | null;
  radiusMiles: number;
  setRadiusMiles: (miles: number) => void;
  allLocations: boolean;
  setAllLocations: (value: boolean) => void;
};

export function LocationSearchDialog({
  open,
  onOpenChange,
  locationLabel,
  zipInput,
  setZipInput,
  zipError,
  radiusMiles,
  setRadiusMiles,
  allLocations,
  setAllLocations,
}: LocationSearchDialogProps) {
  const selectZip = (zip: string) => {
    setZipInput(zip);
    onOpenChange(false);
  };

  const selectAllLive = () => {
    setAllLocations(true);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] w-[calc(100%-1.5rem)] max-w-lg gap-0 overflow-y-auto rounded-2xl border-border p-0 sm:w-full [&>button]:hidden"
        aria-describedby={undefined}
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-5">
          <DialogTitle className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Change location
          </DialogTitle>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex size-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <DialogDescription className="sr-only">
          Search by ZIP code to find live campaigns within {radiusMiles} miles, or show all live campaigns.
        </DialogDescription>

        <div className="px-5 pb-3">
          <button
            type="button"
            onClick={selectAllLive}
            className={`mb-3 flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors hover:bg-accent ${
              allLocations ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            <MapPin className="size-4 shrink-0 text-primary" />
            <span className="text-sm font-semibold text-foreground">All live campaigns</span>
            <span className="ml-auto text-[10px] text-muted-foreground">No distance filter</span>
          </button>

          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2.5">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              type="text"
              inputMode="numeric"
              maxLength={5}
              value={zipInput}
              onChange={(e) => setZipInput(e.target.value)}
              placeholder="Search by ZIP…"
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              autoFocus
            />
            {zipInput ? (
              <button
                type="button"
                onClick={() => setZipInput("")}
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            ) : null}
          </div>
          {zipError ? (
            <p className="mt-2 text-xs text-destructive">{zipError}</p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              Pick a ZIP or city to filter within {radiusMiles} miles.
            </p>
          )}
        </div>

        <div className="border-t border-border px-5 py-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Radius
          </p>
          <div className="flex flex-wrap gap-2">
            {RADIUS_PRESETS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setRadiusMiles(m)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  radiusMiles === m
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-foreground hover:bg-accent"
                }`}
              >
                {m} mi
              </button>
            ))}
          </div>
        </div>

        {zipInput.replace(/\D/g, "").length === 5 && !zipError && locationLabel !== "Set ZIP" ? (
          <div className="border-t border-border px-5 py-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Match
            </p>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex w-full items-center gap-2 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-accent"
            >
              <MapPin className="size-4 shrink-0 text-primary" />
              <span className="text-base font-semibold text-foreground">{locationLabel}</span>
              <span className="ml-auto text-xs text-muted-foreground">{zipInput} · {radiusMiles} mi</span>
            </button>
          </div>
        ) : null}

        <div className="border-t border-border px-5 pb-5 pt-3">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Popular cities
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {POPULAR_LOCATIONS.map((place) => (
              <button
                key={place.zip}
                type="button"
                onClick={() => selectZip(place.zip)}
                className="truncate rounded-lg px-1.5 py-2 text-left text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-primary"
              >
                {place.label}
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
