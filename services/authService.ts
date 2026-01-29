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

/**
 * Legt ein Profil aus user_metadata an, falls es fehlt (z. B. Trigger nicht ausgeführt
 * oder Owner-Insert fehlgeschlagen). Idempotent bei Duplikat.
 */
async function ensureProfileFromMetadata(userId: string, meta: Record<string, unknown>): Promise<boolean> {
  const role = (meta?.role as string) || 'owner';
  if (role !== 'owner' && role !== 'vet') return false;
  const payload: Record<string, unknown> = {
    id: userId,
    role,
    first_name: meta?.first_name ?? null,
    last_name: meta?.last_name ?? null,
    stall_name: meta?.stall_name ?? null,
    practice_name: meta?.practice_name ?? null,
    zip: meta?.zip ?? null,
    stable_id: meta?.stable_id ?? null,
  };
  const { error } = await supabase.from('profiles').insert(payload);
  if (error) {
    if (error.code === '23505') return true;
    console.error('EquiManage ensureProfile:', error.message, error.code);
    return false;
  }
  return true;
}

export async function getProfile(): Promise<Profile | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;
  const uid = session.user.id;
  const meta = (session.user.user_metadata || {}) as Record<string, unknown>;

  let { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', uid)
    .single();

  const noRow = error?.code === 'PGRST116' || (error && !data);
  if (noRow && meta && (meta.role === 'owner' || meta.role === 'vet')) {
    await ensureProfileFromMetadata(uid, meta);
    const next = await supabase.from('profiles').select('*').eq('id', uid).single();
    if (!next.error && next.data) return next.data as Profile;
  }

  if (error) {
    console.error('EquiManage getProfile:', error.message, error.code);
    return null;
  }
  if (!data) return null;
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
