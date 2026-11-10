-- Migration 001: Multi-salas + Supabase Auth
-- Banco: watch-player-homolog (e produção posteriormente)

-- Enable pgcrypto for hashing
create extension if not exists pgcrypto;

-- ============================================================
-- Tabelas
-- ============================================================

-- Perfis de usuário (estendem auth.users via trigger)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Salas persistentes (donas do usuário)
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default 'Minha Sala' check (char_length(name) between 1 and 100),
  max_participants int not null default 2 check (max_participants between 2 and 10),
  invite_code_hash text not null,
  invite_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Participantes (logados + convidados)
create table if not exists public.room_participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  guest_token_hash text,
  participant_name text not null check (char_length(participant_name) between 1 and 40),
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (room_id, user_id),
  unique (room_id, guest_token_hash)
);

-- Estado do player (1 por sala)
create table if not exists public.room_state (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null unique references public.rooms(id) on delete cascade,
  current_video_id text,
  playback_state text not null default 'idle' check (playback_state in ('idle','paused','playing','buffering')),
  current_time_seconds double precision not null default 0 check (current_time_seconds >= 0),
  playback_rate double precision not null default 1,
  updated_at timestamptz not null default now(),
  updated_by text,
  action_id text,
  last_action text default 'init'
);

-- Mensagens do chat
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  participant_id uuid references public.room_participants(id) on delete set null,
  sender_name text not null,
  message text not null check (char_length(message) between 1 and 500),
  created_at timestamptz not null default now()
);

-- Fila de vídeos
create table if not exists public.video_queue (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  video_id text not null check (char_length(video_id) between 5 and 64),
  video_title text,
  added_by_participant_id uuid references public.room_participants(id) on delete set null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Índices
-- ============================================================

create index if not exists idx_rooms_owner on public.rooms(owner_id);
create index if not exists idx_participants_room on public.room_participants(room_id);
create index if not exists idx_participants_user on public.room_participants(user_id);
create index if not exists idx_chat_room_created on public.chat_messages(room_id, created_at);
create index if not exists idx_queue_room_pos on public.video_queue(room_id, position);

-- ============================================================
-- Triggers
-- ============================================================

-- updated_at automático
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger if not exists rooms_touch
  before update on public.rooms
  for each row execute function public.touch_updated_at();

create trigger if not exists room_state_touch
  before update on public.room_state
  for each row execute function public.touch_updated_at();

-- Perfil automático no signup
create or replace function public.handle_new_user()
returns trigger language plpgsql as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email, 'Usuário')
  );
  return new;
end;
$$;

create trigger if not exists on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================

alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.room_participants enable row level security;
alter table public.room_state enable row level security;
alter table public.chat_messages enable row level security;
alter table public.video_queue enable row level security;

-- Profiles: usuário vê e edita só o próprio
drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Rooms: owner CRUD, participant read
drop policy if exists rooms_owner on public.rooms;
create policy rooms_owner on public.rooms
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists rooms_participant_read on public.rooms;
create policy rooms_participant_read on public.rooms
  for select using (
    exists (select 1 from room_participants where room_id = id and user_id = auth.uid())
  );

-- Room participants: owner CRUD, self read/update last_seen, participant read
drop policy if exists participants_owner on public.room_participants;
create policy participants_owner on public.room_participants
  for all using (
    exists (select 1 from rooms where id = room_id and owner_id = auth.uid())
  );

drop policy if exists participants_self on public.room_participants;
create policy participants_self on public.room_participants
  for select using (user_id = auth.uid());

drop policy if exists participants_self_update on public.room_participants;
create policy participants_self_update on public.room_participants
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Room state: owner/participant read, owner write (via service_role)
drop policy if exists state_read on public.room_state;
create policy state_read on public.room_state
  for select using (
    exists (select 1 from rooms where id = room_id and owner_id = auth.uid())
    or exists (select 1 from room_participants where room_id = id and user_id = auth.uid())
  );

-- Chat messages: participant read/insert own
drop policy if exists chat_read on public.chat_messages;
create policy chat_read on public.chat_messages
  for select using (
    exists (select 1 from room_participants where room_id = room_id and user_id = auth.uid())
  );

drop policy if exists chat_insert on public.chat_messages;
create policy chat_insert on public.chat_messages
  for insert with check (
    exists (select 1 from room_participants where room_id = room_id and user_id = auth.uid())
  );

-- Video queue: participant read, participant insert own, owner delete/reorder
drop policy if exists queue_read on public.video_queue;
create policy queue_read on public.video_queue
  for select using (
    exists (select 1 from room_participants where room_id = room_id and user_id = auth.uid())
  );

drop policy if exists queue_insert on public.video_queue;
create policy queue_insert on public.video_queue
  for insert with check (
    exists (select 1 from room_participants where room_id = room_id and user_id = auth.uid())
  );

drop policy if exists queue_owner on public.video_queue;
create policy queue_owner on public.video_queue
  for delete using (
    exists (select 1 from rooms where id = room_id and owner_id = auth.uid())
  );

-- ============================================================
-- Realtime publications
-- ============================================================

alter publication supabase_realtime add table public.room_state;
alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.video_queue;
alter publication supabase_realtime add table public.room_participants;
