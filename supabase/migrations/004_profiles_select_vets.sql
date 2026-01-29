-- Tierarztsuche: Angemeldete Nutzer dürfen Vet-Profile (role = 'vet') lesen (Praxisname, PLZ).
-- Eigene Profile weiterhin nur via profiles_select_own.

DROP POLICY IF EXISTS "profiles_select_vets" ON public.profiles;
CREATE POLICY "profiles_select_vets" ON public.profiles
  FOR SELECT TO authenticated
  USING (role = 'vet');
