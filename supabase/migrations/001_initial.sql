-- EquiManage – Tabellen, RLS, Seed (siehe DATENBANK-ANLEITUNG.md)

CREATE TABLE IF NOT EXISTS public.stables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  zip TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.stables ENABLE ROW LEVEL SECURITY;

-- SELECT für anon (PLZ-Suche bei Registrierung) + authenticated
CREATE POLICY "stables_select" ON public.stables FOR SELECT TO authenticated USING (true);
CREATE POLICY "stables_select_anon" ON public.stables FOR SELECT TO anon USING (true);
CREATE POLICY "stables_insert" ON public.stables FOR INSERT TO authenticated WITH CHECK (true);

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

CREATE INDEX IF NOT EXISTS idx_stables_zip ON public.stables(zip);
CREATE INDEX IF NOT EXISTS idx_horses_owner ON public.horses(owner_id);

INSERT INTO public.stables (name, zip)
SELECT * FROM (VALUES
  ('Reitstall Grüne Wiese', '12345'),
  ('Gut Sonnenhof', '12345'),
  ('Pferdehof Am Wald', '10115'),
  ('Stall Rosenau', '20095')
) AS v(name, zip)
WHERE NOT EXISTS (SELECT 1 FROM public.stables LIMIT 1);

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
