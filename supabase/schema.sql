-- ============================================================
-- Watch Together — Schema (colar no SQL Editor do Supabase)
-- ============================================================
-- Estratégia: 1 sala fixa (ideal para 2 pessoas). Tabelas simples,
-- RLS ativo por padrão, escritas protegidas por funções server-side
-- (service_role). Leitura realtime via anon com RLS mínimo.
-- ============================================================

create extension if not exists pgcrypto;

-- Salas
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Sala privada',
  access_code_hash text not null,
  created_at timestamptz not null default now()
);

-- Participantes (max. 2 por sala, garantido via trigger)
create table if not exists public.room_participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  participant_name text not null check (char_length(participant_name) between 1 and 40),
  session_token_hash text not null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (room_id, session_token_hash),
  unique (room_id, participant_name)  -- evita nomes duplicados na sala
);

-- Estado compartilhado do player (1 linha por sala)
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
  added_by text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_room_participants_room on public.room_participants(room_id);
create index if not exists idx_room_participants_seen on public.room_participants(room_id, last_seen_at);
create index if not exists idx_chat_messages_room_created on public.chat_messages(room_id, created_at);
create index if not exists idx_video_queue_room_position on public.video_queue(room_id, position);

-- Limita a 2 participantes por sala
create or replace function public.enforce_max_participants()
returns trigger language plpgsql as $$
declare cnt int;
begin
  select count(*) into cnt from public.room_participants where room_id = NEW.room_id;
  if cnt >= 2 then
    raise exception 'Sala cheia (máximo 2 participantes)';
  end if;
  return NEW;
end;
$$;

drop trigger if exists enforce_max_participants_trg on public.room_participants;
create trigger enforce_max_participants_trg
  before insert on public.room_participants
  for each row execute function public.enforce_max_participants();

-- stored: updated_at automático
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$;

drop trigger if exists room_state_touch on public.room_state;
create trigger room_state_touch
  before update on public.room_state
  for each row execute function public.touch_updated_at();

-- RLS
alter table public.rooms enable row level security;
alter table public.room_participants enable row level security;
alter table public.room_state enable row level security;
alter table public.chat_messages enable row level security;
alter table public.video_queue enable row level security;

drop policy if exists rooms_select on public.rooms;
create policy rooms_select on public.rooms for select using (true);

drop policy if exists room_participants_select on public.room_participants;
create policy room_participants_select on public.room_participants for select using (true);

-- Sugestão: participantes podem atualizar próprio last_seen
drop policy if exists room_participants_update_seen on public.room_participants;
create policy room_participants_update_seen on public.room_participants
  for update using (true) with check (true);

drop policy if exists room_state_select on public.room_state;
create policy room_state_select on public.room_state for select using (true);

drop policy if exists chat_messages_select on public.chat_messages;
create policy chat_messages_select on public.chat_messages for select using (true);

drop policy if exists video_queue_select on public.video_queue;
create policy video_queue_select on public.video_queue for select using (true);

-- Escritas (INSERT/UPDATE/DELETE) ficam bloqueadas para anon/authenticated.
-- Todas as escritas passam por Route Handlers com service_role no servidor.
-- (Não criar policies de insert/update/delete para anon/authenticated.)

-- Realtime: publicar tabelas relevantes
alter publication supabase_realtime add table public.room_state;
alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.video_queue;
alter publication supabase_realtime add table public.room_participants;

-- ============================================================
-- Instruções de setup (executar após criar projeto Supabase):
-- 1. Rode este SQL no SQL Editor.
-- 2. Copie URL e anon key para .env.local.
-- 3. Gere hash do código de acesso (código_A ou ROOM_ACCESS_CODE):
--    select crypt('<SEU_CODIGO>', gen_salt('bf'));
--    Insira a sala: insert into rooms (name, access_code_hash)
--    values ('Sala privada', '<hash do passo acima>');
--    Insira estado inicial:
--    insert into room_state (room_id, playback_state)
--    select id, 'idle' from rooms limit 1;
-- ============================================================
