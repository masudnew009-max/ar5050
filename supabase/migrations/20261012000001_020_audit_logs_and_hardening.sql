/*
# Phase 0 (audit & stabilisation) — audit_logs + SECURITY DEFINER hardening

## 1. audit_logs (append-only)
A tamper-resistant history of sensitive events. Later phases (courier, wallet,
monetisation) will write here too.
- Only an admin can READ it. Nobody can write to it from the browser:
  there is no INSERT/UPDATE/DELETE policy and the privileges are revoked.
- Rows are written by `log_audit()`, which is NOT callable from the app
  (only from other SECURITY DEFINER functions / triggers below).
- UPDATE, DELETE and TRUNCATE are blocked by triggers, so rows can only be added.
- `actor_id` deliberately has NO foreign key: an FK with ON DELETE SET NULL would
  try to UPDATE a log row when a profile is deleted, and the append-only trigger
  would then block the deletion.

Logged automatically from now on:
- `order.payment_status_changed`  (admin marks Paid / Rejects, customer re-sends proof)
- `payout.recorded`               (every row added to seller_payouts)

## 2. SECURITY DEFINER hardening
Eight SECURITY DEFINER functions from the early phases were created without a
fixed `search_path`. A function that runs with its owner's rights should always pin
its search_path, otherwise a role that can create objects in another schema on the
path could shadow a table/function name it calls. Phases 9+ already pin it; this
migration pins the older ones too. `ALTER FUNCTION ... SET search_path` changes
nothing else — bodies, triggers and grants stay exactly as they are.

Affected: is_admin, is_seller, is_customer, prevent_role_self_escalation,
handle_new_user, products_seller_guard, handle_order_item_insert, sync_order_totals.

## 3. SECURITY FIX — seller_profiles was readable by everyone (incl. NID numbers)
Migration 002 gave `seller_profiles` a SELECT policy `USING (true)` for `anon`, so anyone
holding the public anon key (it ships inside the website's JavaScript) could read EVERY
seller's `nid_number`, `nid_name`, `contact_phone`, `address`, `kyc_status` and the
paths of the NID photos. (The photos themselves sit in the private `seller-kyc`
bucket, which was fine.) Phase 13 added the NID columns to this table but never
tightened the policy.

Fix:
- The open policy is replaced by one that lets a seller read ONLY their own row.
  Admin keeps full access through `admin_full_seller_profiles`.
- The public pages only ever needed the shop NAME (feed, reels, product page).
  They now call `public_shop_names(ids)`, a SECURITY DEFINER function that returns
  just `id` and `shop_name` for the ids asked for — nothing else.
- notify-seller (Edge Function) uses the service role, so it is unaffected.
*/

-- ============================================================
-- audit_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id uuid,                       -- auth.uid() at the time; NULL = dashboard / system
    action text NOT NULL,                -- e.g. 'payout.recorded'
    entity_type text,                    -- e.g. 'order', 'seller_payout'
    entity_id text,                      -- id of the affected row (text so any id type fits)
    details jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs (actor_id);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_audit_logs" ON audit_logs;
CREATE POLICY "admin_read_audit_logs" ON audit_logs FOR SELECT
    TO authenticated USING (is_admin(auth.uid()));

-- No write policies on purpose. Belt and braces: remove the table privileges too.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON audit_logs FROM anon, authenticated;

-- Append-only: refuse any change to existing rows
CREATE OR REPLACE FUNCTION audit_logs_block_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_logs_no_update_delete ON audit_logs;
CREATE TRIGGER trg_audit_logs_no_update_delete
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION audit_logs_block_change();

DROP TRIGGER IF EXISTS trg_audit_logs_no_truncate ON audit_logs;
CREATE TRIGGER trg_audit_logs_no_truncate
    BEFORE TRUNCATE ON audit_logs
    FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_block_change();

-- The one way to add a row. Not callable from the app (see REVOKE below).
CREATE OR REPLACE FUNCTION log_audit(
  p_action text,
  p_entity_type text DEFAULT NULL,
  p_entity_id text DEFAULT NULL,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), p_action, p_entity_type, p_entity_id, COALESCE(p_details, '{}'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION log_audit(text, text, text, jsonb) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- Automatic entries
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_order_payment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM log_audit(
    'order.payment_status_changed',
    'order',
    NEW.id::text,
    jsonb_build_object(
      'from', OLD.payment_status,
      'to', NEW.payment_status,
      'provider', NEW.payment_provider,
      'trx_id', NEW.payment_trx_id,
      'total_amount', NEW.total_amount
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_order_payment_status ON orders;
CREATE TRIGGER trg_audit_order_payment_status
    AFTER UPDATE OF payment_status ON orders
    FOR EACH ROW
    WHEN (OLD.payment_status IS DISTINCT FROM NEW.payment_status)
    EXECUTE FUNCTION audit_order_payment_status();

CREATE OR REPLACE FUNCTION audit_seller_payout()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM log_audit(
    'payout.recorded',
    'seller_payout',
    NEW.id::text,
    jsonb_build_object(
      'seller_id', NEW.seller_id,
      'amount', NEW.amount,
      'method', NEW.method,
      'reference', NEW.reference
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_seller_payout ON seller_payouts;
CREATE TRIGGER trg_audit_seller_payout
    AFTER INSERT ON seller_payouts
    FOR EACH ROW EXECUTE FUNCTION audit_seller_payout();

-- ============================================================
-- Pin search_path on the older SECURITY DEFINER functions
-- (no change to bodies, triggers or grants)
-- ============================================================
ALTER FUNCTION public.is_admin(uuid) SET search_path = public;
ALTER FUNCTION public.is_seller(uuid) SET search_path = public;
ALTER FUNCTION public.is_customer(uuid) SET search_path = public;
ALTER FUNCTION public.prevent_role_self_escalation() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.products_seller_guard() SET search_path = public;
ALTER FUNCTION public.handle_order_item_insert() SET search_path = public;
ALTER FUNCTION public.sync_order_totals() SET search_path = public;

-- ============================================================
-- seller_profiles: stop exposing NID / phone / address to the public
-- ============================================================
DROP POLICY IF EXISTS "public_read_seller_profiles" ON seller_profiles;

DROP POLICY IF EXISTS "owner_read_seller_profile" ON seller_profiles;
CREATE POLICY "owner_read_seller_profile" ON seller_profiles FOR SELECT
    TO authenticated USING (auth.uid() = id);

-- Public pages get shop names only (id + shop_name), for at most 200 ids per call
CREATE OR REPLACE FUNCTION public_shop_names(p_ids uuid[])
RETURNS TABLE (id uuid, shop_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sp.id, sp.shop_name
  FROM seller_profiles sp
  WHERE sp.id = ANY (p_ids[1:200]);
$$;

REVOKE ALL ON FUNCTION public_shop_names(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public_shop_names(uuid[]) TO anon, authenticated;
