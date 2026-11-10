# Watch Player - Plano de Projeto e Status

## Visão Geral
Aplicação "Watch Together" - Sala privada para 2 pessoas assistirem vídeos do YouTube sincronizados com chat e fila.

**Stack:** Next.js 16 (App Router) + TypeScript + Tailwind + Supabase (Postgres + Auth + Realtime) + YouTube IFrame API

---

## Status Atual por Fase

| Fase | Status | Descrição |
|------|--------|-----------|
| **Fase 1: Fundação Auth** | ✅ Concluída | `@supabase/ssr`, `auth-client.ts`, `auth-server.ts`, `middleware.ts` protegendo `/room/*`, tipos base |
| **Fase 2: Páginas Auth + CRUD Salas** | ✅ Concluída | `/login`, `/signup`, `/auth/callback`, `/api/rooms` (GET/POST), `/api/rooms/[id]` (PATCH/DELETE) |
| **Fase 3: Dashboard + Sala Dinâmica + Schema v2** | ✅ Concluída | Schema v2 (migrações 001), `/rooms` dashboard, `/room/[roomId]` dinâmica, RoomView com `roomId`, APIs com `roomId` query param |
| **Fase 4: Participantes + Convites** | 🔄 Em Progresso | `/join/:code` (GET/POST), `/join/[code]/page.tsx`, `invite_code` coluna (migração 002) |
| **Fase 5** | ✅ Parcial | Player + Sync já funcionam via `roomId` query param |
| **Fase 6** | ✅ Concluída | Fixes iPhone 7 (cookies, touch targets, navegação nativa) |
| **Fase 7** | ⏳ Pendente | CI/CD, script deploy DB, GitHub Actions merge homolog→main |

---

## O que está Pronto (Branch `homolog`)

### Auth & Segurança
- ✅ Supabase Auth (Email/Password + OAuth ready)
- ✅ Middleware protegendo `/room/*` e redirecionando logados de `/login`
- ✅ `@supabase/ssr` client/server
- ✅ Cookies `httpOnly`, `sameSite: lax`, `secure` condicional

### Salas (Rooms)
- ✅ Schema v2 completo: `profiles`, `rooms`, `room_participants`, `room_state`, `chat_messages`, `video_queue`
- ✅ RLS policies por owner/participante/guest
- ✅ Realtime configurado (publication `supabase_realtime`)
- ✅ `/api/rooms` GET (listar do owner) + POST (criar com `invite_code` + hash)
- ✅ `/api/rooms/[id]` PATCH/DELETE com verificação de owner
- ✅ Dashboard `/rooms` (listar, criar, editar, excluir, copiar link)

### Convites & Participantes
- ✅ Coluna `invite_code` na tabela `rooms` (migração 002)
- ✅ API `/api/join/[code]` GET (validar) + POST (entrar como logado ou convidado)
- ✅ Página `/join/[code]` com formulário de nome + redirect
- ✅ Convidados: `guest_token_hash` + cookie `wt_guest_<roomId>`
- ✅ RLS para participantes (owner CRUD, self read/update)

### Player & Sync
- ✅ YouTube IFrame API wrapper (`src/lib/youtube-player.ts`)
- ✅ `VideoPlayer` com estados: LOADING_API, LOADING_VIDEO, READY, WAITING_FOR_USER, PLAYING, PAUSED, BUFFERING, ERROR, ENDED
- ✅ `useSyncService` - push de estado via `/api/state` (apenas mudanças relevantes)
- ✅ `useRealtime` - subscribe a `room_state`, `chat_messages`, `video_queue`, `room_participants`
- ✅ Drift correction (2.5s playing / 0.5s paused) + `computeExpectedRemoteTime`
- ✅ Heartbeat presense 15s + reconciliação 20s

### UI & UX
- ✅ Dark theme, touch targets ≥44px, `touch-manipulation`
- ✅ `suppressHydrationWarning` apenas onde necessário
- ✅ Navegação nativa `window.location.href` (compatível iOS 15)
- ✅ Touch targets ≥44px em todos botões/inputs
- ✅ Responsivo: mobile tabs (Vídeo/Chat), desktop 2 colunas

---

## Migrações Pendentes (Banco Homolog)

**Migração 001** ✅ Aplicada - Schema v2 completo
**Migração 002** ⚠️ **Parcial** - Passo 1 e 3 OK, Passo 2 falhou

### Correção necessária (passo 2):
```sql
-- Erro: cannot cast type uuid to bytea
-- Fix: usar md5 em vez de cast uuid::bytea
update public.rooms
set invite_code = substr(md5(gen_random_uuid()::text || now()::text), 1, 12)
where invite_code is null;
```

Execute no SQL Editor do Supabase homolog (statement por statement):
1. `alter table public.rooms add column if not exists invite_code text unique;`
2. `update public.rooms set invite_code = substr(md5(gen_random_uuid()::text || now()::text), 1, 12) where invite_code is null;`
3. `create unique index if not exists idx_rooms_invite_code on public.rooms(invite_code);`

---

## Variáveis de Ambiente (Vercel)

### Projeto Homolog (branch `homolog`)
```
NEXT_PUBLIC_SUPABASE_URL=https://<projeto-homolog>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_... (homolog)
SUPABASE_SERVICE_ROLE_KEY=sb_secret_... (homolog)
NEXT_PUBLIC_APP_URL=https://<seu-projeto-homolog>.vercel.app
```

### Projeto Produção (branch `main`)
```
NEXT_PUBLIC_SUPABASE_URL=https://<projeto-prod>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_... (prod)
SUPABASE_SERVICE_ROLE_KEY=sb_secret_... (prod)
NEXT_PUBLIC_APP_URL=https://watch-player.vercel.app
```

**No Vercel:** Cada projeto tem suas próprias Environment Variables (Settings → Environment Variables). Não há conflito entre homolog e produção pois são projetos/ambientes separados. Configure `Production`, `Preview`, `Development` conforme necessário.

---

## Arquitetura Resumida

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                     │
├─────────────────────────────────────────────────────────────┤
│  /login, /signup, /auth/callback  → Auth UI                 │
│  /rooms                          → Dashboard (owner)        │
│  /room/[roomId]                  → Sala (participantes)     │
│  /join/[code]                    → Entrada por convite      │
│  /debug/player                   → Debug isolado            │
├─────────────────────────────────────────────────────────────┤
│  Middleware → Protege /room/* via Supabase Auth             │
│  useSyncService → Push estado (/api/state)                  │
│  useRealtime  → Subscribe (room_state, chat, queue, parts)  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Supabase (Postgres)                    │
├─────────────────────────────────────────────────────────────┤
│  Tables: profiles, rooms, room_participants, room_state,   │
│          chat_messages, video_queue                         │
│  RLS: Owner CRUD, Participant read/self-update, Guest token │
│  Realtime: room_state, chat_messages, video_queue, parts   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              YouTube IFrame API (embed)                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Próximos Passos (Prioridade)

### Imediato
1. **Rodar migration 002 corrigida** no Supabase homolog (3 statements)
2. **Validar fluxo completo**: Login → Criar sala → Copiar link `/join/...` → Entrar como convidado → Sincronização play/pause

### Fase 4 (Concluir)
- [ ] Dashboard `/rooms` mostrar link de convite copiável
- [ ] RoomView header mostrar link copiável
- [ ] Validação `max_participants` no server (já existe na API)

### Fase 5 (Sync já pronto)
- [ ] Testes de sync com 2+ usuários em salas diferentes
- [ ] Testar drift correction em vídeos longos (3-5h)

### Fase 6 (iPhone 7) ✅ Já aplicado
- Cookies `secure` condicional, `sameSite: lax`
- `router.refresh()` → `window.location.href`
- Touch targets ≥44px em todos botões
- `suppressHydrationWarning` apenas no `<html>`

### Fase 7 (CI/CD)
- Script `scripts/deploy-db.ts` + GitHub Actions
- Workflow `db-deploy` com inputs `homolog` | `prod`
- Merge `homolog → main` via PR aprovado → deploy automático

---

## Riscos & Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| RLS policies complexas travam queries | Média | Alto | Testar cada policy isoladamente no SQL Editor |
| Realtime + multi-sala escala | Baixa | Médio | Filtrar canais por `room_id`; limitar 10 salas/usuário |
| Merge DB homolog→prod conflitos | Baixa | Alta | Migrações versionadas + execução ordenada via script |
| iPhone 7 touch targets | Alta | Médio | Testar no simulador iOS 15 + device real; `min-h-[44px]` global |
| Cookie `httpOnly` no iOS 15 | Média | Alto | Testar com `secure` condicional + `sameSite: 'lax'`; fallback localStorage se falhar |

---

## Critérios de Pronto (Definition of Done)

- [ ] `homolog` deploya no Vercel Preview sem erros
- [ ] Login/logout funciona (Email + OAuth)
- [ ] Owner cria sala, define limite 2–10, gera link convite
- [ ] Convidado entra via link, vê player sincronizado
- [ ] 2+ usuários logados em salas diferentes não interferem
- [ ] Chat + Queue funcionam por sala
- [ ] iPhone 7 (iOS 15) entra, preenche formulário, navega para sala, vídeo roda
- [ ] `npm test` + `typecheck` + `build` passam
- [ ] Deploy DB homolog → prod via Action funciona
- [ ] PR `homolog → main` aprovado + merge → prod deploya

---

## Arquivos Principais (Referência Rápida)

| Arquivo | Função |
|---------|--------|
| `src/lib/auth-client.ts` | signIn, signUp, signOut, getSession, onAuthChange, updateUser, resetPasswordEmail |
| `src/lib/auth-server.ts` | supabaseServer, supabaseServerWithServiceRole |
| `src/middleware.ts` | Protege `/room/*` (só logados), redireciona logados longe de `/login` e `/signup` |
| `src/lib/types.ts` | Profile, Room, RoomWithParticipantCount, InviteCreate, InviteResult |
| `src/lib/youtube-player.ts` | Wrapper YouTube IFrame API |
| `src/components/VideoPlayer.tsx` | Player com estados + touch targets |
| `src/components/ChatPanel.tsx` | Chat em tempo real |
| `src/components/QueuePanel.tsx` | Fila de vídeos |
| `src/hooks/useSyncService.ts` | Push estado via `/api/state` |
| `src/hooks/useRealtime.ts` | Subscribe Realtime |
| `src/app/room/[roomId]/page.tsx` | Sala dinâmica com Suspense + force-dynamic |
| `src/app/room/RoomView.tsx` | Lógica da sala (aceita `roomId` prop) |
| `src/app/rooms/page.tsx` | Dashboard do owner |
| `src/app/join/[code]/page.tsx` | Entrada por código de convite |
| `supabase/migrations/001_multi_sala_auth.sql` | Schema v2 completo |
| `supabase/migrations/002_add_invite_code.sql` | Coluna `invite_code` |

---

## Comandos Úteis

```bash
# Dev
npm run dev

# Testes
npm test -- --run

# Typecheck
npm run typecheck

# Build
npm run build

# Git
git checkout homolog
git push origin homolog:refs/heads/homolog

# Deploy DB (quando script existir)
npx tsx scripts/deploy-db.ts homolog|prod
```

---

## Próximos Comandos Sugeridos

```bash
# 1. Aplicar migration 002 corrigida no Supabase homolog
# (execute statements do arquivo supabase/migrations/002_add_invite_code.sql no SQL Editor)

# 2. Testar fluxo completo
npm run dev
# Acesse localhost:3000 → login → criar sala → /join/... → convidado entra → sincronização

# 3. Commit e push
git add -A
git commit -m "fix: migration 002 invite_code generation"
git push origin homolog:refs/heads/homolog
```

---

Fim do documento. O projeto está pronto para Fase 4 → 5 → 7.