-- practice_zip für Tierärzte (bei dualer Rolle: Besitzer + Tierarzt)
-- Ermöglicht getrennte PLZ für Stall (zip) vs. Praxis (practice_zip).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS practice_zip TEXT;

-- Dual-Rolle: Auch Profile mit practice_name (Besitzer + Tierarzt) für Tierarztsuche lesbar.
CREATE POLICY "profiles_select_vets_dual"
  ON public.profiles FOR SELECT TO authenticated
  USING (practice_name IS NOT NULL AND practice_name <> '');
