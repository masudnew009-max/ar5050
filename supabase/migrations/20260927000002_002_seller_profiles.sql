/*
# Phase 1 — Users & Roles: seller_profiles table + registration

## Overview
Extended, seller-only data. A row here only exists once a customer has
registered as a seller. Kept separate from `profiles` so seller-specific
fields (shop name, slug, contact info) don't clutter every user's row,
and so each seller's own data stays isolated from other sellers.

## New Tables
### seller_profiles
- `id` (uuid, PK, references profiles(id), cascade delete) — 1:1 with profiles
- `shop_name` (text, not null)
- `shop_slug` (text, unique, not null) — used for the seller's public storefront URL
- `shop_description` (text)
- `contact_phone` (text)
- `address` (text)
- `created_at` (timestamptz)

## Function
- `register_seller(shop_name, shop_slug, shop_description, contact_phone, address)`
  Callable by any logged-in 'customer'. Creates their seller_profiles row
  and flips profiles.role to 'seller' in one transaction. A user who is
  already a seller/admin, or a slug that's taken, raises an error.

## Security (RLS)
- admin: full access
- a seller can read/update their own seller_profiles row only
- anyone (including anonymous visitors) can read seller_profiles —
  shop name/slug/description are public storefront info
*/

CREATE TABLE IF NOT EXISTS seller_profiles (
    id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    shop_name text NOT NULL,
    shop_slug text UNIQUE NOT NULL,
    shop_description text,
    contact_phone text,
    address text,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE seller_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_seller_profiles" ON seller_profiles;
CREATE POLICY "admin_full_seller_profiles" ON seller_profiles FOR ALL
    TO authenticated USING (is_admin(auth.uid()))
    WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "public_read_seller_profiles" ON seller_profiles;
CREATE POLICY "public_read_seller_profiles" ON seller_profiles FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "seller_update_own_profile" ON seller_profiles;
CREATE POLICY "seller_update_own_profile" ON seller_profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ============================================================
-- Seller registration (customer -> seller, atomically)
-- ============================================================
CREATE OR REPLACE FUNCTION register_seller(
    p_shop_name text,
    p_shop_slug text,
    p_shop_description text DEFAULT NULL,
    p_contact_phone text DEFAULT NULL,
    p_address text DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  current_role text;
BEGIN
  SELECT role INTO current_role FROM profiles WHERE id = auth.uid();

  IF current_role IS NULL THEN
    RAISE EXCEPTION 'Profile not found for current user';
  END IF;

  IF current_role <> 'customer' THEN
    RAISE EXCEPTION 'Only a customer account can register as a seller (current role: %)', current_role;
  END IF;

  IF EXISTS (SELECT 1 FROM seller_profiles WHERE shop_slug = p_shop_slug) THEN
    RAISE EXCEPTION 'This shop URL is already taken, please choose another';
  END IF;

  INSERT INTO seller_profiles (id, shop_name, shop_slug, shop_description, contact_phone, address)
  VALUES (auth.uid(), p_shop_name, p_shop_slug, p_shop_description, p_contact_phone, p_address);

  PERFORM set_config('app.bypass_role_guard', 'true', true);
  UPDATE profiles SET role = 'seller' WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
