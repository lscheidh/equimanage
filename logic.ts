
import { Horse, ComplianceStatus, ServiceRecord } from './types';
import type { Vaccination } from './types';

/**
 * Validierungskonstanten:
 * ISO-Nr (UELN): 2-stelliger Ländercode (ISO 3166) + 13-stellige ID.
 * FEI-Nr.: Optional, z.B. 8 Ziffern.
 * Chip-ID: 15-stelliger numerischer Code (ISO 11784/11785).
 */
export const VALIDATION_PATTERNS = {
  ISO_NR: /^[A-Z]{2}\s?[\dA-Z]{8,15}$/,
  REG_NR: /^(\d{8}|\d{2}[A-Z]{2}\d{2,5})$/,
  CHIP_ID: /^\d{15}$/,
  BIRTH_YEAR: (year: number) => year >= 1980 && year <= new Date().getFullYear(),
  WEIGHT: (weight: number) => weight >= 50 && weight <= 1500,
};

/** V2: fällig ab Tag 28, Überziehungsfrist bis Tag 70, kritisch ab Tag 71. Frühere Impfung = konform. */
const DAYS_V2_DUE = 28;
const DAYS_V2_GRACE_END = 70;
const DAYS_V2_OVERDUE = 71;
/** V3/Booster: fällig ab 6 Monaten, Überziehungsfrist 21 Tage, kritisch ab 6 Mon + 22 Tage. Frühere Impfung = konform. */
const DAYS_6_MONTHS = 6 * 30;
const DAYS_V3_BOOSTER_GRACE_END = DAYS_6_MONTHS + 21;
const DAYS_V3_BOOSTER_OVERDUE = DAYS_6_MONTHS + 22;
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

export interface NextDuePerType {
  type: string;
  sequence: string;
  dueDate: string;
  graceEndDate: string;
  status: ComplianceStatus;
  message: string;
}

export interface VaccComplianceResult {
  status: ComplianceStatus;
  message: string;
  /** Bei Konform: nächste fällige Impfung (Typ, Sequenz, Fällig-ab, Spätestens-bis). */
  nextDueInfo: { type: string; sequence: string; dueDate: string; graceEndDate: string } | null;
  /** Alle Fälligkeiten (fällig/kritisch) pro Impfkategorie; für Auflistung überall. */
  dueItems: DueItem[];
  /** Pro Impfkategorie: nächste Fälligkeit (für Impfhistorie-Hinweis). */
  allNextDue: NextDuePerType[];
}

/**
 * Impf-Fälligkeit pro Kategorie (type). Zwei Nutzungsweisen:
 *
 * 1. Vollständige Historie: V1→V2→V3→Booster. Fälligkeit aus letzter Impfung.
 *
 * Regel: Frühere Impfung ist stets konform. Fällig = Termin ab dem geimpft werden soll.
 * Überziehungsfrist = zusätzliche Tage; danach kritisch.
 *
 * - V2: Fällig ab Tag 28, Überziehungsfrist bis Tag 70, kritisch ab Tag 71.
 * - V3/Booster: Fällig ab 6 Monaten, Überziehungsfrist 21 Tage (bis 6 Mon + 21), kritisch ab 6 Mon + 22.
 *
 * 2. Nur letzte Booster-Impfung: Ein Eintrag pro Typ mit sequence Booster / isBooster. Keine
 *    V1/V2/V3 nötig. Gleiche Fällig-/Kritisch-Regeln ab Booster-Datum.
 *
 * Mitteilungen: Zwei Schritte klar getrennt – 1) Fällig ab [Datum], 2) Spätestens bis [Datum] (noch X Tage).
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
    return { status: ComplianceStatus.RED, message: 'Keine Impfdaten gefunden.', nextDueInfo: null, dueItems: [], allNextDue: [] };
  }

  const dueItems: DueItem[] = [];
  const allNextDue: NextDuePerType[] = [];

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
      dueMin = DAYS_6_MONTHS;
      dueMax = DAYS_V3_BOOSTER_GRACE_END;
      phase = 'Booster';
    } else if (seq === 'V1') {
      dueMin = DAYS_V2_DUE;
      dueMax = DAYS_V2_GRACE_END;
      phase = 'V2';
    } else if (seq === 'V2') {
      dueMin = DAYS_6_MONTHS;
      dueMax = DAYS_V3_BOOSTER_GRACE_END;
      phase = 'V3';
      if (list.length < 2) intervalOk = false;
    } else {
      dueMin = DAYS_6_MONTHS;
      dueMax = DAYS_V3_BOOSTER_GRACE_END;
      phase = 'Booster';
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
      allNextDue.push({ type, sequence: phase, dueDate: formatDate(dueDateMin), graceEndDate: formatDate(dueDateMax), status: ComplianceStatus.RED, message: msg });
      if (worstStatus === ComplianceStatus.GREEN || worstStatus === ComplianceStatus.YELLOW) {
        worstStatus = ComplianceStatus.RED;
        worstMessage = msg;
      }
      continue;
    }

    const isOverdue =
      phase === 'V3' || phase === 'Booster'
        ? d >= DAYS_V3_BOOSTER_OVERDUE
        : d >= DAYS_V2_OVERDUE;
    if (isOverdue) {
      const overdue = d - dueMax;
      const spaetestensDate = dueDateMax;
      const msg = `${label}: Überfällig. Spätestens-Termin war ${formatDate(spaetestensDate)} (seit ${overdue} Tagen überfällig)`;
      dueItems.push({ type, sequence: phase, status: ComplianceStatus.RED, message: msg });
      allNextDue.push({ type, sequence: phase, dueDate: formatDate(dueDateMin), graceEndDate: formatDate(spaetestensDate), status: ComplianceStatus.RED, message: msg });
      if (worstStatus === ComplianceStatus.GREEN || worstStatus === ComplianceStatus.YELLOW) {
        worstStatus = ComplianceStatus.RED;
        worstMessage = msg;
      }
      continue;
    }

    if (d >= notifyFrom) {
      const daysLeftToFällig = dueMin - d;
      const spaetestensDate = dueDateMax;
      const daysLeftToEnd = Math.max(0, Math.floor((spaetestensDate.getTime() - Date.now()) / (1000 * 3600 * 24)));
      const msg =
        daysLeftToFällig <= 0
          ? `${label}: Fällig. Spätestens bis ${formatDate(spaetestensDate)} (noch ${daysLeftToEnd} Tage)`
          : `${label}: Ab ${formatDate(dueDateMin)} fällig. Spätestens bis ${formatDate(spaetestensDate)} (noch ${daysLeftToEnd} Tage Überziehungsfrist)`;
      dueItems.push({ type, sequence: phase, status: ComplianceStatus.YELLOW, message: msg });
      allNextDue.push({ type, sequence: phase, dueDate: formatDate(dueDateMin), graceEndDate: formatDate(spaetestensDate), status: ComplianceStatus.YELLOW, message: msg });
      if (worstStatus === ComplianceStatus.GREEN) {
        worstStatus = ComplianceStatus.YELLOW;
        worstMessage = msg;
      }
      continue;
    }

    allNextDue.push({
      type, sequence: phase,
      dueDate: formatDate(dueDateMin),
      graceEndDate: formatDate(dueDateMax),
      status: ComplianceStatus.GREEN,
      message: `${label}: Ab ${formatDate(dueDateMin)} fällig, spätestens bis ${formatDate(dueDateMax)}`,
    });
    const nextDueDate = dueDateMin;
    if (!earliestNextDue || nextDueDate.getTime() < earliestNextDue.getTime()) {
      earliestNextDue = nextDueDate;
      nextDue = {
        type,
        sequence: phase,
        dueDate: formatDate(nextDueDate),
        graceEndDate: formatDate(dueDateMax),
      };
    }
  }

  if (worstStatus === ComplianceStatus.GREEN && nextDue) {
    worstMessage = `${nextDue.sequence} ${nextDue.type}: Ab ${nextDue.dueDate} fällig, spätestens bis ${nextDue.graceEndDate}`;
  }

  return {
    status: worstStatus,
    message: worstMessage,
    nextDueInfo: worstStatus === ComplianceStatus.GREEN ? nextDue : null,
    dueItems,
    allNextDue,
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
