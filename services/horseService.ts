import { supabase } from './supabase';
import type { Horse, Vaccination, ServiceRecord } from '../types';

function toHorse(row: Record<string, unknown>): Horse {
  return {
    id: row.id as string,
    name: (row.name as string) ?? '',
    breed: (row.breed as string) ?? '',
    birthYear: (row.birth_year as number) ?? 0,
    isoNr: (row.iso_nr as string) ?? '',
    feiNr: (row.fei_nr as string) ?? '',
    chipId: (row.chip_id as string) ?? 'Nicht angegeben',
    ownerId: row.owner_id as string,
    ownerName: (row.owner_name as string) ?? '',
    gender: ((row.gender as string) ?? 'Wallach') as Horse['gender'],
    color: (row.color as string) ?? '',
    breedingAssociation: (row.breeding_association as string) ?? '',
    image: (row.image as string) ?? `https://picsum.photos/seed/${row.id}/400/300`,
    vaccinations: ((row.vaccinations as Vaccination[]) ?? []).map((v) => ({
      ...v,
      id: v.id ?? crypto.randomUUID(),
    })),
    serviceHistory: ((row.service_history as ServiceRecord[]) ?? []).map((s) => ({
      ...s,
      id: s.id ?? crypto.randomUUID(),
    })),
    weightKg: (row.weight_kg as number) ?? 0,
  };
}

export async function fetchHorses(ownerId: string, ownerName: string): Promise<Horse[]> {
  const { data, error } = await supabase
    .from('horses')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => toHorse({ ...r, owner_name: ownerName }));
}

export async function createHorse(
  ownerId: string,
  ownerName: string,
  horse: Omit<Horse, 'id' | 'ownerId' | 'ownerName' | 'vaccinations' | 'serviceHistory'> & {
    vaccinations?: Vaccination[];
    serviceHistory?: ServiceRecord[];
  }
): Promise<Horse> {
  const { data, error } = await supabase
    .from('horses')
    .insert({
      owner_id: ownerId,
      name: horse.name,
      breed: horse.breed ?? '',
      birth_year: horse.birthYear,
      iso_nr: horse.isoNr,
      fei_nr: horse.feiNr,
      chip_id: horse.chipId ?? 'Nicht angegeben',
      gender: horse.gender,
      color: horse.color ?? '',
      breeding_association: horse.breedingAssociation ?? '',
      image: horse.image ?? `https://picsum.photos/seed/${crypto.randomUUID()}/400/300`,
      weight_kg: horse.weightKg ?? 0,
      vaccinations: horse.vaccinations ?? [],
      service_history: horse.serviceHistory ?? [],
    })
    .select('*')
    .single();
  if (error) throw error;
  return toHorse({ ...data, owner_name: ownerName });
}

export async function updateHorse(ownerId: string, ownerName: string, h: Horse): Promise<Horse> {
  const { data, error } = await supabase
    .from('horses')
    .update({
      name: h.name,
      breed: h.breed,
      birth_year: h.birthYear,
      iso_nr: h.isoNr,
      fei_nr: h.feiNr,
      chip_id: h.chipId,
      gender: h.gender,
      color: h.color,
      breeding_association: h.breedingAssociation,
      image: h.image,
      weight_kg: h.weightKg,
      vaccinations: h.vaccinations,
      service_history: h.serviceHistory,
      updated_at: new Date().toISOString(),
    })
    .eq('id', h.id)
    .eq('owner_id', ownerId)
    .select('*')
    .single();
  if (error) throw error;
  return toHorse({ ...data, owner_name: ownerName });
}

export async function deleteHorse(ownerId: string, horseId: string): Promise<void> {
  const { error } = await supabase
    .from('horses')
    .delete()
    .eq('id', horseId)
    .eq('owner_id', ownerId);
  if (error) throw error;
}
