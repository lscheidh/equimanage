import { supabase } from './supabase';

/** Platzhalterbild für Pferde (Pferd, lizenzfrei). */
export const HORSE_PLACEHOLDER_IMAGE =
  'https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?w=400&h=300&fit=crop';

const BUCKET = 'horse-images';

/**
 * Lädt ein Pferdebild in Supabase Storage hoch.
 * Pfad: {ownerId}/{horseIdOrNew}_{uuid}.{ext}
 * @returns Öffentliche URL des hochgeladenen Bildes
 */
export async function uploadHorseImage(
  file: File,
  ownerId: string,
  horseId?: string | null
): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const base = horseId ? `${horseId}` : 'new';
  const path = `${ownerId}/${base}_${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });

  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
