-- ============================================================
-- Mise — Cook log migration
-- Adds the cook_logs table + cook-logs storage bucket.
-- Run after the main schema migration.
-- ============================================================


-- ============================================================
-- cook_logs
-- Per-day meal stickers. Each row is one cooked-meal photo +
-- the background-removed sticker derived from it.
-- ============================================================

create table public.cook_logs (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid              not null references public.users (id) on delete cascade,
  recipe_id       uuid              references public.recipes (id) on delete set null,
  cooked_date     date              not null,
  caption         text,
  original_path   text              not null,
  sticker_path    text              not null,
  dominant_color  text,
  created_at      timestamptz       not null default now()
);

comment on table public.cook_logs is 'One sticker per cook. cooked_date drives the calendar view; recipe_id is optional so users can log meals without a saved recipe.';

alter table public.cook_logs enable row level security;

create policy "Users can view their own cook logs"
  on public.cook_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert their own cook logs"
  on public.cook_logs for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own cook logs"
  on public.cook_logs for update
  using (auth.uid() = user_id);

create policy "Users can delete their own cook logs"
  on public.cook_logs for delete
  using (auth.uid() = user_id);

create index cook_logs_user_id_idx     on public.cook_logs (user_id);
create index cook_logs_cooked_date_idx on public.cook_logs (user_id, cooked_date desc);
create index cook_logs_recipe_id_idx   on public.cook_logs (recipe_id);


-- ============================================================
-- Storage bucket
-- Public bucket for original photos + sticker PNGs. Backend
-- writes via the service-role key; frontend reads public URLs.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('cook-logs', 'cook-logs', true)
on conflict (id) do nothing;
