/*
# Phase 12 — Order email notification: de-duplication table

## Overview
When an order is placed, the `notify-seller` Edge Function emails each seller
whose products are in that order. This table records "seller X has already
been emailed about order Y" so the same email can never be sent twice, even
if someone calls the function repeatedly.

## New Table
### order_notifications
- `order_id` (uuid, references orders, cascade delete)
- `seller_id` (uuid, references profiles, cascade delete)
- `sent_at` (timestamptz)
- primary key (order_id, seller_id)

## Security (RLS)
RLS is enabled with NO policies on purpose: browsers (anon/authenticated)
can neither read nor write it. Only the Edge Function, using the service-role
key, touches this table.
*/

CREATE TABLE IF NOT EXISTS order_notifications (
    order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    seller_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    sent_at timestamptz DEFAULT now(),
    PRIMARY KEY (order_id, seller_id)
);

ALTER TABLE order_notifications ENABLE ROW LEVEL SECURITY;
