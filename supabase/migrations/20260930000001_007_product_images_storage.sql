/*
# Phase 8 — Seller Dashboard: product-images storage bucket

## Overview
A public Supabase Storage bucket for product photos. Sellers upload into
their own folder (named after their user id) so one seller can never
overwrite or delete another seller's images; admins can manage anything.

## Storage Bucket
- `product-images` (public = true) — public read, since product photos
  need to be visible to every customer.

## Convention
Uploaded object paths must look like `${seller_id}/filename.jpg` — the
INSERT/UPDATE/DELETE policies below enforce that the first path segment
matches the uploader's own auth.uid().

## Security (Storage RLS Policies)
- SELECT: public (anon + authenticated)
- INSERT: a seller, only into their own folder
- UPDATE/DELETE: a seller (own folder) or an admin (any folder)
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'product-images') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('product-images', 'product-images', true);
  END IF;
END $$;

DROP POLICY IF EXISTS "public_read_product_images" ON storage.objects;
CREATE POLICY "public_read_product_images"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "seller_upload_own_product_images" ON storage.objects;
CREATE POLICY "seller_upload_own_product_images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND is_seller(auth.uid())
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "manage_own_or_admin_product_images" ON storage.objects;
CREATE POLICY "manage_own_or_admin_product_images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND ((storage.foldername(name))[1] = auth.uid()::text OR is_admin(auth.uid()))
)
WITH CHECK (
  bucket_id = 'product-images'
  AND ((storage.foldername(name))[1] = auth.uid()::text OR is_admin(auth.uid()))
);

DROP POLICY IF EXISTS "delete_own_or_admin_product_images" ON storage.objects;
CREATE POLICY "delete_own_or_admin_product_images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND ((storage.foldername(name))[1] = auth.uid()::text OR is_admin(auth.uid()))
);
