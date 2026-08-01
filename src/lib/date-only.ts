const DATE_ONLY_RE = /^(\d{4}-\d{2}-\d{2})/;

/** Normalize a calendar date to YYYY-MM-DD without UTC timezone drift. */
export function toDateOnlyString(value: string | Date | null | undefined): string {
  if (value == null || value === "") return "";
  if (typeof value === "string") {
    const match = DATE_ONLY_RE.exec(value.trim());
    return match ? match[1] : "";
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return "";
}

/** Subtract whole calendar days from a YYYY-MM-DD string. */
export function subtractCalendarDays(dateStr: string, days: number): string {
  const base = toDateOnlyString(dateStr);
  if (!base) return dateStr;
  const [y, m, d] = base.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - days);
  return toDateOnlyString(dt) || dateStr;
}

/** Format YYYY-MM-DD for display in the user's locale. */
export function formatDateOnlyLabel(
  dateStr: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const iso = toDateOnlyString(dateStr);
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, options);
}

/** Format YYYY-MM-DD as US numeric MM/DD/YYYY for date inputs. */
export function formatMmDdYyyy(value: string | Date | null | undefined): string {
  const iso = toDateOnlyString(value);
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
}

/**
 * Format a calendar date in US standard with weekday.
 * Example: Saturday, August 1, 2026
 * Inputs: ISO date string, Date, or nullish. Outputs: display string or "—".
 */
export function formatDateUs(value: string | Date | null | undefined): string {
  if (value == null || value === "") return "—";
  const iso = typeof value === "string" ? toDateOnlyString(value) : toDateOnlyString(value);
  const d =
    iso.length === 10
      ? new Date(`${iso}T00:00:00`)
      : value instanceof Date
        ? value
        : new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Format a date-time in US standard with weekday and 12-hour AM/PM.
 * Example: Saturday, August 1, 2026, 2:25 AM
 * Inputs: ISO datetime string, Date, or nullish. Outputs: display string or "—".
 */
export function formatDateTimeUs(value: string | Date | null | undefined): string {
  if (value == null || value === "") return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** True when a string looks like an ISO date-time (has a T time component). */
export function looksLikeIsoDateTime(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T/.test(value.trim());
}

/**
 * Parse human-entered dates (ISO, "June 15", "june15", "6/15/2026") to YYYY-MM-DD.
 */
export function parseFlexibleDateInput(raw: string | null | undefined): string {
  if (!raw?.trim()) return "";

  const iso = toDateOnlyString(raw);
  if (iso) return iso;

  const trimmed = raw.trim();

  const monthDayYear = trimmed.match(/^([a-zA-Z]+)\s*(\d{1,2})(?:\s*,?\s*(\d{4}))?$/);
  if (monthDayYear) {
    const year = monthDayYear[3] ?? String(new Date().getFullYear());
    const attempt = new Date(`${monthDayYear[1]} ${monthDayYear[2]}, ${year}`);
    if (!Number.isNaN(attempt.getTime())) return toDateOnlyString(attempt) || "";
  }

  const slashDate = trimmed.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (slashDate) {
    const year =
      slashDate[3]?.length === 2
        ? 2000 + Number(slashDate[3])
        : slashDate[3]
          ? Number(slashDate[3])
          : new Date().getFullYear();
    const attempt = new Date(year, Number(slashDate[1]) - 1, Number(slashDate[2]));
    if (!Number.isNaN(attempt.getTime())) return toDateOnlyString(attempt) || "";
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) return toDateOnlyString(parsed) || "";

  return "";
}
