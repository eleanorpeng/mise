-- User profiles + onboarding preferences.
-- Run in the Supabase SQL Editor.

create table if not exists user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  intent text,                            -- e.g. 'cook_more', 'eat_healthier', 'learn_techniques', 'save_money', 'meal_prep'
  cuisine_preferences text[] default '{}',
  dietary_restrictions text[] default '{}',
  skill_level text,                       -- 'beginner' | 'intermediate' | 'advanced'
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table user_profiles enable row level security;

drop policy if exists "user can read own profile" on user_profiles;
create policy "user can read own profile" on user_profiles
  for select using (auth.uid() = user_id);

drop policy if exists "user can insert own profile" on user_profiles;
create policy "user can insert own profile" on user_profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists "user can update own profile" on user_profiles;
create policy "user can update own profile" on user_profiles
  for update using (auth.uid() = user_id);

-- Storage bucket for avatars (public read, authenticated write to own folder).
-- Run once in the Supabase dashboard SQL editor:
--
-- insert into storage.buckets (id, name, public)
-- values ('avatars', 'avatars', true)
-- on conflict (id) do nothing;
--
-- create policy "avatars are publicly readable"
--   on storage.objects for select using (bucket_id = 'avatars');
--
-- create policy "user can upload own avatar"
--   on storage.objects for insert
--   with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
--
-- create policy "user can update own avatar"
--   on storage.objects for update
--   using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
