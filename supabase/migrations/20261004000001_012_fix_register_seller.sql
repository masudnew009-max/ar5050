/*
# Fix: "Something went wrong" when submitting Become a Seller

## Root cause
`register_seller()` (migration 002) declared a variable named
`current_role`. In PostgreSQL, CURRENT_ROLE is a reserved keyword that
means "the database role of the current session" — it is NOT a normal
identifier. When the function's SQL statements ran, `current_role` was
resolved to that special value (something like `authenticator` or
`anon`) instead of the local variable holding the profile's `role`
('customer' / 'seller' / 'admin').

The result: `IF current_role <> 'customer'` was comparing the database
session role to 'customer', which is never true, so the function always
fell through to `RAISE EXCEPTION 'Only a customer account can register
as a seller...'` — no matter who submitted the form. That's the
"Something went wrong" error every seller signup hit.

## Fix
Re-create the function with the variable renamed to `v_current_role`
(matching the `v_` naming convention already used everywhere else),
so PL/pgSQL and the SQL engine both resolve it correctly. Logic is
otherwise unchanged.
*/

CREATE OR REPLACE FUNCTION register_seller(
    p_shop_name text,
    p_shop_slug text,
    p_shop_description text DEFAULT NULL,
    p_contact_phone text DEFAULT NULL,
    p_address text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_role text;
BEGIN
  SELECT role INTO v_current_role FROM profiles WHERE id = auth.uid();

  IF v_current_role IS NULL THEN
    RAISE EXCEPTION 'Profile not found for current user';
  END IF;

  IF v_current_role <> 'customer' THEN
    RAISE EXCEPTION 'Only a customer account can register as a seller (current role: %)', v_current_role;
  END IF;

  IF EXISTS (SELECT 1 FROM seller_profiles WHERE shop_slug = p_shop_slug) THEN
    RAISE EXCEPTION 'This shop URL is already taken, please choose another';
  END IF;

  INSERT INTO seller_profiles (id, shop_name, shop_slug, shop_description, contact_phone, address)
  VALUES (auth.uid(), p_shop_name, p_shop_slug, p_shop_description, p_contact_phone, p_address);

  PERFORM set_config('app.bypass_role_guard', 'true', true);
  UPDATE profiles SET role = 'seller' WHERE id = auth.uid();
END;
$$;
