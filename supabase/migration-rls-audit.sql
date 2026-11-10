-- Auditoria FASE F — revisao RLS
-- Resumo: as policies com USING (true) em SELECT para anon/authenticated
-- expõem leitura de mensagens, participantes e estado para qualquer
-- chamador com a anon key. Para o projeto privado, o recomendado é:
--   (a) Não expor anon key no frontend para PostgREST direct reads,
--       mas o Realtime (postgres_changes) NECESSITA de SELECT policies
--       para receber eventos.
--   (b) Mitigação sem quebrar Realtime: manter SELECT policies mas
--       documentar que a anon key é pública por design e a autorização
--       real está nas Route Handlers (service_role) — leitura pós-login
--       via API, não via PostgREST direct.
--   (c) Alternativa mais forte: desabilitar anon SELECT e migrar
--       Realtime para broadcast com canal privado e token de sala.
--       NÃO é aplicado automaticamente — requer decisão de UX.
--
-- Nenhuma migration destrutiva foi aplicada. Esta migration, se executada,
-- apenas revoga o UPDATE aberto de room_participants (USING true).

-- revogar update aberto: exigir que a sessão pertença à sala (via subquery)
-- Esta migration é propositalmente conservadora: não quebra Realtime.
drop policy if exists room_participants_update_seen on public.room_participants;

-- Sem essa policy, updates via anon são negados — o que é correto:
-- presença é atualizada via Route Handler (service_role).
-- (Nenhum CREATE policy de update é recriado aqui.)

-- Softening: mantém SELECTs (necessários para Realtime).
-- Se desejar endurecer, aplique uma das estratégias (b) ou (c) acima
-- com teste em staging antes.
