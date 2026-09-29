/*
# Phase 14খ — Reel likes

## New table: reel_likes
One row per (reel, user). Primary key (reel_id, user_id) makes a double
like impossible.
- RLS: a signed-in user can read / add / remove ONLY their own rows.
  Nobody can see who else liked what.
- INSERT also requires the reel to be visible to the user (active reel of
  an approved, active product) — the reels SELECT policy applies inside
  the check.

## reels.like_count
Public like counter kept in sync by a trigger on reel_likes, so the feed
can show counts without exposing the likes table.
- Trigger function is SECURITY DEFINER (users cannot update reels).
- Guard trigger: a seller has UPDATE rights on their own reels, so any
  direct change to like_count outside the counter trigger is reverted.
*/

ALTER TABLE reels ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS reel_likes (
    reel_id uuid NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (reel_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_reel_likes_user_id ON reel_likes(user_id);

ALTER TABLE reel_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_own_reel_likes" ON reel_likes;
CREATE POLICY "read_own_reel_likes" ON reel_likes FOR SELECT
    TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "insert_own_reel_like" ON reel_likes;
CREATE POLICY "insert_own_reel_like" ON reel_likes FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (SELECT 1 FROM reels r WHERE r.id = reel_id)
    );

DROP POLICY IF EXISTS "delete_own_reel_like" ON reel_likes;
CREATE POLICY "delete_own_reel_like" ON reel_likes FOR DELETE
    TO authenticated USING (user_id = auth.uid());

-- ------------------------------------------------------------
-- Keep reels.like_count in sync
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_reel_like_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE reels SET like_count = like_count + 1 WHERE id = NEW.reel_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE reels SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.reel_id;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_reel_like_count ON reel_likes;
CREATE TRIGGER trg_sync_reel_like_count
    AFTER INSERT OR DELETE ON reel_likes
    FOR EACH ROW EXECUTE FUNCTION public.sync_reel_like_count();

-- ------------------------------------------------------------
-- Guard: like_count can only change from inside the counter trigger
-- (trigger depth 2 = fired by the UPDATE issued from sync_reel_like_count)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_reel_like_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.like_count IS DISTINCT FROM OLD.like_count AND pg_trigger_depth() < 2 THEN
        NEW.like_count := OLD.like_count;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_reel_like_count ON reels;
CREATE TRIGGER trg_guard_reel_like_count
    BEFORE UPDATE ON reels
    FOR EACH ROW EXECUTE FUNCTION public.guard_reel_like_count();
