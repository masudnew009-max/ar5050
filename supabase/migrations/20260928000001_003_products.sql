/*
# Phase 2 — Products & Settings: products table

## Overview
Products are created by sellers but stay invisible to customers until an
admin approves them (roadmap point #2).

## New Table
### products
- `id` (uuid, PK)
- `seller_id` (uuid, references profiles, cascade delete) — owning seller
- `name` (text, not null)
- `description` (text)
- `category` (text) — simple text category for now
- `price` (decimal, not null)
- `stock` (integer, default 0)
- `unit` (text, default 'pcs')
- `image_url` (text)
- `status` (text, check: 'pending' | 'approved' | 'rejected', default 'pending')
- `rejection_reason` (text) — set by admin when rejecting
- `is_active` (boolean, default true) — seller can hide an approved product
- `created_at`, `updated_at` (timestamptz)

## Trigger
- A seller can never set `status`/`rejection_reason` directly (on insert
  a new product is always forced to 'pending'; on update by a non-admin
  those two columns are reverted to their old value). Only an admin
  update — checked via the existing `is_admin()` — can actually change
  approval status.

## Security (RLS)
- admin: full access
- seller: full access (select/insert/update/delete) to their own products,
  at any status — this is how the seller dashboard shows pending/rejected
  items too
- public (including anonymous visitors): can only SELECT products that
  are both `status = 'approved'` and `is_active = true`
*/

CREATE TABLE IF NOT EXISTS products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    category text,
    price decimal(10,2) NOT NULL CHECK (price >= 0),
    stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
    unit text DEFAULT 'pcs',
    image_url text,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    rejection_reason text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_seller_id ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_products" ON products;
CREATE POLICY "admin_full_products" ON products FOR ALL
    TO authenticated USING (is_admin(auth.uid()))
    WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "seller_manage_own_products" ON products;
CREATE POLICY "seller_manage_own_products" ON products FOR ALL
    TO authenticated
    USING (auth.uid() = seller_id)
    WITH CHECK (auth.uid() = seller_id AND is_seller(auth.uid()));

DROP POLICY IF EXISTS "public_read_approved_products" ON products;
CREATE POLICY "public_read_approved_products" ON products FOR SELECT
    TO anon, authenticated
    USING (status = 'approved' AND is_active = true);

-- ============================================================
-- Approval-field guard: only an admin update can change status
-- ============================================================
CREATE OR REPLACE FUNCTION products_seller_guard()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT is_admin(auth.uid()) THEN
      NEW.status := 'pending';
      NEW.rejection_reason := NULL;
    END IF;
    NEW.updated_at := now();
  ELSIF TG_OP = 'UPDATE' THEN
    IF NOT is_admin(auth.uid()) THEN
      NEW.status := OLD.status;
      NEW.rejection_reason := OLD.rejection_reason;
    END IF;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_products_seller_guard ON products;
CREATE TRIGGER trg_products_seller_guard
    BEFORE INSERT OR UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION products_seller_guard();
