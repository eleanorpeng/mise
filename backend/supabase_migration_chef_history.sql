-- Chef chatbot history: conversations + messages
-- Run in Supabase SQL Editor after the base migrations.

create table if not exists chef_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists chef_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references chef_conversations(id) on delete cascade,
  ordinal int not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  recipe_json jsonb,
  suggestions jsonb,
  created_at timestamptz not null default now()
);

create index if not exists chef_messages_conversation_ordinal_idx
  on chef_messages (conversation_id, ordinal);

create index if not exists chef_conversations_user_updated_idx
  on chef_conversations (user_id, updated_at desc);

alter table chef_conversations enable row level security;
alter table chef_messages enable row level security;

drop policy if exists "Users manage their own chef conversations" on chef_conversations;
create policy "Users manage their own chef conversations"
  on chef_conversations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage messages in their chef conversations" on chef_messages;
create policy "Users manage messages in their chef conversations"
  on chef_messages for all
  using (
    exists (
      select 1 from chef_conversations c
      where c.id = chef_messages.conversation_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from chef_conversations c
      where c.id = chef_messages.conversation_id
        and c.user_id = auth.uid()
    )
  );
