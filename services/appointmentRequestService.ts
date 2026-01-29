import { supabase } from './supabase';

export interface AppointmentRequestPayload {
  owner: {
    firstName: string;
    lastName: string;
    stallName: string | null;
    zip: string | null;
    email?: string | null;
  };
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

export interface AppointmentRequestRow {
  id: string;
  vet_id: string;
  owner_id: string;
  created_at: string;
  payload: AppointmentRequestPayload;
}

export async function createAppointmentRequest(
  ownerId: string,
  vetId: string,
  payload: AppointmentRequestPayload
): Promise<AppointmentRequestRow> {
  const { data, error } = await supabase
    .from('appointment_requests')
    .insert({ owner_id: ownerId, vet_id: vetId, payload })
    .select('id, vet_id, owner_id, created_at, payload')
    .single();
  if (error) throw error;
  return data as AppointmentRequestRow;
}

export async function listAppointmentRequestsForVet(vetId: string): Promise<AppointmentRequestRow[]> {
  const { data, error } = await supabase
    .from('appointment_requests')
    .select('id, vet_id, owner_id, created_at, payload')
    .eq('vet_id', vetId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as AppointmentRequestRow[];
}
