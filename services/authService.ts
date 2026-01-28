import { supabase } from './supabase';
import type { Profile, Stable } from '../types';

export type RegisterOwnerInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  zip: string;
  stableId: string | null;
  /** Anzeigename: gewählter Stall oder „Neuer Stall“ */
  stallName: string;
};

export type RegisterVetInput = {
  email: string;
  password: string;
  practiceName: string;
  zip: string;
};

export async function signUpOwner(data: RegisterOwnerInput) {
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: {
        role: 'owner',
        first_name: data.firstName,
        last_name: data.lastName,
        zip: data.zip,
        stable_id: data.stableId,
        stall_name: data.stallName,
      },
    },
  });
  if (authError) throw authError;
  const uid = authData.user?.id;
  if (!uid) throw new Error('Registrierung fehlgeschlagen.');

  let stableId = data.stableId;
  if (!stableId && data.stallName && data.zip) {
    const { data: s } = await supabase
      .from('stables')
      .insert({ name: data.stallName, zip: data.zip })
      .select('id')
      .single();
    stableId = s?.id ?? null;
  }

  const { error: profileError } = await supabase.from('profiles').insert({
    id: uid,
    role: 'owner',
    first_name: data.firstName,
    last_name: data.lastName,
    stall_name: data.stallName || null,
    zip: data.zip,
    stable_id: stableId,
  });
  if (profileError) throw profileError;
  return authData;
}

export async function signUpVet(data: RegisterVetInput) {
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: {
        role: 'vet',
        practice_name: data.practiceName,
        zip: data.zip,
      },
    },
  });
  if (authError) throw authError;
  if (!authData.user?.id) throw new Error('Registrierung fehlgeschlagen.');
  // Profil wird per DB-Trigger (handle_new_user) angelegt – unabhängig von E-Mail-Bestätigung.
  return authData;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  if (error || !data) return null;
  return data as Profile;
}

export async function updateProfile(updates: Partial<Profile>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Nicht angemeldet.');
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.first_name !== undefined) payload.first_name = updates.first_name;
  if (updates.last_name !== undefined) payload.last_name = updates.last_name;
  if (updates.stall_name !== undefined) payload.stall_name = updates.stall_name;
  if (updates.practice_name !== undefined) payload.practice_name = updates.practice_name;
  if (updates.zip !== undefined) payload.zip = updates.zip;
  if (updates.stable_id !== undefined) payload.stable_id = updates.stable_id;
  if (updates.notify_vaccination !== undefined) payload.notify_vaccination = updates.notify_vaccination;
  if (updates.notify_hoof !== undefined) payload.notify_hoof = updates.notify_hoof;
  const { data, error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', user.id)
    .select()
    .single();
  if (error) throw error;
  return data as Profile;
}

export async function listStablesByZip(zip: string): Promise<Stable[]> {
  if (zip.length < 2) return [];
  const { data, error } = await supabase
    .from('stables')
    .select('id, name, zip, created_at')
    .ilike('zip', `${zip}%`)
    .order('name');
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, name: r.name, zip: r.zip, created_at: r.created_at }));
}

export async function createStable(name: string, zip: string): Promise<Stable> {
  const { data, error } = await supabase
    .from('stables')
    .insert({ name, zip })
    .select('id, name, zip, created_at')
    .single();
  if (error) throw error;
  return { id: data.id, name: data.name, zip: data.zip, created_at: data.created_at };
}
