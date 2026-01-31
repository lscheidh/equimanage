import { supabase } from './supabase';
import { checkHoofCareStatus } from '../logic';
import type { Horse, Profile } from '../types';

export interface HoofItemForNotify {
  horseId: string;
  horseName: string;
  status: 'yellow' | 'red';
  daysSince: number;
  message: string;
}

/**
 * Prüft Hufschmied-Fälligkeiten und ruft die Edge Function auf, um bei neuem Status
 * (fällig >42 Tage, kritisch >56 Tage) eine E-Mail an den Besitzer zu senden.
 */
export async function checkAndNotifyHoofDue(
  profile: Profile,
  horses: Horse[]
): Promise<void> {
  if (!profile?.notify_hoof) return;
  if (horses.length === 0) return;

  const items: HoofItemForNotify[] = [];
  for (const horse of horses) {
    const { status, daysSince } = checkHoofCareStatus(horse);
    if (status === 'YELLOW') {
      items.push({
        horseId: horse.id,
        horseName: horse.name,
        status: 'yellow',
        daysSince,
        message: `Letzter Schmied vor ${daysSince} Tagen. Erinnere dich an einen Termin.`,
      });
    } else if (status === 'RED') {
      items.push({
        horseId: horse.id,
        horseName: horse.name,
        status: 'red',
        daysSince,
        message: `Letzter Schmied vor ${daysSince} Tagen. Dringend Termin vereinbaren.`,
      });
    }
  }

  if (items.length === 0) return;

  const email = (await import('./authService').then((m) => m.getCurrentUserEmail())) ?? '';
  if (!email) return;

  const ownerName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Nutzer';

  try {
    await supabase.functions.invoke('check-hoof-due', {
      body: {
        ownerId: profile.id,
        ownerEmail: email,
        ownerName,
        items,
      },
    });
  } catch (e) {
    console.warn('checkAndNotifyHoofDue:', e);
  }
}
