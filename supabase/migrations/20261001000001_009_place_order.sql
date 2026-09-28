/*
# Phase 11 — Checkout: atomic, server-priced order placement

## Why
Phase 3 let a logged-in customer INSERT into `orders` / `order_items`
directly. That means the browser decided `unit_price`, `delivery_charge`,
`status` and `payment_status` — so a customer could order at ৳0.01 with free
delivery, or mark their own order "paid". It also meant a failed item insert
(e.g. out of stock) left an empty order behind.

## What this migration does
1. Adds `place_order(...)`: ONE atomic function that
   - requires a signed-in user (customer_id = auth.uid())
   - takes the delivery charge from `delivery_zones` (never from the client)
   - takes each `unit_price` from `products.price` (never from the client)
   - only accepts approved + active products
   - forces status = 'pending', payment_status = 'unpaid'
   - currently accepts only payment_method = 'cod' (online payment is a later phase)
   - inserts the order + items in one transaction: if any item fails
     (insufficient stock, unavailable product) the whole order rolls back.
   The existing order_items triggers still do stock decrement + commission snapshot.
2. Removes the direct-INSERT policies for customers on `orders` and
   `order_items`, so `place_order` is the only way a customer can create an order.
   (Customers can still SELECT their own orders; admin keeps full access.)

3. Fixes an RLS infinite-recursion bug from Phase 3: the seller SELECT policy
   on `orders` looked inside `order_items`, whose customer SELECT policy looks
   back inside `orders` — Postgres refuses to evaluate that loop
   ("infinite recursion detected in policy for relation orders"), so
   no non-admin could read orders. The seller check now goes through a
   SECURITY DEFINER helper (`seller_has_item_in_order`) that reads
   `order_items` without re-triggering its policies, which breaks the cycle
   without changing who can see what.

## Returns
The new order's uuid.
*/

CREATE OR REPLACE FUNCTION place_order(
  p_customer_name text,
  p_customer_phone text,
  p_delivery_address text,
  p_zilla text,
  p_thana text,
  p_payment_method text,
  p_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_charge decimal(10,2);
  v_order_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_qty integer;
  v_price decimal(10,2);
  v_status text;
  v_active boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Please sign in to place an order';
  END IF;

  IF coalesce(btrim(p_customer_name), '') = ''
     OR coalesce(btrim(p_customer_phone), '') = ''
     OR coalesce(btrim(p_delivery_address), '') = '' THEN
    RAISE EXCEPTION 'Name, phone and delivery address are required';
  END IF;

  IF p_payment_method IS DISTINCT FROM 'cod' THEN
    RAISE EXCEPTION 'Only cash on delivery is available right now';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Your order has no items';
  END IF;

  SELECT delivery_charge INTO v_charge
  FROM delivery_zones
  WHERE zilla = p_zilla AND thana = p_thana;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery is not available to this area';
  END IF;

  INSERT INTO orders (
    customer_id, customer_name, customer_phone, delivery_address,
    zilla, thana, delivery_charge, payment_method, payment_status, status
  ) VALUES (
    v_uid, btrim(p_customer_name), btrim(p_customer_phone), btrim(p_delivery_address),
    p_zilla, p_thana, v_charge, 'cod', 'unpaid', 'pending'
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::integer;

    IF v_qty IS NULL OR v_qty < 1 THEN
      RAISE EXCEPTION 'Invalid quantity';
    END IF;

    SELECT price, status, is_active INTO v_price, v_status, v_active
    FROM products WHERE id = v_product_id;

    IF NOT FOUND OR v_status <> 'approved' OR NOT v_active THEN
      RAISE EXCEPTION 'A product in your order is no longer available';
    END IF;

    -- stock check/decrement + commission snapshot happen in the existing
    -- BEFORE INSERT trigger on order_items
    INSERT INTO order_items (order_id, product_id, quantity, unit_price)
    VALUES (v_order_id, v_product_id, v_qty, v_price);
  END LOOP;

  RETURN v_order_id;
END;
$$;

REVOKE ALL ON FUNCTION place_order(text, text, text, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION place_order(text, text, text, text, text, text, jsonb) TO authenticated;

-- place_order is now the only customer path for creating orders
DROP POLICY IF EXISTS "customer_insert_own_orders" ON orders;
DROP POLICY IF EXISTS "customer_insert_own_order_items" ON order_items;

-- ============================================================
-- Fix RLS infinite recursion between orders <-> order_items
-- ============================================================
CREATE OR REPLACE FUNCTION seller_has_item_in_order(p_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM order_items oi
    WHERE oi.order_id = p_order_id AND oi.seller_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION seller_has_item_in_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION seller_has_item_in_order(uuid) TO authenticated;

DROP POLICY IF EXISTS "seller_select_related_orders" ON orders;
CREATE POLICY "seller_select_related_orders" ON orders FOR SELECT
    TO authenticated
    USING (seller_has_item_in_order(id));
