import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  console.warn('EquiManage: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY fehlen. Bitte .env.local anlegen (siehe .env.example).');
}

export const supabase = createClient(url || '', anon || '');
