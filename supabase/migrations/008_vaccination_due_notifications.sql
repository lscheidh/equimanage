-- Tabelle für gesendete Impf-Fälligkeits-Benachrichtigungen
-- Verhindert doppelte E-Mails; jede neue Fälligkeit löst genau eine Mail aus.
CREATE TABLE IF NOT EXISTS public.vaccination_due_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  horse_id UUID NOT NULL REFERENCES public.horses(id) ON DELETE CASCADE,
  vacc_type TEXT NOT NULL,
  vacc_sequence TEXT NOT NULL,
  notified_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_id, horse_id, vacc_type, vacc_sequence)
);

ALTER TABLE public.vaccination_due_notifications ENABLE ROW LEVEL SECURITY;

-- Nur eigene Einträge lesen/schreiben (über Service Role in Edge Function)
CREATE POLICY "vaccination_due_notifications_select" ON public.vaccination_due_notifications
  FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "vaccination_due_notifications_insert" ON public.vaccination_due_notifications
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_vaccination_due_notifications_owner ON public.vaccination_due_notifications(owner_id);
