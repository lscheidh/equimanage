// Portierte Fälligkeits-Logik für serverseitigen Cron (Impfung + Hufschmied)

const VACC_TYPES = ['Influenza', 'Herpes', 'Tetanus', 'West-Nil-Virus'];
const DAYS_V2_DUE = 28;
const DAYS_V2_GRACE_END = 70;
const DAYS_V2_OVERDUE = 71;
const DAYS_6_MONTHS = 6 * 30;
const DAYS_V3_BOOSTER_GRACE_END = DAYS_6_MONTHS + 21;
const DAYS_V3_BOOSTER_OVERDUE = DAYS_6_MONTHS + 22;
const NOTIFY_DAYS_BEFORE = 14;

function daysSince(d: Date): number {
  return Math.floor((Date.now() - d.getTime()) / (1000 * 3600 * 24));
}
function formatDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}
function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

interface Vacc {
  type: string;
  date: string;
  sequence?: string;
  isBooster?: boolean;
  status?: string;
}
interface Service {
  type: string;
  date: string;
}
interface HorseLike {
  id: string;
  name: string;
  vaccinations: Vacc[];
  service_history?: Service[];
  serviceHistory?: Service[];
}

export interface VaccDueItem {
  horseId: string;
  horseName: string;
  type: string;
  sequence: string;
  status: string;
  message: string;
}

export interface HoofDueItem {
  horseId: string;
  horseName: string;
  status: 'yellow' | 'red';
  daysSince: number;
  message: string;
}

export function getVaccinationDueItems(horse: HorseLike): VaccDueItem[] {
  const svc = horse.service_history ?? horse.serviceHistory ?? [];
  const byType = new Map<string, Vacc[]>();
  for (const v of (horse.vaccinations ?? [])) {
    if (v.status === 'planned') continue;
    const t = v.type || 'Influenza';
    if (!byType.has(t)) byType.set(t, []);
    byType.get(t)!.push(v);
  }
  for (const arr of byType.values()) {
    arr.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
  const items: VaccDueItem[] = [];
  for (const type of VACC_TYPES) {
    const list = byType.get(type) ?? [];
    if (list.length === 0) continue;
    const last = list[0];
    const lastDate = new Date(last.date);
    lastDate.setHours(0, 0, 0, 0);
    const seq = last.sequence || (last.isBooster ? 'Booster' : 'V1');
    const d = daysSince(lastDate);
    const onlyBooster = list.length === 1 && (seq === 'Booster' || last.isBooster);
    let dueMin: number, dueMax: number, phase: string, intervalOk = true;
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
      intervalOk = list.length >= 2;
    } else {
      dueMin = DAYS_6_MONTHS;
      dueMax = DAYS_V3_BOOSTER_GRACE_END;
      phase = 'Booster';
    }
    const dueDateMin = addDays(lastDate, dueMin);
    const dueDateMax = addDays(lastDate, dueMax);
    const notifyFrom = dueMin - NOTIFY_DAYS_BEFORE;
    const label = seq === 'V2' && list.length < 2 ? `V2 ${type}` : `${phase} ${type}`;
    if (!intervalOk) {
      const msg = seq === 'V2' && list.length < 2 ? `${label}: ohne V1 – nicht konform.` : `${label}: Abstand zur Vorimpfung nicht eingehalten.`;
      items.push({ horseId: horse.id, horseName: horse.name, type, sequence: phase, status: 'RED', message: msg });
      continue;
    }
    const isOverdue = (phase === 'V3' || phase === 'Booster') ? d >= DAYS_V3_BOOSTER_OVERDUE : d >= DAYS_V2_OVERDUE;
    if (isOverdue) {
      const overdue = d - dueMax;
      items.push({ horseId: horse.id, horseName: horse.name, type, sequence: phase, status: 'RED', message: `${label}: Überfällig. Spätestens-Termin war ${formatDate(dueDateMax)} (seit ${overdue} Tagen überfällig)` });
      continue;
    }
    if (d >= notifyFrom) {
      const daysLeftToFällig = dueMin - d;
      const daysLeftToEnd = Math.max(0, Math.floor((dueDateMax.getTime() - Date.now()) / (1000 * 3600 * 24)));
      const msg = daysLeftToFällig <= 0
        ? `${label}: Fällig. Spätestens bis ${formatDate(dueDateMax)} (noch ${daysLeftToEnd} Tage)`
        : `${label}: Ab ${formatDate(dueDateMin)} fällig. Spätestens bis ${formatDate(dueDateMax)} (noch ${daysLeftToEnd} Tage Überziehungsfrist)`;
      items.push({ horseId: horse.id, horseName: horse.name, type, sequence: phase, status: 'YELLOW', message: msg });
    }
  }
  return items;
}

export function getHoofDueItems(horse: HorseLike): HoofDueItem[] {
  const svc = horse.service_history ?? horse.serviceHistory ?? [];
  const hoof = svc.filter((s: Service) => s.type === 'Hufschmied').sort((a: Service, b: Service) => new Date(b.date).getTime() - new Date(a.date).getTime());
  if (hoof.length === 0) return [];
  const diffDays = daysSince(new Date(hoof[0].date));
  const items: HoofDueItem[] = [];
  if (diffDays > 56) {
    items.push({ horseId: horse.id, horseName: horse.name, status: 'red', daysSince: diffDays, message: `Letzter Schmied vor ${diffDays} Tagen. Dringend Termin vereinbaren.` });
  } else if (diffDays > 42) {
    items.push({ horseId: horse.id, horseName: horse.name, status: 'yellow', daysSince: diffDays, message: `Letzter Schmied vor ${diffDays} Tagen. Erinnere dich an einen Termin.` });
  }
  return items;
}
