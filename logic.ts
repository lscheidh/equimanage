
import { Horse, ComplianceStatus, ServiceRecord } from './types';

/**
 * Validierungskonstanten:
 * ISO-Nr (UELN): 2-stelliger Ländercode (ISO 3166) + 13-stellige ID.
 * Reg.-Nr.: Optional, z.B. 8 Ziffern.
 * Chip-ID: 15-stelliger numerischer Code (ISO 11784/11785).
 */
export const VALIDATION_PATTERNS = {
  ISO_NR: /^[A-Z]{2}\s?[\dA-Z]{8,15}$/,
  REG_NR: /^(\d{8}|\d{2}[A-Z]{2}\d{2,5})$/,
  CHIP_ID: /^\d{15}$/,
  BIRTH_YEAR: (year: number) => year >= 1980 && year <= new Date().getFullYear(),
  WEIGHT: (weight: number) => weight >= 50 && weight <= 1500,
};

const DAYS_V2_MIN = 28;
const DAYS_V2_MAX = 70;
const DAYS_V3_AFTER_V2 = 6 * 30 + 21; // 6 Monate + 21 Tage
const DAYS_BOOSTER_AFTER_V3 = 6 * 30 + 21;
const NOTIFY_DAYS_BEFORE = 14;

function daysSince(d: Date): number {
  return Math.floor((Date.now() - d.getTime()) / (1000 * 3600 * 24));
}

/**
 * Impf-Compliance:
 * V2 frühestens 28, spätestens 70 Tage nach V1.
 * V3: 6 Monate + 21 Tage nach V2.
 * Booster: 6 Monate + 21 Tage nach V3 (und danach wieder Booster).
 * Mitteilung: 14 Tage vor dem frühesten Fälligkeitstag.
 */
export function checkVaccinationCompliance(horse: Horse): { status: ComplianceStatus; message: string } {
  const sorted = [...horse.vaccinations].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  if (sorted.length === 0) return { status: ComplianceStatus.RED, message: 'Keine Impfdaten gefunden.' };

  const last = sorted[0];
  const lastDate = new Date(last.date);
  const d = daysSince(lastDate);
  const seq = last.sequence || (last.isBooster ? 'Booster' : 'V1');

  let dueMin: number;
  let dueMax: number;
  let phase: string;

  if (seq === 'V1') {
    dueMin = DAYS_V2_MIN;
    dueMax = DAYS_V2_MAX;
    phase = 'V2';
  } else if (seq === 'V2') {
    dueMin = dueMax = DAYS_V3_AFTER_V2;
    phase = 'V3';
  } else {
    dueMin = dueMax = seq === 'V3' ? DAYS_BOOSTER_AFTER_V3 : DAYS_BOOSTER_AFTER_V3;
    phase = 'Booster';
  }

  const notifyFrom = dueMin - NOTIFY_DAYS_BEFORE;

  if (d > dueMax) {
    return { status: ComplianceStatus.RED, message: `${phase} überfällig (${d - dueMax} Tage)` };
  }
  if (d >= notifyFrom) {
    const daysLeft = dueMin - d;
    return {
      status: ComplianceStatus.YELLOW,
      message: daysLeft <= 0 ? `${phase} fällig` : `${phase} in ${daysLeft} Tagen fällig`,
    };
  }
  return { status: ComplianceStatus.GREEN, message: 'Konform' };
}

/**
 * Hufschmied-Status (6 / 8 Wochen wie bisher).
 */
export function checkHoofCareStatus(horse: Horse): { status: ComplianceStatus; daysSince: number } {
  const hoof = horse.serviceHistory
    .filter(s => s.type === 'Hufschmied')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  if (hoof.length === 0) return { status: ComplianceStatus.GREEN, daysSince: 0 };

  const diffDays = daysSince(new Date(hoof[0].date));
  let status = ComplianceStatus.GREEN;
  if (diffDays > 56) status = ComplianceStatus.RED;
  else if (diffDays > 42) status = ComplianceStatus.YELLOW;
  return { status, daysSince: diffDays };
}

export function getStatusColor(status: ComplianceStatus): string {
  switch (status) {
    case ComplianceStatus.GREEN: return 'bg-emerald-500';
    case ComplianceStatus.YELLOW: return 'bg-amber-500';
    case ComplianceStatus.RED: return 'bg-rose-500';
    default: return 'bg-gray-500';
  }
}

/** Status-Label für Sortierung/Anzeige: konform, fällig, kritisch */
export function getStatusLabel(status: ComplianceStatus): string {
  switch (status) {
    case ComplianceStatus.GREEN: return 'konform';
    case ComplianceStatus.YELLOW: return 'fällig';
    case ComplianceStatus.RED: return 'kritisch';
    default: return 'konform';
  }
}
