/*
# Phase 15গ — Sub-categories

## New table: categories
Two levels in one table: a row with parent_id NULL is a top-level category
(the same 14 names the shop already uses), a row with a parent_id is a
sub-category of it.
- RLS: everyone can read active rows; only an admin can add/change/remove.
- Unique per parent + name (case-insensitive).

## products.subcategory
Plain text holding the sub-category name (nullable — every existing product
keeps working with just its category). products.category is unchanged.

## Seed
Starter sub-categories for each top-level category. Safe to re-run; rename,
add or remove rows later straight in the Table Editor (or a future admin
screen) — no code change needed.
*/

CREATE TABLE IF NOT EXISTS categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    parent_id uuid REFERENCES categories(id) ON DELETE CASCADE,
    sort_order integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_parent_name
    ON categories (COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_categories" ON categories;
CREATE POLICY "public_read_categories" ON categories FOR SELECT
    TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS "admin_full_categories" ON categories;
CREATE POLICY "admin_full_categories" ON categories FOR ALL
    TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory text;
CREATE INDEX IF NOT EXISTS idx_products_category_sub ON products(category, subcategory);

-- ------------------------------------------------------------
-- Seed: top-level categories
-- ------------------------------------------------------------
INSERT INTO categories (name, sort_order)
VALUES
  ('Electronics', 1), ('Clothing', 2), ('Furniture', 3), ('Sports', 4),
  ('Toys', 5), ('Baby Products', 6), ('Books', 7), ('Auto Accessories', 8),
  ('Food & Beverages', 9), ('Jewelry', 10), ('Cosmetics', 11),
  ('Hardware, Sanitary & Utilities', 12), ('All-in-One Equipment Hub', 13), ('Other', 14)
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- Seed: sub-categories
-- ------------------------------------------------------------
WITH data(parent, sub, ord) AS (
  VALUES
  ('Electronics', 'Mobile Phones', 1),
  ('Electronics', 'Mobile Accessories', 2),
  ('Electronics', 'Computers & Laptops', 3),
  ('Electronics', 'Audio & Headphones', 4),
  ('Electronics', 'Smart Watches & Wearables', 5),
  ('Electronics', 'Cameras', 6),
  ('Electronics', 'TV & Home Appliances', 7),

  ('Clothing', 'Men''s Wear', 1),
  ('Clothing', 'Women''s Wear', 2),
  ('Clothing', 'Kids'' Wear', 3),
  ('Clothing', 'Footwear', 4),
  ('Clothing', 'Bags & Accessories', 5),

  ('Furniture', 'Living Room', 1),
  ('Furniture', 'Bedroom', 2),
  ('Furniture', 'Kitchen & Dining', 3),
  ('Furniture', 'Office Furniture', 4),
  ('Furniture', 'Home Decor', 5),

  ('Sports', 'Fitness & Gym', 1),
  ('Sports', 'Cricket', 2),
  ('Sports', 'Football', 3),
  ('Sports', 'Outdoor & Camping', 4),
  ('Sports', 'Cycling', 5),

  ('Toys', 'Educational Toys', 1),
  ('Toys', 'Dolls & Soft Toys', 2),
  ('Toys', 'Remote Control & Vehicles', 3),
  ('Toys', 'Board Games & Puzzles', 4),
  ('Toys', 'Outdoor Play', 5),

  ('Baby Products', 'Diapers & Wipes', 1),
  ('Baby Products', 'Baby Feeding', 2),
  ('Baby Products', 'Baby Clothing', 3),
  ('Baby Products', 'Strollers & Car Seats', 4),
  ('Baby Products', 'Baby Care & Bath', 5),

  ('Books', 'Academic & Textbooks', 1),
  ('Books', 'Novels & Fiction', 2),
  ('Books', 'Islamic Books', 3),
  ('Books', 'Children''s Books', 4),
  ('Books', 'Stationery', 5),

  ('Auto Accessories', 'Car Accessories', 1),
  ('Auto Accessories', 'Bike & Motorcycle', 2),
  ('Auto Accessories', 'Helmets & Safety', 3),
  ('Auto Accessories', 'Oils & Lubricants', 4),
  ('Auto Accessories', 'Spare Parts', 5),

  ('Food & Beverages', 'Snacks', 1),
  ('Food & Beverages', 'Beverages', 2),
  ('Food & Beverages', 'Cooking Essentials', 3),
  ('Food & Beverages', 'Tea & Coffee', 4),
  ('Food & Beverages', 'Dates & Dry Fruits', 5),

  ('Jewelry', 'Rings', 1),
  ('Jewelry', 'Necklaces & Pendants', 2),
  ('Jewelry', 'Earrings', 3),
  ('Jewelry', 'Bracelets & Bangles', 4),
  ('Jewelry', 'Watches', 5),

  ('Cosmetics', 'Skin Care', 1),
  ('Cosmetics', 'Makeup', 2),
  ('Cosmetics', 'Hair Care', 3),
  ('Cosmetics', 'Perfume & Body Spray', 4),
  ('Cosmetics', 'Personal Care', 5),

  ('Hardware, Sanitary & Utilities', 'Hand & Power Tools', 1),
  ('Hardware, Sanitary & Utilities', 'Plumbing & Sanitary', 2),
  ('Hardware, Sanitary & Utilities', 'Electrical & Lighting', 3),
  ('Hardware, Sanitary & Utilities', 'Paint & Building Materials', 4),
  ('Hardware, Sanitary & Utilities', 'Locks & Security', 5),

  ('All-in-One Equipment Hub', 'Industrial Equipment', 1),
  ('All-in-One Equipment Hub', 'Kitchen Equipment', 2),
  ('All-in-One Equipment Hub', 'Office Equipment', 3)
)
INSERT INTO categories (name, parent_id, sort_order)
SELECT d.sub, p.id, d.ord
FROM data d
JOIN categories p ON p.name = d.parent AND p.parent_id IS NULL
ON CONFLICT DO NOTHING;
