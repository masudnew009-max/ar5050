/*
# Phase 3 — Reels & Orders: reels table

## Overview
Shoppable, TikTok-style promo videos (roadmap point #6). Each reel links
to exactly one of the seller's own products, so tapping "Buy Now" on a
reel always goes straight to a real, purchasable product.

## New Table
### reels
- `id` (uuid, PK)
- `seller_id` (uuid, references profiles, cascade delete)
- `product_id` (uuid, references products, cascade delete)
- `video_url` (text, not null)
- `thumbnail_url` (text)
- `caption` (text)
- `is_active` (boolean, default true) — seller can hide a reel
- `created_at`, `updated_at`

## Security (RLS)
- admin: full access
- seller: full access to their own reels — and a reel can only ever be
  linked to a product that seller themselves owns (checked on insert/update)
- public (including anonymous visitors): can SELECT a reel only if it's
  active AND its linked product is currently approved + active — so a
  reel never points customers at a pending/rejected/hidden product
*/

CREATE TABLE IF NOT EXISTS reels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    video_url text NOT NULL,
    thumbnail_url text,
    caption text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reels_seller_id ON reels(seller_id);
CREATE INDEX IF NOT EXISTS idx_reels_product_id ON reels(product_id);

ALTER TABLE reels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_reels" ON reels;
CREATE POLICY "admin_full_reels" ON reels FOR ALL
    TO authenticated USING (is_admin(auth.uid()))
    WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "seller_manage_own_reels" ON reels;
CREATE POLICY "seller_manage_own_reels" ON reels FOR ALL
    TO authenticated
    USING (auth.uid() = seller_id)
    WITH CHECK (
        auth.uid() = seller_id
        AND is_seller(auth.uid())
        AND EXISTS (SELECT 1 FROM products p WHERE p.id = product_id AND p.seller_id = auth.uid())
    );

DROP POLICY IF EXISTS "public_read_active_reels" ON reels;
CREATE POLICY "public_read_active_reels" ON reels FOR SELECT
    TO anon, authenticated
    USING (
        is_active = true
        AND EXISTS (
            SELECT 1 FROM products p
            WHERE p.id = product_id AND p.status = 'approved' AND p.is_active = true
        )
    );
