/*
# Phase 2 — Products & Settings: commission_settings + delivery_zones

## Overview
Two admin-configurable settings tables (roadmap points #3 and #4).

## New Tables
### commission_settings
Deliberately a *singleton* table (there is only ever one row, enforced by
`id boolean PRIMARY KEY DEFAULT true CHECK (id)`), since the platform has
one global commission rule for now. Per-seller overrides can be added
later without breaking this.
- `id` (boolean, PK, always `true`)
- `commission_type` (text, check: 'percentage' | 'fixed')
- `commission_value` (decimal) — e.g. 10 means "10%" when type=percentage,
  or a flat currency amount when type=fixed
- `updated_at` (timestamptz)

### delivery_zones
- `id` (uuid, PK)
- `zilla` (text, not null)
- `thana` (text, not null)
- `delivery_charge` (decimal, not null)
- `created_at`, `updated_at`
- unique on (zilla, thana)

## Security (RLS)
- admin: full access to both tables
- anyone (including anonymous visitors): can SELECT both — customers need
  to see the delivery charge for their area and sellers need to see the
  commission rate before checkout/dashboard totals can be computed
*/

-- ============================================================
-- commission_settings (singleton row)
-- ============================================================
CREATE TABLE IF NOT EXISTS commission_settings (
    id boolean PRIMARY KEY DEFAULT true CHECK (id),
    commission_type text NOT NULL DEFAULT 'percentage' CHECK (commission_type IN ('percentage', 'fixed')),
    commission_value decimal(10,2) NOT NULL DEFAULT 0 CHECK (commission_value >= 0),
    updated_at timestamptz DEFAULT now()
);

-- Seed the single row if it doesn't exist yet
INSERT INTO commission_settings (id, commission_type, commission_value)
VALUES (true, 'percentage', 10)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE commission_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_commission_settings" ON commission_settings;
CREATE POLICY "admin_full_commission_settings" ON commission_settings FOR ALL
    TO authenticated USING (is_admin(auth.uid()))
    WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "public_read_commission_settings" ON commission_settings;
CREATE POLICY "public_read_commission_settings" ON commission_settings FOR SELECT
    TO anon, authenticated
    USING (true);

-- ============================================================
-- delivery_zones
-- ============================================================
CREATE TABLE IF NOT EXISTS delivery_zones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    zilla text NOT NULL,
    thana text NOT NULL,
    delivery_charge decimal(10,2) NOT NULL DEFAULT 0 CHECK (delivery_charge >= 0),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE (zilla, thana)
);

CREATE INDEX IF NOT EXISTS idx_delivery_zones_zilla ON delivery_zones(zilla);

ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_delivery_zones" ON delivery_zones;
CREATE POLICY "admin_full_delivery_zones" ON delivery_zones FOR ALL
    TO authenticated USING (is_admin(auth.uid()))
    WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "public_read_delivery_zones" ON delivery_zones;
CREATE POLICY "public_read_delivery_zones" ON delivery_zones FOR SELECT
    TO anon, authenticated
    USING (true);
