import { supabase } from './supabase';
import { checkVaccinationCompliance } from '../logic';
import type { Horse, Profile } from '../types';

export interface DueItemForNotify {
  horseId: string;
  horseName: string;
  type: string;
  sequence: string;
  status: string;
  message: string;
}

/**
 * Prüft Fälligkeiten und ruft die Edge Function auf, um bei neuen Fälligkeiten
 * eine E-Mail an den Besitzer zu senden. Wird beim Laden der Stallübersicht aufgerufen.
 */
export async function checkAndNotifyVaccinationDue(
  profile: Profile,
  horses: Horse[]
): Promise<void> {
  if (!profile?.notify_vaccination) return;
  if (horses.length === 0) return;

  const items: DueItemForNotify[] = [];
  for (const horse of horses) {
    const compliance = checkVaccinationCompliance(horse);
    for (const di of compliance.dueItems) {
      items.push({
        horseId: horse.id,
        horseName: horse.name,
        type: di.type,
        sequence: di.sequence,
        status: di.status,
        message: di.message,
      });
    }
  }

  if (items.length === 0) return;

  const email = (await import('./authService').then((m) => m.getCurrentUserEmail())) ?? '';
  if (!email) return;

  const ownerName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Nutzer';

  try {
    await supabase.functions.invoke('check-vaccination-due', {
      body: {
        ownerId: profile.id,
        ownerEmail: email,
        ownerName,
        items,
      },
    });
  } catch (e) {
    console.warn('checkAndNotifyVaccinationDue:', e);
  }
}
