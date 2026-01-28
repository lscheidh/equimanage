-- Tierarzt-Profil automatisch bei Registrierung anlegen (unabhängig von E-Mail-Bestätigung/Session).
-- Metadata kommt von signUp options.data (role, practice_name, zip).

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
