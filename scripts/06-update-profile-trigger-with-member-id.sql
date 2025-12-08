-- Update the profile creation trigger to auto-assign member_id in V format

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_member_number INTEGER;
BEGIN
  -- Calculate the next member ID by counting existing profiles
  SELECT COALESCE(MAX(CAST(SUBSTRING(member_id FROM 2) AS INTEGER)), 0) + 1
  INTO next_member_number
  FROM public.profiles
  WHERE member_id ~ '^V[0-9]+$';
  
  -- Insert profile with auto-generated member_id
  INSERT INTO public.profiles (id, email, full_name, role, member_id, phone)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
    'V' || next_member_number,
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Display message
DO $$
BEGIN
  RAISE NOTICE 'Profile trigger updated to auto-assign V-format member IDs';
END $$;
