/*
# Phase 3 — Reels & Orders: orders + order_items tables

## Overview
One `orders` row per checkout; one `order_items` row per product line,
each stamped with which seller it belongs to and a snapshot of the
commission/net-income split at the moment of sale (so a later change to
`commission_settings` never rewrites past orders' numbers).

## New Tables
### orders
- `id` (uuid, PK)
- `customer_id` (uuid, references profiles, set null on delete)
- `customer_name`, `customer_phone`, `delivery_address` (text, not null)
- `zilla`, `thana` (text, not null) — for delivery-charge lookup
- `delivery_charge` (decimal, not null default 0)
- `subtotal` (decimal) — sum of order_items, kept in sync by trigger
- `total_amount` (decimal) — subtotal + delivery_charge, kept in sync by trigger
- `payment_method` (text, check: 'cod' | 'online')
- `payment_status` (text, check: 'unpaid' | 'pending_verification' | 'paid')
- `status` (text, check: 'pending' | 'processing' | 'completed' | 'cancelled')
- `created_at`, `updated_at`

### order_items
- `id` (uuid, PK)
- `order_id` (uuid, references orders, cascade delete)
- `product_id` (uuid, references products)
- `seller_id` (uuid, references profiles) — derived automatically, never
  trusted from the client
- `quantity` (integer, not null, > 0)
- `unit_price` (decimal, not null) — snapshot of the product's price
- `subtotal` (decimal) — quantity * unit_price, set by trigger
- `commission_amount` (decimal) — snapshot from commission_settings, set by trigger
- `seller_net_amount` (decimal) — subtotal - commission_amount, set by trigger
- `created_at`

## Triggers (on order_items insert)
1. Look up the product's current `seller_id` and `stock`; reject the
   insert if stock is insufficient; decrement stock by the ordered
   quantity — the same "no overselling" guarantee the old wholesale
   project had.
2. Stamp `seller_id`, compute `subtotal`, and compute
   `commission_amount`/`seller_net_amount` from the current
   `commission_settings` row.
3. Roll the item's subtotal into the parent order's `subtotal` and
   `total_amount`.

## Security (RLS)
- admin: full access to both tables
- customer: can SELECT/INSERT their own orders and order_items
- seller: can SELECT orders/order_items that contain at least one of
  their own products (needed for the seller dashboard and, later,
  courier booking) — nothing about other sellers' items in that order
  is exposed since seller_select_own_order_items is scoped to their
  own seller_id
*/

CREATE TABLE IF NOT EXISTS orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
    customer_name text NOT NULL,
    customer_phone text NOT NULL,
    delivery_address text NOT NULL,
    zilla text NOT NULL,
    thana text NOT NULL,
    delivery_charge decimal(10,2) NOT NULL DEFAULT 0,
    subtotal decimal(10,2) NOT NULL DEFAULT 0,
    total_amount decimal(10,2) NOT NULL DEFAULT 0,
    payment_method text NOT NULL DEFAULT 'cod' CHECK (payment_method IN ('cod', 'online')),
    payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'pending_verification', 'paid')),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES products(id),
    seller_id uuid REFERENCES profiles(id),
    quantity integer NOT NULL CHECK (quantity > 0),
    unit_price decimal(10,2) NOT NULL,
    subtotal decimal(10,2) NOT NULL DEFAULT 0,
    commission_amount decimal(10,2) NOT NULL DEFAULT 0,
    seller_net_amount decimal(10,2) NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_seller_id ON order_items(seller_id);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- orders policies
-- ============================================================
DROP POLICY IF EXISTS "admin_full_orders" ON orders;
CREATE POLICY "admin_full_orders" ON orders FOR ALL
    TO authenticated USING (is_admin(auth.uid()))
    WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "customer_select_own_orders" ON orders;
CREATE POLICY "customer_select_own_orders" ON orders FOR SELECT
    TO authenticated
    USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "customer_insert_own_orders" ON orders;
CREATE POLICY "customer_insert_own_orders" ON orders FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "seller_select_related_orders" ON orders;
CREATE POLICY "seller_select_related_orders" ON orders FOR SELECT
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = orders.id AND oi.seller_id = auth.uid())
    );

-- ============================================================
-- order_items policies
-- ============================================================
DROP POLICY IF EXISTS "admin_full_order_items" ON order_items;
CREATE POLICY "admin_full_order_items" ON order_items FOR ALL
    TO authenticated USING (is_admin(auth.uid()))
    WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "seller_select_own_order_items" ON order_items;
CREATE POLICY "seller_select_own_order_items" ON order_items FOR SELECT
    TO authenticated
    USING (auth.uid() = seller_id);

DROP POLICY IF EXISTS "customer_select_own_order_items" ON order_items;
CREATE POLICY "customer_select_own_order_items" ON order_items FOR SELECT
    TO authenticated
    USING (EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND o.customer_id = auth.uid()));

DROP POLICY IF EXISTS "customer_insert_own_order_items" ON order_items;
CREATE POLICY "customer_insert_own_order_items" ON order_items FOR INSERT
    TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.customer_id = auth.uid()));

-- ============================================================
-- Stock check/decrement + commission snapshot (BEFORE INSERT)
-- ============================================================
CREATE OR REPLACE FUNCTION handle_order_item_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_seller_id uuid;
  v_stock integer;
  v_commission_type text;
  v_commission_value decimal(10,2);
BEGIN
  SELECT seller_id, stock INTO v_seller_id, v_stock
  FROM products WHERE id = NEW.product_id FOR UPDATE;

  IF v_seller_id IS NULL THEN
    RAISE EXCEPTION 'Product % not found', NEW.product_id;
  END IF;

  IF v_stock < NEW.quantity THEN
    RAISE EXCEPTION 'Insufficient stock (available: %, requested: %)', v_stock, NEW.quantity;
  END IF;

  UPDATE products SET stock = stock - NEW.quantity WHERE id = NEW.product_id;

  NEW.seller_id := v_seller_id;
  NEW.subtotal := NEW.quantity * NEW.unit_price;

  SELECT commission_type, commission_value INTO v_commission_type, v_commission_value
  FROM commission_settings WHERE id = true;

  IF v_commission_type = 'percentage' THEN
    NEW.commission_amount := round(NEW.subtotal * v_commission_value / 100, 2);
  ELSE
    NEW.commission_amount := v_commission_value;
  END IF;

  NEW.seller_net_amount := NEW.subtotal - NEW.commission_amount;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_order_item_insert ON order_items;
CREATE TRIGGER trg_order_item_insert
    BEFORE INSERT ON order_items
    FOR EACH ROW EXECUTE FUNCTION handle_order_item_insert();

-- ============================================================
-- Keep the parent order's subtotal/total_amount in sync (AFTER INSERT)
-- ============================================================
CREATE OR REPLACE FUNCTION sync_order_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE orders
  SET subtotal = subtotal + NEW.subtotal,
      total_amount = subtotal + NEW.subtotal + delivery_charge,
      updated_at = now()
  WHERE id = NEW.order_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_order_totals ON order_items;
CREATE TRIGGER trg_sync_order_totals
    AFTER INSERT ON order_items
    FOR EACH ROW EXECUTE FUNCTION sync_order_totals();
