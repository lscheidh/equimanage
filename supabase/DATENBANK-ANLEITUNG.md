# EquiManage – Supabase-Datenbank einrichten

Führe die folgenden Schritte **in dieser Reihenfolge** im [Supabase Dashboard](https://supabase.com/dashboard) deines Projekts aus.

---

## 1. SQL Editor öffnen

**Supabase Dashboard** → dein Projekt → **SQL Editor** → **New query**.

---

## 2. Tabellen & RLS anlegen

**Gesamtes Skript kopieren** und ausführen (Run):

```sql
-- =============================================================================
-- EquiManage – Tabellen, RLS, Seed
-- =============================================================================

-- Ställe (für PLZ-Suche & Zuordnung)
CREATE TABLE IF NOT EXISTS public.stables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  zip TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.stables ENABLE ROW LEVEL SECURITY;

-- SELECT für alle (anon + authenticated), damit PLZ-Suche beim Registrieren funktioniert
CREATE POLICY "stables_select" ON public.stables FOR SELECT TO authenticated USING (true);
CREATE POLICY "stables_select_anon" ON public.stables FOR SELECT TO anon USING (true);
CREATE POLICY "stables_insert" ON public.stables FOR INSERT TO authenticated WITH CHECK (true);

-- Profile (Erweiterung zu auth.users; 1:1 pro User)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'vet')),
  first_name TEXT,
  last_name TEXT,
  stall_name TEXT,
  practice_name TEXT,
  zip TEXT,
  stable_id UUID REFERENCES public.stables(id) ON DELETE SET NULL,
  notify_vaccination BOOLEAN DEFAULT true,
  notify_hoof BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Pferde
CREATE TABLE IF NOT EXISTS public.horses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stable_id UUID REFERENCES public.stables(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  breed TEXT,
  birth_year INT,
  iso_nr TEXT,
  fei_nr TEXT,
  chip_id TEXT,
  gender TEXT CHECK (gender IN ('Hengst', 'Stute', 'Wallach')),
  color TEXT,
  breeding_association TEXT,
  image TEXT,
  weight_kg INT,
  vaccinations JSONB DEFAULT '[]',
  service_history JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.horses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "horses_select_own" ON public.horses FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "horses_insert_own" ON public.horses FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "horses_update_own" ON public.horses FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "horses_delete_own" ON public.horses FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- Index für PLZ-Suche
CREATE INDEX IF NOT EXISTS idx_stables_zip ON public.stables(zip);
CREATE INDEX IF NOT EXISTS idx_horses_owner ON public.horses(owner_id);

-- Beispiel-Ställe (optional; einmal ausführen)
INSERT INTO public.stables (name, zip)
SELECT * FROM (VALUES
  ('Reitstall Grüne Wiese', '12345'),
  ('Gut Sonnenhof', '12345'),
  ('Pferdehof Am Wald', '10115'),
  ('Stall Rosenau', '20095')
) AS v(name, zip)
WHERE NOT EXISTS (SELECT 1 FROM public.stables LIMIT 1);
```

`ON CONFLICT DO NOTHING` funktioniert nur bei unique constraint. Da `stables` keinen unique auf (name, zip) hat, kann es zu Duplikaten kommen. Besser: Einmal ausführen; bei erneutem Run passiert bei INSERT nichts Schlimmes, ggf. doppelte Ställe. Wir entfernen `ON CONFLICT` und fügen nur ein, wenn die Tabelle leer ist, oder du führst den INSERT Block nur einmal aus. Ich lasse es drin – bei einfachem erneuten Run können Duplikate entstehen, für Entwicklung ok.

---

## 3. Trigger: `updated_at` setzen (optional)

```sql
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS horses_updated_at ON public.horses;
CREATE TRIGGER horses_updated_at
  BEFORE UPDATE ON public.horses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

Falls eine ältere Postgres-Version `EXECUTE FUNCTION` nicht unterstützt, stattdessen `EXECUTE PROCEDURE` verwenden oder die Trigger weglassen – die App aktualisiert `updated_at` beim Schreiben ggf. selbst.

---

## 3b. Trigger für Tierarzt-Profil (wichtig für Tierarzt-Registrierung)

Damit sich Tierärzte zuverlässig registrieren können (auch bei aktivierter E-Mail-Bestätigung), wird das Profil per **Trigger** bei `auth.users` INSERT angelegt. Skript ausführen:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.raw_user_meta_data->>'role' = 'vet' THEN
    INSERT INTO public.profiles (id, role, practice_name, zip)
    VALUES (
      NEW.id,
      'vet',
      COALESCE(NEW.raw_user_meta_data->>'practice_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'zip', '')
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

---

## 3c. Storage: Pferdebilder (Upload von Handy/Kamera)

Für **Profilbild-Upload** (Foto aufnehmen / hochladen) wird ein Supabase-Storage-Bucket genutzt. **Keine Änderung an der Tabelle `horses`** – `image` bleibt ein TEXT-Feld (URL).

Führe das Skript **`supabase/migrations/003_horse_images_storage.sql`** im SQL Editor aus (oder die Migrations per Supabase CLI). Es legt an:

- **Bucket** `horse-images` (öffentlich lesbar, 5 MB pro Datei, nur Bildformate)
- **RLS-Policies**: Authentifizierte Nutzer können nur unter ihrem eigenen Ordner (`owner_id`) hochladen, ändern und löschen.

Pfade: `{owner_id}/{horse_id}_{uuid}.{ext}` bzw. `{owner_id}/new_{uuid}.{ext}` vor Pferd-Anlage.

---

## 4. Prüfen

- **Table Editor**: Tabellen `stables`, `profiles`, `horses` vorhanden.
- **Storage**: Bucket `horse-images` vorhanden (falls 3c ausgeführt).
- **Authentication**: E-Mail/Passwort-Login ist standardmäßig aktiv (Provider „Email“).
- **Settings → API**: `Project URL` und `anon` Key für `.env` notieren.

---

## 5. Umgebungsvariablen im Projekt

Im Projektroot eine Datei **`.env.local`** anlegen (oder `.env`):

```env
VITE_SUPABASE_URL=https://dein-projekt.supabase.co
VITE_SUPABASE_ANON_KEY=dein-anon-key
```

Die Werte aus **Supabase Dashboard → Settings → API** übernehmen. Optional können bestehende Keys (z. B. `GEMINI_API_KEY`, `CLAUDE_API_KEY`) dort ebenfalls stehen.

---

## Übersicht Tabellen

| Tabelle   | Beschreibung |
|----------|--------------|
| `stables` | Ställe (Name, PLZ); PLZ-Suche bei Registrierung |
| `profiles` | Ein Eintrag pro User (auth.users); Rolle, Name, Stall/Praxis, Einstellungen |
| `horses` | Pferde; `vaccinations` und `service_history` als JSONB |

**Auth** läuft über Supabase Auth (E-Mail/Passwort). Die App legt nach der Registrierung einen Eintrag in `profiles` an.

### „Stall neu anlegen“ bei Registrierung

Beim Anlegen eines neuen Stalls werden Name und PLZ in `stables` gespeichert. Die bestehende Tabelle (`name`, `zip`) reicht aus – **keine Anpassung in der Datenbank nötig**. Neu angelegte Ställe erscheinen bei der PLZ-Suche und stehen bei weiteren Registrierungen als Auswahl zur Verfügung.

### Tierarzt-Registrierung

Das Tierarzt-Profil wird per **Trigger** `handle_new_user` angelegt (Schritt 3b). Ohne diesen Trigger schlägt die Registrierung u. a. bei aktivierter E-Mail-Bestätigung fehl.
