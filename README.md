# Watch Together — Setup

## 1. Supabase

1. Crie um projeto em https://supabase.com
2. Abra o **SQL Editor** e rode o conteúdo de `supabase/schema.sql`
3. Copie de `Project Settings → API`:
   - `Project URL`
   - `anon public`
   - `service_role`
4. Copie `.env.example` para `.env.local` e preencha as 3 chaves.
5. Defina `ROOM_ACCESS_CODE` com um código só de vocês dois.

### Criar a sala inicial (SQL, após rodar o schema)

```sql
-- gera o hash do código (troque SEU_CODIGO)
select crypt('SEU_CODIGO', gen_salt('bf')) as access_code_hash;

-- insira a sala (cole o hash gerado acima)
insert into rooms (name, access_code_hash)
values ('Sala privada', '<hash-aqui>');

-- estado inicial
insert into room_state (room_id, playback_state)
select id, 'idle' from rooms limit 1;
```

> Alternativa: se `ROOM_ACCESS_CODE` estiver no ambiente, o servidor valida o código em claro (comparação segura). O hash no banco é defesa extra; o servidor ainda usa o env para validar.

## 2. Rodar local

```bash
npm install
npm run dev
```

Abra http://localhost:3000, digite nome + código e entre.

## 3. Deploy (Vercel)

1. Push para GitHub/GitLab.
2. Importe em https://vercel.com
3. Em **Environment Variables**, carregue todas as vars do `.env.local`.
4. Deploy.

## 4. Teste em 2 navegadores

1. Abra a mesma URL em 2 abas/janelas (ou 2 dispositivos).
2. Entre com nomes diferentes.
3. Adicione um vídeo: ele aparece nos dois.
4. Toque play/pause/seek: o outro acompanha.
5. Recarregue a página: o estado permanece.

## 5. Testes

```bash
npm test
npm run typecheck
npm run build
```

## 6. Limitações conhecidas

- **Autoplay bloqueado**: iPhone exige gesto. Por isso existe o botão “Iniciar reprodução”.
- **iOS em segundo plano**: o sistema pode pausar o player; ao voltar, a sincronização corrige via estado compartilhado.
- **Vídeos que bloqueiam incorporação** (101/150) mostram erro claro.
- **Vida de vídeos longos (3–5h)**: ok — a posição é restaurada do estado compartilhado e o drift corrige suavemente.
