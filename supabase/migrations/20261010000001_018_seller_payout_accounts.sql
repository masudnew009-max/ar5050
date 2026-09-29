/*
# Phase 17c — Seller payout accounts

Where the platform should send a seller's money (bKash / Nagad / Rocket / bank).

Kept in its OWN table, not on `seller_profiles`, because `seller_profiles` is
publicly readable (shop pages). A payout account number must only be visible to
the seller who owns it and to admins.

- one row per seller (seller_id is the primary key)
- RLS: a seller can read/insert/update/delete only their own row; admin full access
*/

CREATE TABLE IF NOT EXISTS seller_payout_accounts (
    seller_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    method text NOT NULL DEFAULT 'bkash' CHECK (method IN ('bkash', 'nagad', 'rocket', 'bank')),
    account_number text NOT NULL,
    account_name text,
    bank_details text,
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE seller_payout_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_payout_accounts" ON seller_payout_accounts;
CREATE POLICY "admin_full_payout_accounts" ON seller_payout_accounts FOR ALL
    TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "seller_manage_own_payout_account" ON seller_payout_accounts;
CREATE POLICY "seller_manage_own_payout_account" ON seller_payout_accounts FOR ALL
    TO authenticated
    USING (seller_id = auth.uid() AND is_seller(auth.uid()))
    WITH CHECK (seller_id = auth.uid() AND is_seller(auth.uid()));
