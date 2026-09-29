"use client";

/**
 * Google Maps embed for business / NPO profile location.
 * Uses the same address-query iframe pattern as SearchRadiusControl
 * (no API key required). Renders nothing when address is empty.
 */

type Props = {
  address: string;
  title?: string;
  className?: string;
};

export function LocationMapEmbed({
  address,
  title = "Location map",
  className = "",
}: Props) {
  const q = address.trim();
  if (!q) return null;

  const embedSrc = `https://maps.google.com/maps?q=${encodeURIComponent(q)}&hl=en&z=15&output=embed`;
  const openSrc = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

  return (
    <section className={className} aria-label={title}>
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-venue-accent">
        Location
      </p>
      <div className="relative overflow-hidden rounded-sm border border-venue-line bg-venue-soft">
        <iframe
          title={title}
          src={embedSrc}
          className="h-64 w-full border-0 sm:h-80"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </div>
      <a
        href={openSrc}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-block text-sm font-medium text-venue-accent hover:text-venue-accent-strong"
      >
        Open in Google Maps →
      </a>
    </section>
  );
}
