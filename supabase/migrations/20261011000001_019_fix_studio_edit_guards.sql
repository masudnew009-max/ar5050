/*
# Fix: role/status/KYC guards were silently blocking direct Supabase
# Studio (Table Editor / SQL Editor) edits too

## Root cause
Three BEFORE UPDATE trigger "guards" — prevent_role_self_escalation
(profiles.role), products_seller_guard (products.status), and
seller_kyc_guard (seller_profiles.kyc_status) — all check
`is_admin(auth.uid())` to decide whether to allow the change, and
silently revert it back to the old value otherwise (no error, so it
just looks like "nothing happened").

Those checks were written for the ordinary app (a customer/seller's
authenticated request always has a real auth.uid()). But an edit made
directly in the Supabase dashboard's Table Editor runs with NO
Supabase Auth session at all — auth.uid() is NULL there — so
is_admin(NULL) is false, and the guard reverted the edit even though
the person doing it has full database/dashboard access already (a far
higher trust level than being "an admin" inside the app).

## Fix
Each guard now does nothing when auth.uid() IS NULL (dashboard/direct
SQL context), and only enforces the "must be admin" rule for
in-app requests (which always carry a real auth.uid()). This does not
weaken anything the app itself relies on — a customer or seller's
requests through the app always have their own auth.uid() and are
still blocked from touching these fields, exactly as before.
*/

CREATE OR REPLACE FUNCTION prevent_role_self_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role <> OLD.role
     AND auth.uid() IS NOT NULL
     AND NOT is_admin(auth.uid())
     AND coalesce(current_setting('app.bypass_role_guard', true), 'false') <> 'true' THEN
    NEW.role := OLD.role;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION products_seller_guard()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL AND NOT is_admin(auth.uid()) THEN
      NEW.status := 'pending';
      NEW.rejection_reason := NULL;
    END IF;
    NEW.updated_at := now();
  ELSIF TG_OP = 'UPDATE' THEN
    IF auth.uid() IS NOT NULL AND NOT is_admin(auth.uid()) THEN
      NEW.status := OLD.status;
      NEW.rejection_reason := OLD.rejection_reason;
    END IF;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION seller_kyc_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT is_admin(auth.uid()) THEN
    NEW.kyc_status := OLD.kyc_status;
    NEW.kyc_rejection_reason := OLD.kyc_rejection_reason;
  END IF;
  RETURN NEW;
END;
$$;

-- One-off: fix the row this was reported on, in case the edit that
-- prompted this fix already got silently reverted.
UPDATE profiles SET role = 'admin' WHERE email = 'artreadrsaminur@gmail.com' AND role <> 'admin';
