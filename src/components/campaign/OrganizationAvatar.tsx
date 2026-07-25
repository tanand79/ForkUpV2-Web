"use client";

/**
 * Organization avatar for search suggestions / confirm cards.
 *
 * Purpose: Show an org profile image when available; otherwise a stable
 * initials avatar (IRS/US directory rows have no logo in ProPublica data).
 *
 * Inputs: organizationName, optional logoUrl, optional website
 * Outputs: rounded image or initials tile (same size as prior Building2 slot)
 */

import { useMemo, useState } from "react";

const SIZE_CLASS = "size-9";

function initialsFromName(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0 && !/^(inc|llc|ltd|the|of|and|a)$/i.test(w));
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

/** Deterministic warm tone from name (matches ForkUp cream/brown UI). */
function toneFromName(name: string): { bg: string; fg: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const tones = [
    { bg: "#E8DFD4", fg: "#5C4A3A" },
    { bg: "#D9E5DC", fg: "#3D5A45" },
    { bg: "#E5D9E8", fg: "#5A3D5C" },
    { bg: "#D9E0E8", fg: "#3D4A5A" },
    { bg: "#E8E0D9", fg: "#5A4A3D" },
    { bg: "#E8D9D9", fg: "#5A3D3D" },
  ];
  return tones[Math.abs(hash) % tones.length]!;
}

function domainFromWebsite(website: string | null | undefined): string | null {
  if (!website?.trim()) return null;
  try {
    let raw = website.trim();
    if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
    return new URL(raw).hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

function faviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
}

interface OrganizationAvatarProps {
  organizationName: string;
  logoUrl?: string | null;
  website?: string | null;
  className?: string;
}

export function OrganizationAvatar({
  organizationName,
  logoUrl,
  website,
  className = SIZE_CLASS,
}: OrganizationAvatarProps) {
  const [failed, setFailed] = useState<string | null>(null);
  const domain = useMemo(() => domainFromWebsite(website), [website]);
  const tone = useMemo(() => toneFromName(organizationName), [organizationName]);
  const initials = useMemo(() => initialsFromName(organizationName), [organizationName]);

  const candidates = useMemo(() => {
    const urls: string[] = [];
    if (logoUrl?.trim()) urls.push(logoUrl.trim());
    if (domain) urls.push(faviconUrl(domain));
    return urls;
  }, [logoUrl, domain]);

  const src = candidates.find((u) => u !== failed) ?? null;

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote favicon/logo URLs; no next/image domain allowlist needed
      <img
        src={src}
        alt=""
        className={`${className} shrink-0 rounded-lg object-cover bg-secondary`}
        onError={() => setFailed(src)}
      />
    );
  }

  return (
    <div
      className={`${className} flex shrink-0 items-center justify-center rounded-lg text-[11px] font-bold tracking-wide`}
      style={{ backgroundColor: tone.bg, color: tone.fg }}
      aria-hidden
    >
      {initials}
    </div>
  );
}
