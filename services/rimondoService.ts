import { supabase } from './supabase';

/** Relevante Felder aus Rimondo für Pferd (aus #base_data Tabelle + URL). */
export interface RimondoParsed {
  name?: string;
  breed?: string;
  birthYear?: number;
  gender?: 'Hengst' | 'Stute' | 'Wallach' | null;
  breedingAssociation?: string;
  isoNr?: string;
  feiNr?: string;
}

const RIMONDO_PATTERN = /^https:\/\/(www\.)?rimondo\.com\/.+/i;

export function isRimondoUrl(url: string): boolean {
  return RIMONDO_PATTERN.test((url || '').trim());
}

/** Name aus URL-Slug: /horse-details/1754189/daydream-z → Daydream Z */
export function extractNameFromRimondoUrl(url: string): string | undefined {
  const m = /horse-details\/\d+\/([a-z0-9_-]+)(?:\/|$)/i.exec((url || '').trim());
  if (!m?.[1]) return undefined;
  return m[1]
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/** Mindestdaten aus URL extrahieren (funktioniert auch ohne Edge Function). Nur Name aus Slug. */
function getFallbackFromUrl(url: string): RimondoParsed {
  const name = extractNameFromRimondoUrl(url);
  const out: RimondoParsed = {};
  if (name) out.name = name;
  return out;
}

const RIMONDO_FETCH_TIMEOUT_MS = 18000;

/**
 * Ruft Edge Function rimondo-fetch auf und liefert geparste Pferdedaten.
 * Fallback: Name aus URL-Slug, wenn Edge Function fehlschlägt oder nicht deployed ist.
 */
export async function fetchRimondoData(url: string): Promise<RimondoParsed> {
  const u = (url || '').trim();
  if (!u || !isRimondoUrl(u)) return {};
  const fallback = getFallbackFromUrl(u);
  try {
    const invokePromise = supabase.functions.invoke<RimondoParsed>('rimondo-fetch', {
      body: { url: u },
    });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), RIMONDO_FETCH_TIMEOUT_MS)
    );
    const { data, error } = await Promise.race([invokePromise, timeoutPromise]);
    if (error) return fallback;
    const result = (data && typeof data === 'object') ? data : {};
    if (!result.name) result.name = fallback.name;
    const hasAny = result.name || result.breed || result.birthYear || result.gender || result.breedingAssociation || result.isoNr || result.feiNr;
    return hasAny ? result : fallback;
  } catch {
    return fallback;
  }
}
