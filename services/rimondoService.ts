import { supabase } from './supabase';

/** Relevante Felder aus Rimondo für Pferd (Name, Rasse, Geburtsjahr, Geschlecht, ggf. Zuchtverband). */
export interface RimondoParsed {
  name?: string;
  breed?: string;
  birthYear?: number;
  gender?: 'Hengst' | 'Stute' | 'Wallach' | null;
  breedingAssociation?: string;
}

const RIMONDO_PATTERN = /^https:\/\/(www\.)?rimondo\.com\/.+/i;

export function isRimondoUrl(url: string): boolean {
  return RIMONDO_PATTERN.test((url || '').trim());
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
    return (data && typeof data === 'object') ? data : {};
  } catch {
    return {};
  }
}
