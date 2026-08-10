"use client";

/**
 * Public campaign Guest Bartending event block.
 *
 * Purpose: When a campaign includes method_type `guest_bartending_event`, show a
 * dedicated section (event date + venue CTAs) instead of only a bottom method tag.
 *
 * Inputs:
 *   - eventDate: YYYY-MM-DD from public campaign API (nullable)
 *   - nonprofitName: organizer display name
 *   - hasVenues: whether accepted guest-bartending locations exist
 *   - children: venue / LocationCard list rendered by the parent
 *
 * Outputs: section markup with id `guest-bartending` for in-page scroll targets.
 */

import type { ReactNode } from "react";
import { Calendar, GlassWater } from "lucide-react";
import { formatDateUs } from "@/lib/date-only";

export function PublicCampaignGuestBartendingSection({
  eventDate,
  nonprofitName,
  hasVenues = false,
  children,
}: {
  eventDate?: string | null;
  nonprofitName: string;
  hasVenues?: boolean;
  children?: ReactNode;
}) {
  const eventLabel = eventDate ? formatDateUs(eventDate) : null;

  return (
    <section id="guest-bartending" className="mt-10 scroll-mt-24">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <GlassWater className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-bold">Guest Bartending Night</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Come out for a special guest bartending event supporting {nonprofitName}. Tips and
            donations help the cause — bring friends and cheer on the guest bartenders.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-border bg-card p-5">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
          <Calendar className="size-4 text-primary" />
          {eventLabel && eventLabel !== "—" ? `Event date: ${eventLabel}` : "Event date coming soon"}
        </p>
        {!hasVenues && (
          <p className="mt-2 text-sm text-muted-foreground">
            Venue details will appear here once a hosting business accepts this event.
          </p>
        )}
      </div>

      {hasVenues ? <ul className="mt-6 space-y-4">{children}</ul> : null}
    </section>
  );
}
