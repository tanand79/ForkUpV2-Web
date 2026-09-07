/**
 * Geocode a US ZIP via Zippopotam (no API key).
 * Inputs: zip string. Outputs: lat/lng + optional city/state, or null.
 */
export async function geocodeUsZip(zipRaw: string): Promise<{
  latitude: number;
  longitude: number;
  city: string | null;
  state: string | null;
} | null> {
  const zip = zipRaw.replace(/\D/g, "").slice(0, 5);
  if (zip.length !== 5) return null;
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      places?: Array<{
        latitude?: string;
        longitude?: string;
        "place name"?: string;
        "state abbreviation"?: string;
      }>;
    };
    const place = data.places?.[0];
    const latitude = Number(place?.latitude);
    const longitude = Number(place?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return {
      latitude,
      longitude,
      city: place?.["place name"]?.trim() || null,
      state: place?.["state abbreviation"]?.trim() || null,
    };
  } catch {
    return null;
  }
}
