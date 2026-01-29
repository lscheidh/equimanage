import { supabase } from './supabase';

export interface AppointmentRequestPayload {
  owner: {
    firstName: string;
    lastName: string;
    stallName: string | null;
    zip: string | null;
    email?: string | null;
  };
  /** Optional, für Anzeige im Besitzer-Dashboard */
  vet?: { practiceName: string | null; zip: string | null };
  horses: Array<{
    horseId: string;
    name: string;
    isoNr: string;
    chipId: string;
    breed: string;
    birthYear: number;
    noVaccData: boolean;
    selectedCategories?: string[];
    selectedDueItems?: Array<{ type: string; sequence: string; message: string }>;
  }>;
}

export type AppointmentRequestStatus = 'pending' | 'accepted' | 'rejected';

export interface AppointmentRequestRow {
  id: string;
  vet_id: string;
  owner_id: string;
  created_at: string;
  payload: AppointmentRequestPayload;
  status: AppointmentRequestStatus;
  scheduled_date: string | null;
  vet_response_at: string | null;
  owner_confirmed_at: string | null;
}

const COLS = 'id, vet_id, owner_id, created_at, payload, status, scheduled_date, vet_response_at, owner_confirmed_at';

function mapError(err: { message?: string; code?: string }): string {
  const m = (err.message ?? '').toLowerCase();
  const c = err.code ?? '';
  if (c === '42P01' || m.includes('does not exist') || m.includes('relation') || m.includes('column')) return 'Tabelle oder Spalten für Terminanfragen fehlen. Bitte Migration 005 + 006 in Supabase ausführen.';
  if (m.includes('policy') || m.includes('rls') || m.includes('row-level')) return 'Keine Berechtigung. Bitte anmelden und erneut versuchen.';
  if (m.includes('foreign key') || m.includes('violates')) return 'Tierarzt oder Besitzer nicht gefunden. Bitte Seite neu laden.';
  return err.message ?? 'Anfrage konnte nicht gesendet werden. Bitte erneut versuchen.';
}

export async function createAppointmentRequest(
  ownerId: string,
  vetId: string,
  payload: AppointmentRequestPayload
): Promise<AppointmentRequestRow> {
  const safePayload = {
    owner: {
      firstName: payload.owner.firstName ?? '',
      lastName: payload.owner.lastName ?? '',
      stallName: payload.owner.stallName ?? null,
      zip: payload.owner.zip ?? null,
      email: payload.owner.email ?? null,
    },
    vet: payload.vet ?? null,
    horses: (payload.horses ?? []).map((h) => ({
      horseId: h.horseId,
      name: h.name ?? '',
      isoNr: h.isoNr ?? '',
      chipId: h.chipId ?? '—',
      breed: h.breed ?? '—',
      birthYear: h.birthYear ?? 0,
      noVaccData: !!h.noVaccData,
      selectedCategories: h.selectedCategories ?? [],
      selectedDueItems: h.selectedDueItems ?? [],
    })),
  };

  const { data, error } = await supabase
    .from('appointment_requests')
    .insert({ owner_id: ownerId, vet_id: vetId, payload: safePayload })
    .select(COLS)
    .single();

  if (error) throw new Error(mapError(error));
  return data as AppointmentRequestRow;
}

export async function listAppointmentRequestsForVet(vetId: string): Promise<AppointmentRequestRow[]> {
  const { data, error } = await supabase
    .from('appointment_requests')
    .select(COLS)
    .eq('vet_id', vetId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(mapError(error));
  return (data ?? []) as AppointmentRequestRow[];
}

export async function listAppointmentRequestsForOwner(ownerId: string): Promise<AppointmentRequestRow[]> {
  const { data, error } = await supabase
    .from('appointment_requests')
    .select(COLS)
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(mapError(error));
  return (data ?? []) as AppointmentRequestRow[];
}

export async function updateAppointmentRequestVet(
  vetId: string,
  requestId: string,
  updates: { status: 'accepted' | 'rejected'; scheduled_date?: string }
): Promise<AppointmentRequestRow> {
  const payload: Record<string, unknown> = {
    status: updates.status,
    vet_response_at: new Date().toISOString(),
  };
  if (updates.scheduled_date) payload.scheduled_date = updates.scheduled_date;

  const { data, error } = await supabase
    .from('appointment_requests')
    .update(payload)
    .eq('id', requestId)
    .eq('vet_id', vetId)
    .select(COLS)
    .single();

  if (error) throw new Error(mapError(error));
  return data as AppointmentRequestRow;
}

export async function updateAppointmentRequestOwnerConfirm(
  ownerId: string,
  requestId: string
): Promise<AppointmentRequestRow> {
  const { data, error } = await supabase
    .from('appointment_requests')
    .update({ owner_confirmed_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('owner_id', ownerId)
    .select(COLS)
    .single();

  if (error) throw new Error(mapError(error));
  return data as AppointmentRequestRow;
}
