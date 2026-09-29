/*
# Phase 13 — Seller KYC (NID verification)

## Overview
Sellers must now submit their National ID (name on the ID, ID number,
and photos of both sides) when registering. This is separate from
product approval: admin approves/rejects a seller's identity here,
independently of whether any of their products are approved.

## seller_profiles: new columns
- `nid_number`, `nid_name` (text, required going forward)
- `nid_front_url`, `nid_back_url` (text — point at files in the new
  PRIVATE `seller-kyc` bucket, never public)
- `kyc_status` (text, check: 'pending' | 'approved' | 'rejected', default 'pending')
- `kyc_rejection_reason` (text)

## register_seller(): now requires the NID fields
Re-created with 4 new required parameters. Existing sellers (registered
before this migration) keep NULL NID fields and kyc_status defaults to
'pending' — the admin Sellers page will show them as needing KYC.

## Guard: only an admin can change kyc_status
Same pattern as the existing products approval guard — a seller can
freely edit their own NID fields (to correct a typo, say) but can never
set kyc_status/kyc_rejection_reason themselves.

## Storage: seller-kyc bucket (PRIVATE — public = false)
Unlike product-images / reel-videos, NID photos must never be publicly
readable.
- INSERT: any authenticated user, only into their own `${uid}/` folder
  (a customer uploads these *before* they become a seller, during the
  Become a Seller form)
- SELECT/UPDATE/DELETE: the owner (own folder) or an admin — nobody else,
  not even other sellers, not anon
Reading a file back requires a signed URL (created server-side per
request), since the bucket has no public read policy.
*/

-- ============================================================
-- seller_profiles: KYC columns
-- ============================================================
ALTER TABLE seller_profiles
  ADD COLUMN IF NOT EXISTS nid_number text,
  ADD COLUMN IF NOT EXISTS nid_name text,
  ADD COLUMN IF NOT EXISTS nid_front_url text,
  ADD COLUMN IF NOT EXISTS nid_back_url text,
  ADD COLUMN IF NOT EXISTS kyc_status text NOT NULL DEFAULT 'pending'
    CHECK (kyc_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS kyc_rejection_reason text;

-- ============================================================
-- Guard: block self-approval of KYC (mirrors products_seller_guard)
-- ============================================================
CREATE OR REPLACE FUNCTION seller_kyc_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin(auth.uid()) THEN
    NEW.kyc_status := OLD.kyc_status;
    NEW.kyc_rejection_reason := OLD.kyc_rejection_reason;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seller_kyc_guard ON seller_profiles;
CREATE TRIGGER trg_seller_kyc_guard
    BEFORE UPDATE ON seller_profiles
    FOR EACH ROW EXECUTE FUNCTION seller_kyc_guard();

-- ============================================================
-- register_seller(): now requires NID details
-- ============================================================
-- The old 5-argument version (from migration 012) has no NID checks. CREATE OR
-- REPLACE with a different argument list would only ADD an overload and leave
-- the old one callable, letting anyone become a seller without KYC — so drop it.
DROP FUNCTION IF EXISTS register_seller(text, text, text, text, text);

CREATE OR REPLACE FUNCTION register_seller(
    p_shop_name text,
    p_shop_slug text,
    p_nid_number text,
    p_nid_name text,
    p_nid_front_url text,
    p_nid_back_url text,
    p_shop_description text DEFAULT NULL,
    p_contact_phone text DEFAULT NULL,
    p_address text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_role text;
BEGIN
  SELECT role INTO v_current_role FROM profiles WHERE id = auth.uid();

  IF v_current_role IS NULL THEN
    RAISE EXCEPTION 'Profile not found for current user';
  END IF;

  IF v_current_role <> 'customer' THEN
    RAISE EXCEPTION 'Only a customer account can register as a seller (current role: %)', v_current_role;
  END IF;

  IF coalesce(btrim(p_nid_number), '') = ''
     OR coalesce(btrim(p_nid_name), '') = ''
     OR coalesce(btrim(p_nid_front_url), '') = ''
     OR coalesce(btrim(p_nid_back_url), '') = '' THEN
    RAISE EXCEPTION 'NID name, number, and both photos are required';
  END IF;

  IF EXISTS (SELECT 1 FROM seller_profiles WHERE shop_slug = p_shop_slug) THEN
    RAISE EXCEPTION 'This shop URL is already taken, please choose another';
  END IF;

  INSERT INTO seller_profiles (
    id, shop_name, shop_slug, shop_description, contact_phone, address,
    nid_number, nid_name, nid_front_url, nid_back_url, kyc_status
  )
  VALUES (
    auth.uid(), p_shop_name, p_shop_slug, p_shop_description, p_contact_phone, p_address,
    btrim(p_nid_number), btrim(p_nid_name), p_nid_front_url, p_nid_back_url, 'pending'
  );

  PERFORM set_config('app.bypass_role_guard', 'true', true);
  UPDATE profiles SET role = 'seller' WHERE id = auth.uid();
END;
$$;

-- ============================================================
-- Storage: private seller-kyc bucket
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'seller-kyc') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('seller-kyc', 'seller-kyc', false);
  END IF;
END $$;

DROP POLICY IF EXISTS "owner_or_admin_read_seller_kyc" ON storage.objects;
CREATE POLICY "owner_or_admin_read_seller_kyc"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'seller-kyc'
  AND ((storage.foldername(name))[1] = auth.uid()::text OR is_admin(auth.uid()))
);

DROP POLICY IF EXISTS "upload_own_seller_kyc" ON storage.objects;
CREATE POLICY "upload_own_seller_kyc"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'seller-kyc'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "manage_own_or_admin_seller_kyc" ON storage.objects;
CREATE POLICY "manage_own_or_admin_seller_kyc"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'seller-kyc'
  AND ((storage.foldername(name))[1] = auth.uid()::text OR is_admin(auth.uid()))
)
WITH CHECK (
  bucket_id = 'seller-kyc'
  AND ((storage.foldername(name))[1] = auth.uid()::text OR is_admin(auth.uid()))
);

DROP POLICY IF EXISTS "delete_own_or_admin_seller_kyc" ON storage.objects;
CREATE POLICY "delete_own_or_admin_seller_kyc"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'seller-kyc'
  AND ((storage.foldername(name))[1] = auth.uid()::text OR is_admin(auth.uid()))
);
