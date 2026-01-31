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

export type RegisterBothInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  zip: string;
  stableId: string | null;
  stallName: string;
  practiceName: string;
  practiceZip: string;
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
    if (s?.id) stableId = s.id;
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
  if (profileError && profileError.code !== '23505') {
    console.warn('signUpOwner profile insert:', profileError.message);
  }
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

export async function signUpBoth(data: RegisterBothInput) {
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
        practice_name: data.practiceName,
        practice_zip: data.practiceZip,
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
    if (s?.id) stableId = s.id;
  }

  const { error: profileError } = await supabase.from('profiles').insert({
    id: uid,
    role: 'owner',
    first_name: data.firstName,
    last_name: data.lastName,
    stall_name: data.stallName || null,
    zip: data.zip,
    stable_id: stableId,
    practice_name: data.practiceName || null,
    practice_zip: data.practiceZip || null,
  });
  if (profileError && profileError.code !== '23505') {
    console.warn('signUpBoth profile insert:', profileError.message);
  }
  return authData;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/**
 * Sendet einen Link zum Zurücksetzen des Passworts an die angegebene E-Mail.
 * Der Nutzer erhält eine E-Mail von Supabase mit einem Link; beim Klick wird er
 * zur konfigurierten Redirect-URL geleitet (mit Token), wo ein neues Passwort
 * gesetzt werden kann.
 */
export async function resetPasswordForEmail(email: string, redirectTo?: string): Promise<void> {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  const url = redirectTo ?? (base ? `${base}/` : undefined);
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), url ? { redirectTo: url } : undefined);
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** Validiert die Session serverseitig via getUser. */
export async function getSession() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: sessionData } = await supabase.auth.getSession();
  return sessionData.session;
}

export async function getCurrentUserEmail(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email ?? null;
}

export async function updateAuthEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ email });
  if (error) throw error;
}

export async function updateAuthPassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

/**
 * Ändert das Passwort nach Verifizierung des alten Passworts.
 * Prüft zuerst per signIn, ob das alte Passwort stimmt.
 */
export async function changePasswordWithVerification(
  email: string,
  oldPassword: string,
  newPassword: string
): Promise<void> {
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: oldPassword });
  if (signInError) throw signInError;
  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) throw updateError;
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
    practice_zip: meta?.practice_zip ?? null,
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const uid = user.id;
  const meta = (user.user_metadata || {}) as Record<string, unknown>;

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
  if (updates.practice_zip !== undefined) payload.practice_zip = updates.practice_zip;
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

export type VetSearchResult = { id: string; practice_name: string | null; zip: string | null; practice_zip?: string | null };

export type VetSearchResultWithDistance = VetSearchResult & { distanceKm: number };

/**
 * Lädt alle registrierten Tierärzte (role=vet oder practice_name gesetzt, duale Rolle).
 * Erfordert Migration 004 + 007 (profiles_select_vets, profiles_select_vets_dual).
 */
export async function listVets(): Promise<VetSearchResult[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, practice_name, zip, practice_zip')
    .or('role.eq.vet,practice_name.not.is.null');
  if (error) return [];
  return (data ?? []) as VetSearchResult[];
}

/**
 * Filtert Tierärzte nach Praxis-/Firmennamen (lokal).
 */
export function filterVets(list: VetSearchResult[], query: string): VetSearchResult[] {
  const q = (query || '').trim().toLowerCase();
  if (q.length < 1) return [];
  return list.filter(
    (r) =>
      (r.practice_name ?? '').toLowerCase().includes(q) ||
      (r.zip ?? '').toLowerCase().includes(q)
  );
}

/**
 * Tierärzte im Umkreis von radiusKm um die gegebene PLZ (Geocoding via api.zippopotam.us).
 * Sortiert nach Entfernung. Erfordert 5-stellige PLZ.
 */
export async function listVetsWithinRadius(
  userPlz: string,
  radiusKm: number
): Promise<VetSearchResultWithDistance[]> {
  const { geocodePlz, distanceKm } = await import('./plzService');
  const userCoord = await geocodePlz(userPlz);
  if (!userCoord) return [];
  const vets = await listVets();
  const out: VetSearchResultWithDistance[] = [];
  const vetPlz = (v: VetSearchResult) => (v.practice_zip ?? v.zip ?? '').replace(/\D/g, '').slice(0, 5);
  for (const v of vets) {
    const plz = vetPlz(v);
    if (plz.length < 5) continue;
    const coord = await geocodePlz(plz);
    if (!coord) continue;
    const d = distanceKm(userCoord, coord);
    if (d <= radiusKm) out.push({ ...v, distanceKm: Math.round(d * 10) / 10 });
  }
  out.sort((a, b) => a.distanceKm - b.distanceKm);
  return out;
}
