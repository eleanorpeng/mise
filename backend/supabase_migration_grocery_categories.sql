-- Migration: add missing grocery_category enum values
--
-- The app infers 9 grocery categories (lib/groceryCategory.ts) including
-- 'spices' and 'drinks', but the DB enum public.grocery_category only had:
--   produce, dairy, meat, seafood, pantry, frozen, bakery, other
-- So "Add all to grocery" silently dropped items that inferred to 'spices'
-- (e.g. Salt) or 'drinks' (e.g. wine) — the insert failed the enum check and
-- the client reverted them.
--
-- Add the two missing values so every category the app produces is accepted.
-- Run once in the Supabase SQL Editor. ADD VALUE IF NOT EXISTS is idempotent.

alter type public.grocery_category add value if not exists 'spices';
alter type public.grocery_category add value if not exists 'drinks';

-- Verify:
--   select enum_range(null::public.grocery_category);
