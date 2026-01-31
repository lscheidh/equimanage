-- Tabelle für gesendete Hufschmied-Fälligkeits-Benachrichtigungen
-- Verhindert doppelte E-Mails; eine Mail bei "fällig" (gelb), eine bei "kritisch" (rot).
CREATE TABLE IF NOT EXISTS public.hoof_due_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  horse_id UUID NOT NULL REFERENCES public.horses(id) ON DELETE CASCADE,
  notified_for TEXT NOT NULL CHECK (notified_for IN ('yellow', 'red')),
  notified_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_id, horse_id, notified_for)
);

ALTER TABLE public.hoof_due_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hoof_due_notifications_select" ON public.hoof_due_notifications
  FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "hoof_due_notifications_insert" ON public.hoof_due_notifications
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_hoof_due_notifications_owner ON public.hoof_due_notifications(owner_id);
