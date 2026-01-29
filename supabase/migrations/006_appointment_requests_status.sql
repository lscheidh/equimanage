-- Status, Vet-Antwort, Besitzer-Bestätigung, geplantes Datum

ALTER TABLE public.appointment_requests
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  ADD COLUMN IF NOT EXISTS scheduled_date DATE,
  ADD COLUMN IF NOT EXISTS vet_response_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS owner_confirmed_at TIMESTAMPTZ;

-- Besitzer dürfen eigene Anfragen lesen (für Dashboard)
DROP POLICY IF EXISTS "appointment_requests_select_owner" ON public.appointment_requests;
CREATE POLICY "appointment_requests_select_owner" ON public.appointment_requests
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

-- Tierarzt darf eigene Anfragen bearbeiten (Annehmen/Ablehnen, Datum)
DROP POLICY IF EXISTS "appointment_requests_update_vet" ON public.appointment_requests;
CREATE POLICY "appointment_requests_update_vet" ON public.appointment_requests
  FOR UPDATE TO authenticated
  USING (vet_id = auth.uid())
  WITH CHECK (vet_id = auth.uid());

-- Besitzer darf eigene Anfragen bearbeiten (Bestätigen)
DROP POLICY IF EXISTS "appointment_requests_update_owner" ON public.appointment_requests;
CREATE POLICY "appointment_requests_update_owner" ON public.appointment_requests
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
