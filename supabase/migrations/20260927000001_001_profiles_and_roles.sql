/*
# Phase 1 — Users & Roles: profiles table

## Overview
Core identity table for the multi-vendor platform. Every authenticated user
(admin, seller, customer) gets exactly one row here.

## New Tables
### profiles
- `id` (uuid, PK, references auth.users, cascade delete)
- `email` (text, unique)
- `full_name` (text)
- `role` (text, check: 'admin' | 'seller' | 'customer', default 'customer')
- `mobile_number` (text)
- `is_active` (boolean, default true) — admin can deactivate an account
- `created_at` (timestamptz)

## Helper functions (SECURITY DEFINER — avoids RLS recursion)
- `is_admin(uuid)`
- `is_seller(uuid)`
- `is_customer(uuid)`

## Trigger
- On new `auth.users` row: auto-insert a `profiles` row.
  The very first user to ever sign up becomes 'admin'; everyone else
  starts as 'customer' (a customer later becomes a seller through the
  `register_seller` function added in the next migration).

## Security (RLS)
- admin: full access
- a user can read/update their own profile row only
- profile insert is handled by the trigger (SECURITY DEFINER), not by
  direct client inserts
*/

-- ============================================================
-- Helper functions
-- ============================================================
CREATE OR REPLACE FUNCTION is_admin(user_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM profiles WHERE id = user_id AND role = 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_seller(user_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM profiles WHERE id = user_id AND role = 'seller');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_customer(user_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM profiles WHERE id = user_id AND role = 'customer');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- profiles table
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text UNIQUE,
    full_name text,
    role text NOT NULL DEFAULT 'customer' CHECK (role IN ('admin', 'seller', 'customer')),
    mobile_number text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_profiles" ON profiles;
CREATE POLICY "admin_full_profiles" ON profiles FOR ALL
    TO authenticated USING (is_admin(auth.uid()))
    WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "users_read_own_profile" ON profiles;
CREATE POLICY "users_read_own_profile" ON profiles FOR SELECT
    TO authenticated
    USING (auth.uid() = id OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "users_update_own_profile" ON profiles;
CREATE POLICY "users_update_own_profile" ON profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Prevent a non-admin from changing their own role via a direct update
-- (role changes to 'seller' happen only through register_seller(), and
-- to 'admin' only by another admin, whose updates are covered by the
-- admin_full_profiles policy above and skip this trigger).
-- app.bypass_role_guard is a transaction-local flag that trusted
-- SECURITY DEFINER functions (e.g. register_seller in the next
-- migration) set for themselves so they can change role on the
-- user's behalf; a plain client-side UPDATE can never set it.
CREATE OR REPLACE FUNCTION prevent_role_self_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role <> OLD.role
     AND NOT is_admin(auth.uid())
     AND coalesce(current_setting('app.bypass_role_guard', true), 'false') <> 'true' THEN
    NEW.role := OLD.role;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_role_self_escalation ON profiles;
CREATE TRIGGER trg_prevent_role_self_escalation
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION prevent_role_self_escalation();

-- ============================================================
-- Auto-create profile on signup (first user = admin)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_count integer;
BEGIN
  SELECT COUNT(*) INTO user_count FROM public.profiles;

  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    CASE WHEN user_count = 0 THEN 'admin' ELSE 'customer' END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
