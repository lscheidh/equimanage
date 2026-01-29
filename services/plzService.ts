/**
 * PLZ-Geocoding (DE) und Distanzberechnung für z. B. Tierarztsuche im Umkreis.
 * Nutzt api.zippopotam.us (kostenlos, keine Registrierung).
 */

const GEOCODE_URL = 'https://api.zippopotam.us/de';

export interface Coord {
  lat: number;
  lon: number;
}

const cache = new Map<string, Coord | null>();

export async function geocodePlz(plz: string): Promise<Coord | null> {
  const key = plz.replace(/\D/g, '').slice(0, 5);
  if (key.length < 5) return null;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  try {
    const res = await fetch(`${GEOCODE_URL}/${key}`);
    if (!res.ok) {
      cache.set(key, null);
      return null;
    }
    const data = (await res.json()) as { places?: Array<{ latitude: string; longitude: string }> };
    const p = data.places?.[0];
    if (!p) {
      cache.set(key, null);
      return null;
    }
    const coord: Coord = { lat: parseFloat(p.latitude), lon: parseFloat(p.longitude) };
    cache.set(key, coord);
    return coord;
  } catch {
    cache.set(key, null);
    return null;
  }
}

/** Haversine-Distanz in km. */
export function distanceKm(a: Coord, b: Coord): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function isPlzQuery(q: string): boolean {
  return /^\d{5}$/.test((q || '').trim());
}
