/*
# Phase 17b — Seller payouts

The platform collects all customer money (Phase 17), so it owes each seller
their `seller_net_amount` (sale minus commission). This migration records what
has been paid out and computes what is still owed.

## What counts as "payable"
An order line becomes payable when its order is BOTH:
  - status = 'completed', and
  - payment_status = 'paid'
(For Cash on Delivery, admin marks the order Paid after the courier's cash
reaches the platform.) Lines in other non-cancelled orders are "pending".

## Objects
- `seller_payouts` table: one row per payout made by admin.
  RLS: admin full access; a seller can read only their own rows.
- `payout_summary()`: per seller -> payable, pending, paid_out, balance.
  Admin gets every seller; a seller gets only themselves.
- `record_payout(seller, amount, method, reference, note)`: admin only; refuses
  to pay more than the seller's current balance.
*/

CREATE TABLE IF NOT EXISTS seller_payouts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    amount numeric(12,2) NOT NULL CHECK (amount > 0),
    method text NOT NULL DEFAULT 'bkash',
    reference text,
    note text,
    paid_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_seller_payouts_seller ON seller_payouts(seller_id, paid_at DESC);

ALTER TABLE seller_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_seller_payouts" ON seller_payouts;
CREATE POLICY "admin_full_seller_payouts" ON seller_payouts FOR ALL
    TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "seller_select_own_payouts" ON seller_payouts;
CREATE POLICY "seller_select_own_payouts" ON seller_payouts FOR SELECT
    TO authenticated USING (seller_id = auth.uid());

CREATE OR REPLACE FUNCTION payout_summary()
RETURNS TABLE (
    seller_id uuid,
    shop_name text,
    payable numeric,
    pending numeric,
    paid_out numeric,
    balance numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sp.id,
    sp.shop_name,
    COALESCE(e.payable, 0),
    COALESCE(e.pending, 0),
    COALESCE(p.paid, 0),
    COALESCE(e.payable, 0) - COALESCE(p.paid, 0)
  FROM seller_profiles sp
  LEFT JOIN (
    SELECT oi.seller_id AS sid,
      SUM(oi.seller_net_amount) FILTER (WHERE o.status = 'completed' AND o.payment_status = 'paid') AS payable,
      SUM(oi.seller_net_amount) FILTER (WHERE o.status <> 'cancelled'
                                        AND NOT (o.status = 'completed' AND o.payment_status = 'paid')) AS pending
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    GROUP BY oi.seller_id
  ) e ON e.sid = sp.id
  LEFT JOIN (
    SELECT spay.seller_id AS sid, SUM(spay.amount) AS paid
    FROM seller_payouts spay
    GROUP BY spay.seller_id
  ) p ON p.sid = sp.id
  WHERE is_admin(auth.uid()) OR sp.id = auth.uid();
$$;

REVOKE ALL ON FUNCTION payout_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION payout_summary() TO authenticated;

CREATE OR REPLACE FUNCTION record_payout(
  p_seller_id uuid,
  p_amount numeric,
  p_method text,
  p_reference text DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric;
  v_id uuid;
BEGIN
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only an admin can record payouts';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Enter a payout amount greater than zero';
  END IF;

  -- Serialize payouts per seller so two admins can't both spend the same balance
  PERFORM pg_advisory_xact_lock(hashtext(p_seller_id::text));

  SELECT s.balance INTO v_balance FROM payout_summary() s WHERE s.seller_id = p_seller_id;
  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'Seller not found';
  END IF;
  IF p_amount > v_balance THEN
    RAISE EXCEPTION 'Amount is more than the seller''s available balance (৳%)', v_balance;
  END IF;

  INSERT INTO seller_payouts (seller_id, amount, method, reference, note, created_by)
  VALUES (p_seller_id, p_amount, COALESCE(NULLIF(btrim(p_method), ''), 'other'),
          NULLIF(btrim(p_reference), ''), NULLIF(btrim(p_note), ''), auth.uid())
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION record_payout(uuid, numeric, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION record_payout(uuid, numeric, text, text, text) TO authenticated;
