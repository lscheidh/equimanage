#!/usr/bin/env node
/**
 * Prüft die Supabase-Verbindung (URL + Anon-Key).
 * Liest .env.local aus dem Projektroot.
 * Ausführung: node scripts/verify-supabase.mjs
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const envPath = join(root, '.env.local');

if (!existsSync(envPath)) {
  console.error('Fehler: .env.local nicht gefunden im Projektroot.');
  process.exit(1);
}

const raw = readFileSync(envPath, 'utf8');
for (const line of raw.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) {
    const v = m[2].trim().replace(/^["']|["']$/g, '');
    process.env[m[1].trim()] = v;
  }
}

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Fehler: VITE_SUPABASE_URL oder VITE_SUPABASE_ANON_KEY fehlen in .env.local');
  process.exit(1);
}

const supabase = createClient(url, key);

try {
  const { error } = await supabase.auth.getSession();
  if (error) throw error;
  console.log('Supabase-Verbindung OK');
  process.exit(0);
} catch (e) {
  console.error('Supabase-Fehler:', e?.message ?? e);
  process.exit(1);
}
