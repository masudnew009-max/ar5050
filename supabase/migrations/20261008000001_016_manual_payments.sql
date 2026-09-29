/*
# Phase 17 — Manual payments (bKash / Nagad / Rocket / Bank) to the platform's accounts

## How it works
1. Admin configures payment methods (account number, name, instructions, on/off)
   in Admin -> Payment Methods. All money goes to the PLATFORM's accounts; paying
   sellers out is a later step.
2. At checkout a customer picks Cash on Delivery or one of the active methods,
   sends the total to the shown account, then enters the Transaction ID and the
   number/account they paid from.
3. The order is created with payment_status = 'pending_verification'.
   Admin checks the payment and marks it Paid, or Rejects it (with a note).
4. After a rejection the customer can send a corrected Transaction ID
   (`submit_payment_proof`), which puts the order back to 'pending_verification'.

## Changes
- New table `payment_methods` (public can read ACTIVE rows; admin full access).
  Seeded with bKash, Nagad, Rocket, Bank Transfer — all INACTIVE until admin
  fills in the account details and switches them on.
- `orders` gets payment_provider, payment_trx_id, payment_sender, payment_note.
  A Transaction ID can only be used once per provider.
- `place_order` gets two optional args (trx id, sender) and now accepts a payment
  method code instead of only 'cod'. The old 7-argument version is dropped.
- New `submit_payment_proof(order_id, trx_id, sender)` for resubmitting after a rejection.
*/

-- ============================================================
-- payment_methods
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_methods (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9_]{2,30}$'),
    name text NOT NULL,
    kind text NOT NULL DEFAULT 'mobile' CHECK (kind IN ('mobile', 'bank')),
    account_name text,
    account_number text NOT NULL DEFAULT '',
    extra text,
    instructions text,
    is_active boolean NOT NULL DEFAULT false,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_active_payment_methods" ON payment_methods;
CREATE POLICY "public_read_active_payment_methods" ON payment_methods FOR SELECT
    TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS "admin_full_payment_methods" ON payment_methods;
CREATE POLICY "admin_full_payment_methods" ON payment_methods FOR ALL
    TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

INSERT INTO payment_methods (code, name, kind, extra, instructions, sort_order) VALUES
  ('bkash',  'bKash',         'mobile', NULL, 'Open bKash, choose Send Money, send the exact total, then enter the Transaction ID (TrxID) below.', 1),
  ('nagad',  'Nagad',         'mobile', NULL, 'Open Nagad, choose Send Money, send the exact total, then enter the Transaction ID below.', 2),
  ('rocket', 'Rocket',        'mobile', NULL, 'Open Rocket, choose Send Money, send the exact total, then enter the Transaction ID below.', 3),
  ('bank',   'Bank Transfer', 'bank',   NULL, 'Transfer the exact total to this account, then enter the transaction / reference number below.', 4)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- orders: payment proof columns
-- ============================================================
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS payment_provider text,
    ADD COLUMN IF NOT EXISTS payment_trx_id text,
    ADD COLUMN IF NOT EXISTS payment_sender text,
    ADD COLUMN IF NOT EXISTS payment_note text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_provider_trx
    ON orders (payment_provider, lower(payment_trx_id))
    WHERE payment_trx_id IS NOT NULL;

-- ============================================================
-- place_order: now supports manual online payment
-- ============================================================
DROP FUNCTION IF EXISTS place_order(text, text, text, text, text, text, jsonb);

CREATE OR REPLACE FUNCTION place_order(
  p_customer_name text,
  p_customer_phone text,
  p_delivery_address text,
  p_zilla text,
  p_thana text,
  p_payment_method text,
  p_items jsonb,
  p_payment_trx_id text DEFAULT NULL,
  p_payment_sender text DEFAULT NULL
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
  v_method text := 'cod';
  v_pstatus text := 'unpaid';
  v_provider text := NULL;
  v_trx text := NULL;
  v_sender text := NULL;
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
    IF NOT EXISTS (SELECT 1 FROM payment_methods WHERE code = p_payment_method AND is_active) THEN
      RAISE EXCEPTION 'This payment method is not available';
    END IF;
    v_trx := btrim(coalesce(p_payment_trx_id, ''));
    v_sender := btrim(coalesce(p_payment_sender, ''));
    IF length(v_trx) < 6 THEN
      RAISE EXCEPTION 'Please enter the Transaction ID from your payment';
    END IF;
    IF v_sender = '' THEN
      RAISE EXCEPTION 'Please enter the number or account you paid from';
    END IF;
    v_method := 'online';
    v_pstatus := 'pending_verification';
    v_provider := p_payment_method;
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

  BEGIN
    INSERT INTO orders (
      customer_id, customer_name, customer_phone, delivery_address,
      zilla, thana, delivery_charge, payment_method, payment_status, status,
      payment_provider, payment_trx_id, payment_sender
    ) VALUES (
      v_uid, btrim(p_customer_name), btrim(p_customer_phone), btrim(p_delivery_address),
      p_zilla, p_thana, v_charge, v_method, v_pstatus, 'pending',
      v_provider, v_trx, v_sender
    ) RETURNING id INTO v_order_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'This Transaction ID has already been used';
  END;

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

REVOKE ALL ON FUNCTION place_order(text, text, text, text, text, text, jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION place_order(text, text, text, text, text, text, jsonb, text, text) TO authenticated;

-- ============================================================
-- submit_payment_proof: customer re-sends a Transaction ID after a rejection
-- ============================================================
CREATE OR REPLACE FUNCTION submit_payment_proof(
  p_order_id uuid,
  p_trx_id text,
  p_sender text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_trx text := btrim(coalesce(p_trx_id, ''));
  v_sender text := btrim(coalesce(p_sender, ''));
  v_order orders%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Please sign in';
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id AND customer_id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF v_order.payment_method <> 'online' OR v_order.payment_status <> 'unpaid' OR v_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'Payment details can''t be changed for this order';
  END IF;
  IF length(v_trx) < 6 THEN
    RAISE EXCEPTION 'Please enter the Transaction ID from your payment';
  END IF;
  IF v_sender = '' THEN
    RAISE EXCEPTION 'Please enter the number or account you paid from';
  END IF;

  BEGIN
    UPDATE orders
    SET payment_trx_id = v_trx,
        payment_sender = v_sender,
        payment_status = 'pending_verification',
        payment_note = NULL
    WHERE id = p_order_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'This Transaction ID has already been used';
  END;
END;
$$;

REVOKE ALL ON FUNCTION submit_payment_proof(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION submit_payment_proof(uuid, text, text) TO authenticated;
