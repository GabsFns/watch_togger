-- Migration 002: Adicionar coluna invite_code às salas
-- Permite gerar links de convite diretos (ex: /join/ABC-1234)

alter table public.rooms add column if not exists invite_code text unique;

-- Backfill para salas já existentes (gerar código curto único via md5)
update public.rooms
set invite_code = substr(md5(gen_random_uuid()::text || now()::text), 1, 12)
where invite_code is null;

-- Índice único (já vem com add column unique, mas garantir)
create unique index if not exists idx_rooms_invite_code on public.rooms(invite_code);
