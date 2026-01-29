
import { Horse, ComplianceStatus, ServiceRecord } from './types';
import type { Vaccination } from './types';

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
const DAYS_V3_AFTER_V2 = 6 * 30 + 21;
const DAYS_BOOSTER_AFTER_V3 = 6 * 30 + 21;
const NOTIFY_DAYS_BEFORE = 14;

export const VACC_TYPES = ['Influenza', 'Herpes', 'Tetanus', 'West-Nil-Virus'] as const;

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 3600 * 24));
}

function daysSince(d: Date): number {
  return Math.floor((Date.now() - d.getTime()) / (1000 * 3600 * 24));
}

function formatDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

export interface DueItem {
  type: string;
  sequence: string;
  status: ComplianceStatus;
  message: string;
}

export interface VaccComplianceResult {
  status: ComplianceStatus;
  message: string;
  /** Bei Konform: nächste fällige Impfung (Typ, Sequenz, Datum) für Anzeige „Nächste Impfung“. */
  nextDueInfo: { type: string; sequence: string; dueDate: string } | null;
  /** Alle Fälligkeiten (fällig/kritisch) pro Impfkategorie; für Auflistung überall. */
  dueItems: DueItem[];
}

/**
 * Impf-Fälligkeit pro Kategorie (type). Zwei Nutzungsweisen:
 *
 * 1. Vollständige Historie: V1→V2→V3→Booster. Fälligkeit aus letzter Impfung, Intervallprüfung
 *    (V1→V2: 28–70 Tage; V2→V3, V3→Booster, Booster→Booster: 6 Mon + 21 Tage).
 *    Sobald V3 durchgeführt wurde (Intervall eingehalten), ist das Pferd konform bis zur
 *    Booster-Fälligkeit (6 Mon + 21 Tage nach V3) – auch ohne Booster-Eintrag.
 *
 * 2. Nur letzte Booster-Impfung: Ein Eintrag pro Typ mit sequence Booster / isBooster. Keine
 *    V1/V2/V3 nötig. Fälligkeit = Booster-Datum + 6 Mon + 21 Tage; konform bis Ablauf.
 *
 * Mitteilungen: Kategorie + Sequenz; fällig: „bis DD.MM.YYYY (X Tage)“; kritisch: „seit DD.MM.YYYY (X Tage überfällig)“.
 */
export function checkVaccinationCompliance(horse: Horse): VaccComplianceResult {
  const byType = new Map<string, Vaccination[]>();
  for (const v of horse.vaccinations) {
    if (v.status === 'planned') continue;
    const t = v.type || 'Influenza';
    if (!byType.has(t)) byType.set(t, []);
    byType.get(t)!.push(v);
  }
  for (const arr of byType.values()) {
    arr.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  let worstStatus = ComplianceStatus.GREEN;
  let worstMessage = 'Konform';
  let nextDue: { type: string; sequence: string; dueDate: string } | null = null;
  let earliestNextDue: Date | null = null;

  if (byType.size === 0) {
    return { status: ComplianceStatus.RED, message: 'Keine Impfdaten gefunden.', nextDueInfo: null, dueItems: [] };
  }

  const dueItems: DueItem[] = [];

  for (const type of VACC_TYPES) {
    const list = byType.get(type) ?? [];
    if (list.length === 0) continue;

    const last = list[0];
    const lastDate = new Date(last.date);
    lastDate.setHours(0, 0, 0, 0);
    const seq = last.sequence || (last.isBooster ? 'Booster' : 'V1');
    const d = daysSince(lastDate);

    const onlyBooster =
      list.length === 1 && (seq === 'Booster' || last.isBooster);

    let dueMin: number;
    let dueMax: number;
    let phase: string;
    let intervalOk = true;

    if (onlyBooster) {
      dueMin = dueMax = DAYS_BOOSTER_AFTER_V3;
      phase = 'Booster';
    } else if (seq === 'V1') {
      dueMin = DAYS_V2_MIN;
      dueMax = DAYS_V2_MAX;
      phase = 'V2';
    } else if (seq === 'V2') {
      dueMin = dueMax = DAYS_V3_AFTER_V2;
      phase = 'V3';
      if (list.length < 2) intervalOk = false;
      else {
        const prev = new Date(list[1].date);
        prev.setHours(0, 0, 0, 0);
        const gap = daysBetween(prev, lastDate);
        if (gap < DAYS_V2_MIN || gap > DAYS_V2_MAX) intervalOk = false;
      }
    } else {
      /* V3 oder Booster: Nächste Fälligkeit = 6 Mon + 21 Tage nach letzter Impfung. Mit V3 (ohne Booster-Eintrag) ist das Pferd konform bis zu diesem Termin. */
      dueMin = dueMax = seq === 'V3' ? DAYS_V3_AFTER_V2 : DAYS_BOOSTER_AFTER_V3;
      phase = 'Booster';
      if (list.length >= 2) {
        const prev = new Date(list[1].date);
        prev.setHours(0, 0, 0, 0);
        const gap = daysBetween(prev, lastDate);
        const required = seq === 'V3' ? DAYS_V3_AFTER_V2 : DAYS_BOOSTER_AFTER_V3;
        if (gap < required) intervalOk = false;
      }
    }

    const dueDateMin = addDays(lastDate, dueMin);
    const dueDateMax = addDays(lastDate, dueMax);
    const notifyFrom = dueMin - NOTIFY_DAYS_BEFORE;

    const label =
      seq === 'V2' && list.length < 2 ? `V2 ${type}` : `${phase} ${type}`;

    if (!intervalOk) {
      const msg =
        seq === 'V2' && list.length < 2
          ? `${label}: ohne V1 – nicht konform.`
          : `${label}: Abstand zur Vorimpfung nicht eingehalten.`;
      dueItems.push({ type, sequence: phase, status: ComplianceStatus.RED, message: msg });
      if (worstStatus === ComplianceStatus.GREEN || worstStatus === ComplianceStatus.YELLOW) {
        worstStatus = ComplianceStatus.RED;
        worstMessage = msg;
      }
      continue;
    }

    if (d > dueMax) {
      const overdue = d - dueMax;
      const dueDate = dueDateMax;
      const msg = `${label} überfällig seit ${formatDate(dueDate)} (${overdue} Tage überfällig)`;
      dueItems.push({ type, sequence: phase, status: ComplianceStatus.RED, message: msg });
      if (worstStatus === ComplianceStatus.GREEN || worstStatus === ComplianceStatus.YELLOW) {
        worstStatus = ComplianceStatus.RED;
        worstMessage = msg;
      }
      continue;
    }

    if (d >= notifyFrom) {
      const daysLeft = dueMin - d;
      const endDate = dueDateMax;
      const daysLeftToEnd = Math.max(0, Math.floor((endDate.getTime() - Date.now()) / (1000 * 3600 * 24)));
      const msg =
        daysLeft <= 0
          ? `${label} fällig bis ${formatDate(endDate)} (${daysLeftToEnd} Tage)`
          : `${label} in ${daysLeft} Tagen fällig bis ${formatDate(endDate)} (${daysLeftToEnd} Tage)`;
      dueItems.push({ type, sequence: phase, status: ComplianceStatus.YELLOW, message: msg });
      if (worstStatus === ComplianceStatus.GREEN) {
        worstStatus = ComplianceStatus.YELLOW;
        worstMessage = msg;
      }
      continue;
    }

    const nextDueDate = dueDateMin;
    if (!earliestNextDue || nextDueDate.getTime() < earliestNextDue.getTime()) {
      earliestNextDue = nextDueDate;
      nextDue = { type, sequence: phase, dueDate: formatDate(nextDueDate) };
    }
  }

  if (worstStatus === ComplianceStatus.GREEN && nextDue) {
    worstMessage = `${nextDue.sequence} ${nextDue.type} am ${nextDue.dueDate}`;
  }

  return {
    status: worstStatus,
    message: worstMessage,
    nextDueInfo: worstStatus === ComplianceStatus.GREEN ? nextDue : null,
    dueItems,
  };
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
