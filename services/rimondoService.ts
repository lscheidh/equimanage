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

/** ID aus Rimondo-URL extrahieren (z. B. /horse-details/1355396/...) → FEI-Nr. */
export function extractFeiNrFromRimondoUrl(url: string): string | undefined {
  const m = /horse-details\/(\d+)(?:\/|$)/i.exec((url || '').trim());
  return m?.[1];
}

/**
 * Ruft Edge Function rimondo-fetch auf und liefert geparste Pferdedaten.
 * Bei Fehler oder ungültiger URL leeres Objekt.
 */
export async function fetchRimondoData(url: string): Promise<RimondoParsed> {
  const u = (url || '').trim();
  if (!u || !isRimondoUrl(u)) return {};
  try {
    const { data, error } = await supabase.functions.invoke<RimondoParsed>('rimondo-fetch', {
      body: { url: u },
    });
    if (error) return {};
    const result = (data && typeof data === 'object') ? data : {};
    const feiFromUrl = extractFeiNrFromRimondoUrl(u);
    if (feiFromUrl && !result.feiNr) result.feiNr = feiFromUrl;
    return result;
  } catch {
    return {};
  }
}
