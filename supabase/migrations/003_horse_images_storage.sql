-- EquiManage: Storage-Bucket für Pferdebilder (Upload von Handy/Kamera)
-- Keine Änderung an horses-Tabelle nötig; image bleibt TEXT (URL).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'horse-images',
  'horse-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: Authentifizierte Nutzer können nur unter eigenem Ordner (owner_id) hochladen/löschen.
-- Pfad: {owner_id}/{horse_id}_{uuid}.{ext} oder {owner_id}/new_{uuid}.{ext} vor Pferd-Anlage

DROP POLICY IF EXISTS "horse_images_insert_own" ON storage.objects;
CREATE POLICY "horse_images_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'horse-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "horse_images_select_public" ON storage.objects;
CREATE POLICY "horse_images_select_public"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'horse-images');

DROP POLICY IF EXISTS "horse_images_update_own" ON storage.objects;
CREATE POLICY "horse_images_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'horse-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'horse-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "horse_images_delete_own" ON storage.objects;
CREATE POLICY "horse_images_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'horse-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
