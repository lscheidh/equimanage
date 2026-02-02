-- stables_insert: Einschränkung auf valide Daten (name und zip erforderlich)
DROP POLICY IF EXISTS "stables_insert" ON public.stables;
CREATE POLICY "stables_insert"
  ON public.stables
  FOR INSERT
  TO authenticated
  WITH CHECK (
    name IS NOT NULL AND length(trim(name)) > 0
    AND zip IS NOT NULL AND length(trim(zip)) > 0
  );

-- stables_insert_anon: Gleiche Einschränkung für Registrierung (Stall neu anlegen)
DROP POLICY IF EXISTS "stables_insert_anon" ON public.stables;
CREATE POLICY "stables_insert_anon"
  ON public.stables
  FOR INSERT
  TO anon
  WITH CHECK (
    name IS NOT NULL AND length(trim(name)) > 0
    AND zip IS NOT NULL AND length(trim(zip)) > 0
  );
