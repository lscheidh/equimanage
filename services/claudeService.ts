import { supabase } from './supabase';
import type { Horse } from '../types';

/** Ruft Edge Function auf (Keys serverseitig). */
export const extractHorseDataFromImage = async (base64Image: string) => {
  try {
    const { data, error } = await supabase.functions.invoke('ai-extract-horse', {
      body: { base64Image },
    });
    if (error) throw error;
    if (data && typeof data === 'object' && !('error' in data)) return data as Record<string, unknown>;
    return null;
  } catch (error) {
    console.error('AI Extraction failed:', error);
    return null;
  }
};

/** Ruft Edge Function auf (Keys serverseitig). */
export const analyzeHealth = async (horse: Horse) => {
  try {
    const { data, error } = await supabase.functions.invoke('ai-analyze-health', {
      body: { horse },
    });
    if (error) throw error;
    if (data && typeof data === 'object' && 'text' in data && typeof data.text === 'string') return data.text;
    return 'Fehler bei der Analyse. Bitte konsultieren Sie Ihren Tierarzt.';
  } catch (error) {
    console.error('AI Analysis failed:', error);
    return 'Fehler bei der Analyse. Bitte konsultieren Sie Ihren Tierarzt.';
  }
};
