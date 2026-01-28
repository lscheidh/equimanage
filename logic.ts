
import { Horse, ComplianceStatus, ServiceRecord } from './types';

/**
 * Validierungskonstanten basierend auf internationalen Standards:
 * ISO-Nr (UELN): 2-stelliger Ländercode (ISO 3166) + 13-stellige ID.
 * FEI-Nr: Meist 8 Ziffern oder spezifisches Format (z.B. 107XX99).
 * Chip-ID: 15-stelliger numerischer Code (ISO 11784/11785).
 */
export const VALIDATION_PATTERNS = {
  ISO_NR: /^[A-Z]{2}\s?[\dA-Z]{8,15}$/,
  FEI_NR: /^(\d{8}|\d{2}[A-Z]{2}\d{2,5})$/,
  CHIP_ID: /^\d{15}$/,
  BIRTH_YEAR: (year: number) => year >= 1980 && year <= new Date().getFullYear(),
  WEIGHT: (weight: number) => weight >= 50 && weight <= 1500,
};

/**
 * Regeln (FEI 2025):
 * V1 bis V2: 21-60 Tage
 * V3: innerhalb von 6 Monaten + 21 Tage nach V2
 * Laufend: < 6 Monate + 21 Tage ab der letzten für den Turniersport
 */
export const checkFEICompliance = (horse: Horse): { status: ComplianceStatus; message: string } => {
  const sortedVaccs = [...horse.vaccinations].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  if (sortedVaccs.length === 0) {
    return { status: ComplianceStatus.RED, message: 'Keine Impfdaten gefunden.' };
  }

  const lastVacc = sortedVaccs[0];
  const today = new Date();
  const lastVaccDate = new Date(lastVacc.date);
  
  const diffDays = Math.floor((today.getTime() - lastVaccDate.getTime()) / (1000 * 3600 * 24));
  
  // Regel für Turnierbereitschaft: < 6 Monate + 21 Tage (ca. 202 Tage)
  const maxIntervalDays = 202; 
  
  if (diffDays > maxIntervalDays) {
    return { status: ComplianceStatus.RED, message: `Zeitraum (6 Monate + 21 Tage) überschritten (${diffDays} Tage)` };
  }
  
  if (diffDays > maxIntervalDays - 14) {
    const daysLeft = maxIntervalDays - diffDays;
    return { status: ComplianceStatus.YELLOW, message: `Impfung läuft bald ab (${daysLeft} Tage)` };
  }

  return { status: ComplianceStatus.GREEN, message: 'FEI Konform' };
};

/**
 * Überprüft den Hufschmied-Status.
 */
export const checkHoofCareStatus = (horse: Horse): { status: ComplianceStatus; daysSince: number } => {
  const hoofServices = horse.serviceHistory
    .filter(s => s.type === 'Hufschmied')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (hoofServices.length === 0) return { status: ComplianceStatus.GREEN, daysSince: 0 };

  const lastDate = new Date(hoofServices[0].date);
  const today = new Date();
  const diffDays = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));

  let status = ComplianceStatus.GREEN;
  if (diffDays > 56) {
    status = ComplianceStatus.RED;
  } else if (diffDays > 42) {
    status = ComplianceStatus.YELLOW;
  }

  return {
    status,
    daysSince: diffDays
  };
};

export const getStatusColor = (status: ComplianceStatus) => {
  switch (status) {
    case ComplianceStatus.GREEN: return 'bg-emerald-500';
    case ComplianceStatus.YELLOW: return 'bg-amber-500';
    case ComplianceStatus.RED: return 'bg-rose-500';
    default: return 'bg-gray-500';
  }
};
