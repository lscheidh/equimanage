-- Terminanfragen: Besitzer schicken Anfragen an Tierärzte (aus Termin-Modal).

CREATE TABLE IF NOT EXISTS public.appointment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vet_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  payload JSONB NOT NULL
);

ALTER TABLE public.appointment_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "appointment_requests_select_vet" ON public.appointment_requests;
CREATE POLICY "appointment_requests_select_vet" ON public.appointment_requests
  FOR SELECT TO authenticated
  USING (vet_id = auth.uid());

DROP POLICY IF EXISTS "appointment_requests_insert_owner" ON public.appointment_requests;
CREATE POLICY "appointment_requests_insert_owner" ON public.appointment_requests
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_appointment_requests_vet ON public.appointment_requests(vet_id);
CREATE INDEX IF NOT EXISTS idx_appointment_requests_owner ON public.appointment_requests(owner_id);
