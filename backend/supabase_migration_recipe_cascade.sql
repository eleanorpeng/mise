-- Migration: ON DELETE CASCADE for recipe child tables
--
-- Deleting a recipe was failing with a foreign-key violation because the child
-- tables (ingredients, steps, macros, planned_meals) reference recipes WITHOUT
-- ON DELETE CASCADE. This re-creates those FKs with cascade so deleting a
-- recipe cleans up its rows automatically.
--
-- recipe_collections already cascades and cook_logs is intentionally set-null
-- (a cook-log memory should outlive a deleted recipe), so neither is touched.
--
-- Run this once in the Supabase SQL Editor. It is atomic (a single DO block)
-- and idempotent (safe to re-run). It looks up the real constraint name rather
-- than assuming the default, so it won't fail on a non-standard name.

do $$
declare
  child  text;
  fk     text;
begin
  foreach child in array array['ingredients', 'steps', 'macros', 'planned_meals']
  loop
    -- Drop any existing FK from <child>.recipe_id -> recipes(id).
    for fk in
      select c.conname
      from pg_constraint c
      where c.contype = 'f'
        and c.conrelid = ('public.' || child)::regclass
        and c.confrelid = 'public.recipes'::regclass
    loop
      execute format('alter table public.%I drop constraint %I', child, fk);
    end loop;

    -- Re-create it with ON DELETE CASCADE.
    execute format(
      'alter table public.%I add constraint %I '
      || 'foreign key (recipe_id) references public.recipes(id) on delete cascade',
      child, child || '_recipe_id_fkey'
    );
  end loop;
end $$;

-- Verify (confdeltype: c = cascade, n = set null, a = no action):
--   select conrelid::regclass as child_table, conname, confdeltype
--   from pg_constraint
--   where confrelid = 'public.recipes'::regclass and contype = 'f'
--   order by 1;
