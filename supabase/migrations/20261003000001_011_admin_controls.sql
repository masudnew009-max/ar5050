/*
# Admin Panel Step 1 — make "Block seller" and "Cancel order" actually mean something

## Why
The new admin panel can block a seller (sets profiles.is_active = false) and
cancel an order (sets orders.status = 'cancelled'). Until now neither had any
effect in the database:
- a blocked seller's products/reels were still public and still purchasable
- cancelling an order never returned the items to stock

## 1. Blocked sellers
- `is_active_user(uuid)`: SECURITY DEFINER helper (avoids RLS recursion) —
  true when the user's profile is active.
- Public product/reel visibility now also requires an ACTIVE seller.
- A blocked seller can still SEE their own data, but can no longer
  insert/update products or reels.
- The order_items trigger rejects items whose seller is blocked, so a
  blocked seller's products cannot be bought (even via a direct link).

## 2. Cancelled orders
- Moving an order to 'cancelled' returns every item's quantity to stock.
- A cancelled order can never be re-opened (that would need re-checking
  stock and commission, so it is simply refused).
*/

-- ============================================================
-- Helper
-- ============================================================
CREATE OR REPLACE FUNCTION is_active_user(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_active FROM profiles WHERE id = p_user_id), false);
$$;

GRANT EXECUTE ON FUNCTION is_active_user(uuid) TO anon, authenticated;

-- ============================================================
-- Products: hide blocked sellers' products, stop blocked sellers editing
-- ============================================================
DROP POLICY IF EXISTS "public_read_approved_products" ON products;
CREATE POLICY "public_read_approved_products" ON products FOR SELECT
    TO anon, authenticated
    USING (status = 'approved' AND is_active = true AND is_active_user(seller_id));

DROP POLICY IF EXISTS "seller_manage_own_products" ON products;
CREATE POLICY "seller_manage_own_products" ON products FOR ALL
    TO authenticated
    USING (auth.uid() = seller_id)
    WITH CHECK (auth.uid() = seller_id AND is_seller(auth.uid()) AND is_active_user(auth.uid()));

-- ============================================================
-- Reels: same treatment
-- ============================================================
DROP POLICY IF EXISTS "public_read_active_reels" ON reels;
CREATE POLICY "public_read_active_reels" ON reels FOR SELECT
    TO anon, authenticated
    USING (
        is_active = true
        AND is_active_user(seller_id)
        AND EXISTS (
            SELECT 1 FROM products p
            WHERE p.id = product_id AND p.status = 'approved' AND p.is_active = true
        )
    );

DROP POLICY IF EXISTS "seller_manage_own_reels" ON reels;
CREATE POLICY "seller_manage_own_reels" ON reels FOR ALL
    TO authenticated
    USING (auth.uid() = seller_id)
    WITH CHECK (
        auth.uid() = seller_id
        AND is_seller(auth.uid())
        AND is_active_user(auth.uid())
        AND EXISTS (SELECT 1 FROM products p WHERE p.id = product_id AND p.seller_id = auth.uid())
    );

-- ============================================================
-- Orders: refuse items from blocked sellers (same function as Phase 3,
-- plus one extra check)
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

  IF NOT is_active_user(v_seller_id) THEN
    RAISE EXCEPTION 'A product in your order is no longer available';
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

-- ============================================================
-- Cancelling an order returns its items to stock
-- ============================================================
CREATE OR REPLACE FUNCTION handle_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'cancelled' AND NEW.status <> 'cancelled' THEN
    RAISE EXCEPTION 'A cancelled order cannot be reopened';
  END IF;

  IF OLD.status <> 'cancelled' AND NEW.status = 'cancelled' THEN
    UPDATE products p
    SET stock = p.stock + q.qty
    FROM (
      SELECT product_id, SUM(quantity)::integer AS qty
      FROM order_items
      WHERE order_id = NEW.id
      GROUP BY product_id
    ) q
    WHERE p.id = q.product_id;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_status_change ON orders;
CREATE TRIGGER trg_order_status_change
    BEFORE UPDATE OF status ON orders
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION handle_order_status_change();
