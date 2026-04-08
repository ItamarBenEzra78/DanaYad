-- ═══════════════════════════════════════════════
-- DanaYad – Supabase Database Setup
-- Run this in Supabase SQL Editor (Dashboard > SQL)
-- ═══════════════════════════════════════════════

-- 1. Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  stripe_customer_id TEXT,
  subscription_status TEXT NOT NULL DEFAULT 'inactive' CHECK (subscription_status IN ('active', 'inactive', 'cancelled')),
  subscription_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Auto-create profile on signup + auto-admin for Itamar4747@gmail.com
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    CASE
      WHEN LOWER(NEW.email) = 'itamar4747@gmail.com' THEN 'admin'
      ELSE 'user'
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Admins can read all profiles
CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Only service_role (Edge Functions) can update profiles
-- (No user-facing UPDATE policy needed)

-- 4. Supabase Auth Settings (do these in Dashboard):
--    - Authentication > Providers > Google: Enable
--      - Set Google Client ID and Client Secret (from Google Cloud Console)
--      - Google Cloud Console > APIs & Services > Credentials > OAuth 2.0 Client ID
--      - Authorized redirect URI: https://YOUR_PROJECT.supabase.co/auth/v1/callback
--    - Authentication > URL Configuration > Redirect URLs: add your app.html URL
