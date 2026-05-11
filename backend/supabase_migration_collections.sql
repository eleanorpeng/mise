-- Run this in your Supabase SQL Editor (Dashboard > SQL > New query)
-- Adds collections + recipe_collections junction table.

-- 1. Collections table
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  cover_color text not null default '#F5D0BC',
  spine_color text not null default '#E8A87C',
  ink_color text not null default '#6C250A',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_collections_user_id on public.collections(user_id);

-- 2. Junction: which recipes belong to which collections
create table if not exists public.recipe_collections (
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  collection_id uuid not null references public.collections(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (recipe_id, collection_id)
);

create index if not exists idx_recipe_collections_collection_id
  on public.recipe_collections(collection_id);

-- 3. RLS: users only see/manage their own collections.
alter table public.collections enable row level security;
alter table public.recipe_collections enable row level security;

drop policy if exists "Users manage their own collections" on public.collections;
create policy "Users manage their own collections" on public.collections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage their own recipe-collection links"
  on public.recipe_collections;
create policy "Users manage their own recipe-collection links"
  on public.recipe_collections for all
  using (
    exists (
      select 1 from public.collections c
      where c.id = collection_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.collections c
      where c.id = collection_id and c.user_id = auth.uid()
    )
  );
