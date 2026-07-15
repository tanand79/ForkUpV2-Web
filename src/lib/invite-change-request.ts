import type { BusinessChangeRequest } from "@/lib/campaign-context";
import { formatDateOnlyLabel, parseFlexibleDateInput, toDateOnlyString } from "@/lib/date-only";

/**
 * Parse the combined change-request text stored when a business submits
 * "Request changes" (preferred date / giveback lines + free-text message).
 */
export function parseChangeRequestMessage(
  raw: string | null | undefined,
): BusinessChangeRequest {
  if (!raw?.trim()) return {};

  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let preferredDate: string | undefined;
  let preferredGiveback: number | undefined;
  const messageLines: string[] = [];

  for (const line of lines) {
    const dateMatch = line.match(/^preferred\s+date(?:\/time)?\s*:\s*(.+)$/i);
    if (dateMatch) {
      const value = dateMatch[1].trim();
      preferredDate = parseFlexibleDateInput(value) || value;
      continue;
    }
    const givebackMatch = line.match(
      /^preferred\s+giveback\s*:\s*(\d+(?:\.\d+)?)\s*%?\s*$/i,
    );
    if (givebackMatch) {
      preferredGiveback = Number(givebackMatch[1]);
      continue;
    }
    messageLines.push(line);
  }

  if (!preferredDate && preferredGiveback == null && messageLines.length === 0) {
    return { message: raw.trim() };
  }

  return {
    preferredDate,
    preferredGiveback,
    message: messageLines.length > 0 ? messageLines.join("\n") : undefined,
  };
}

export function changeRequestFromApiMessage(
  raw: string | null | undefined,
): BusinessChangeRequest | undefined {
  const parsed = parseChangeRequestMessage(raw);
  if (!parsed.message && !parsed.preferredDate && parsed.preferredGiveback == null) {
    return undefined;
  }
  return parsed;
}

function formatPreferredDateLabel(raw?: string): string | null {
  if (!raw?.trim()) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return formatDateOnlyLabel(raw, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
  return raw.trim();
}

/** UI-ready labels for the nonprofit review screen. */
export function displayChangeRequestFields(raw: string | null | undefined) {
  const parsed = parseChangeRequestMessage(raw);
  const rawTrim = raw?.trim() ?? "";

  const preferredDateLabel = formatPreferredDateLabel(parsed.preferredDate);
  const preferredGivebackLabel =
    parsed.preferredGiveback != null ? `${parsed.preferredGiveback}%` : null;

  let messageLabel = parsed.message?.trim() || null;
  if (!messageLabel && rawTrim && !preferredDateLabel && !preferredGivebackLabel) {
    messageLabel = rawTrim;
  }

  return {
    parsed,
    preferredDateLabel,
    preferredGivebackLabel,
    messageLabel,
  };
}
