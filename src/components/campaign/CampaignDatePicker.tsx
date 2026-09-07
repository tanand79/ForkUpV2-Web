"use client";

/**
 * Popover date picker for filtering live campaigns by campaign run dates.
 * Sits inline next to "Live Campaigns" — calendar only opens on click.
 */
import { useState } from "react";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toDateOnlyString } from "@/lib/date-only";
import type { CampaignListItem } from "@/lib/campaign-types";

export type CampaignDatePickerProps = {
  campaigns: CampaignListItem[];
  selected?: Date;
  onSelect?: (date: Date | undefined) => void;
};

/** Whether a campaign's start/end range includes the given calendar day (YYYY-MM-DD compare). */
export function campaignMatchesDate(campaign: CampaignListItem, date: Date | string): boolean {
  const ymd = toDateOnlyString(date);
  if (!ymd) return false;
  const start = toDateOnlyString(campaign.startDate);
  const end = toDateOnlyString(campaign.endDate);
  if (!start || !end) return false;
  return ymd >= start && ymd <= end;
}

/** True when the campaign end date is before today (no longer in the public live window). */
export function campaignHasEnded(campaign: CampaignListItem, asOf = new Date()): boolean {
  const end = toDateOnlyString(campaign.endDate);
  const today = toDateOnlyString(asOf);
  return Boolean(end && today && today > end);
}

function isoToLocalDate(iso: string | undefined): Date | undefined {
  if (!iso) return undefined;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

export function CampaignDatePicker({ campaigns, selected, onSelect }: CampaignDatePickerProps) {
  const [open, setOpen] = useState(false);
  const selectedIso = selected ? toDateOnlyString(selected) : "";
  const calendarSelected = isoToLocalDate(selectedIso);
  const label = selectedIso
    ? calendarSelected!.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "Pick a date";

  return (
    <div className="flex items-center gap-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent ${
              selectedIso ? "border-primary/40 bg-primary/5 text-primary" : "border-border text-muted-foreground"
            }`}
          >
            <CalendarIcon className="size-3.5" />
            {label}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start" sideOffset={6}>
          <Calendar
            mode="single"
            selected={calendarSelected}
            defaultMonth={calendarSelected ?? new Date()}
            onSelect={(date) => {
              if (!date) return;
              onSelect?.(date);
              setOpen(false);
            }}
            showOutsideDays
            className="p-1 [--cell-size:2rem]"
            modifiers={{ hasCampaign: (date) => campaigns.some((c) => campaignMatchesDate(c, date)) }}
            modifiersClassNames={{
              hasCampaign:
                "relative after:absolute after:bottom-0.5 after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-primary",
            }}
          />
        </PopoverContent>
      </Popover>
      {selectedIso && (
        <button
          type="button"
          onClick={() => onSelect?.(undefined)}
          className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Clear date filter"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
