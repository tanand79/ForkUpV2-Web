/**
 * Featured YouTube watch/Shorts helpers (frontend, additive).
 *
 * Purpose: Parse and normalize campaign featured video URLs for the cover
 * picker and public hero slider. Channel / @handle links are rejected.
 *
 * Inputs: raw URL string from the organizer.
 * Outputs: normalized watch URL + video id, or null.
 */

export interface FeaturedYoutubeParsed {
  /** Normalized https://www.youtube.com/watch?v=… or /shorts/… URL */
  url: string;
  /** 11-char YouTube video id for embed / thumbnail */
  videoId: string;
}

/**
 * Extract an 11-char video id from a YouTube watch, Shorts, or youtu.be URL.
 * Inputs: raw href. Outputs: video id or null.
 */
export function extractYouTubeVideoId(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    let withProto = trimmed;
    if (!/^https?:\/\//i.test(withProto)) {
      if (/^(youtube\.com|youtu\.be|m\.youtube\.com)/i.test(withProto)) {
        withProto = `https://${withProto}`;
      } else {
        return null;
      }
    }
    const u = new URL(withProto);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (host !== "youtube.com" && host !== "youtu.be" && host !== "m.youtube.com") {
      return null;
    }
    if (host === "youtu.be") {
      const id = u.pathname.replace(/^\//, "").split("/")[0] || "";
      return /^[\w-]{11}$/.test(id) ? id : null;
    }
    const v = u.searchParams.get("v");
    if (v && /^[\w-]{11}$/.test(v)) return v;
    const shorts = u.pathname.match(/\/shorts\/([\w-]{11})/i);
    if (shorts?.[1]) return shorts[1];
    const embed = u.pathname.match(/\/embed\/([\w-]{11})/i);
    if (embed?.[1]) return embed[1];
    return null;
  } catch {
    return null;
  }
}

/**
 * Normalize a featured YouTube video URL (watch or Shorts only).
 * Inputs: raw URL. Outputs: { url, videoId } or null when empty/invalid.
 */
export function parseFeaturedYoutubeUrl(
  raw: string | null | undefined,
): FeaturedYoutubeParsed | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const videoId = extractYouTubeVideoId(trimmed);
  if (!videoId) return null;
  // Prefer watch URL for storage consistency with the server helper.
  if (/\/shorts\//i.test(trimmed)) {
    return {
      url: `https://www.youtube.com/shorts/${videoId}`,
      videoId,
    };
  }
  return {
    url: `https://www.youtube.com/watch?v=${videoId}`,
    videoId,
  };
}

/**
 * Thumbnail URL for a YouTube video id (mqdefault).
 * Inputs: videoId. Outputs: https img.youtube.com URL.
 */
export function youtubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}
