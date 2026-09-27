/*
# Phase 9 — Seller Dashboard: reel-videos storage bucket

## Overview
A public Supabase Storage bucket for shoppable-reel video files. Same
per-seller-folder isolation pattern as `product-images` (Phase 8):
a seller can only upload/manage objects under their own `${seller_id}/`
folder; admins can manage anything; anyone can read (videos must be
publicly playable).

Reel thumbnails are stored in the existing `product-images` bucket
(it's just images, and the same seller-folder policy already covers it) —
no separate bucket needed for those.

## Storage Bucket
- `reel-videos` (public = true)

## Security (Storage RLS Policies)
- SELECT: public (anon + authenticated)
- INSERT: a seller, only into their own folder
- UPDATE/DELETE: a seller (own folder) or an admin (any folder)
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'reel-videos') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('reel-videos', 'reel-videos', true);
  END IF;
END $$;

DROP POLICY IF EXISTS "public_read_reel_videos" ON storage.objects;
CREATE POLICY "public_read_reel_videos"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'reel-videos');

DROP POLICY IF EXISTS "seller_upload_own_reel_videos" ON storage.objects;
CREATE POLICY "seller_upload_own_reel_videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'reel-videos'
  AND is_seller(auth.uid())
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "manage_own_or_admin_reel_videos" ON storage.objects;
CREATE POLICY "manage_own_or_admin_reel_videos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'reel-videos'
  AND ((storage.foldername(name))[1] = auth.uid()::text OR is_admin(auth.uid()))
)
WITH CHECK (
  bucket_id = 'reel-videos'
  AND ((storage.foldername(name))[1] = auth.uid()::text OR is_admin(auth.uid()))
);

DROP POLICY IF EXISTS "delete_own_or_admin_reel_videos" ON storage.objects;
CREATE POLICY "delete_own_or_admin_reel_videos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'reel-videos'
  AND ((storage.foldername(name))[1] = auth.uid()::text OR is_admin(auth.uid()))
);
