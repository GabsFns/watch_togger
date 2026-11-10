# CORREÇÃO CRÍTICA — YOUTUBE PLAYER NÃO CARREGA NENHUM VÍDEO

## CONTEXTO

O projeto Watch Together já possui:
- Next.js + TypeScript.
- Supabase PostgreSQL.
- Supabase Realtime.
- YouTube IFrame Player API.
- Sistema de sala privada.
- Dois participantes independentes.
- Serviço de sincronização.
- Máquina de estados do player.

Já foram realizadas duas rodadas de implementação e auditoria.

Os testes de build, TypeScript e testes unitários passam.

Entretanto, existe um problema funcional crítico:

**Nenhum vídeo está conseguindo ser reproduzido corretamente.**

O usuário adiciona uma URL do YouTube, o sistema identifica o vídeo, mas o player permanece indefinidamente em "Carregando".

Não apresenta erro, não inicia reprodução e não fornece informações suficientes para identificar a falha.

Vídeo utilizado no teste:

https://www.youtube.com/watch?v=AWb-Y9nXZkE

O problema também precisa ser investigado com outros vídeos públicos.

IMPORTANTE: não quero outra auditoria superficial. Quero diagnóstico baseado em evidências reais de execução do player.

# 1. ISOLAR O PLAYER DO RESTANTE DA APLICAÇÃO

Antes de modificar a sincronização, faça um teste isolado.

Crie temporariamente uma página de diagnóstico, acessível apenas em desenvolvimento:

`/debug/player`

Essa página deverá:

1. Carregar a YouTube IFrame Player API.
2. Criar uma única instância do player.
3. Receber um videoId.
4. Carregar o vídeo.
5. Exibir todos os eventos recebidos.
6. Permitir preparar, reproduzir, pausar e avançar.
7. Exibir erros reais da API.
8. Mostrar o estado atual do player.

Essa página não deve depender de Supabase, Realtime, room_state, chat ou fila de vídeos.

Objetivo: descobrir se o problema está no player ou na integração com o restante da aplicação.

Utilize o vídeo informado e pelo menos outro vídeo público conhecido que permita incorporação.

Não utilize vídeos simulados.

# 2. INVESTIGAR O CICLO DE VIDA DO YT.PLAYER

Analise profundamente:

- src/lib/youtube-player.ts
- src/components/VideoPlayer.tsx

Verifique especialmente o uso de:

- useEffect.
- useRef.
- createdRef.
- destroy().
- onReady.
- onStateChange.
- onError.

ATENÇÃO ESPECIAL AO REACT STRICTMODE:

A implementação anterior criou um createdRef para evitar instâncias duplicadas.

Verifique se essa proteção não está impedindo a criação da segunda instância após o ciclo de limpeza e montagem adicional do StrictMode.

O fluxo precisa garantir:

1. Criar o player.
2. Receber onReady.
3. Manter a instância válida.
4. Permitir carregamento de outros vídeos.
5. Destruir a instância somente quando realmente necessário.
6. Permitir remontagem sem deixar referências mortas.

Não resolva isso simplesmente desativando StrictMode.

Implemente um ciclo de vida seguro e idempotente.

Não mantenha referências a players destruídos.

# 3. VERIFICAR A YOUTUBE IFRAME PLAYER API

Investigue:

- Se o script https://www.youtube.com/iframe_api carrega corretamente.
- Se window.YT está disponível.
- Se window.YT.Player existe.
- Se onYouTubeIframeAPIReady é chamado.
- Se existe conflito com outro script.
- Se a Promise de inicialização resolve corretamente.
- Se a fila de inicialização funciona.
- Se existe carregamento duplicado.
- Se a API está sendo bloqueada pelo navegador.

Verifique também a configuração do iframe:

- enablejsapi.
- origin.
- playsinline.
- autoplay.
- permissões de reprodução.
- parâmetros de incorporação.

Não introduza uma API Key desnecessária.

A YouTube IFrame Player API não exige uma API Key para a reprodução básica.

# 4. DIFERENCIAR CARREGAMENTO DE REPRODUÇÃO

A implementação atual precisa distinguir claramente:

- API carregando.
- Player sendo criado.
- Player pronto.
- Vídeo sendo preparado.
- Vídeo preparado.
- Aguardando interação.
- Reprodução iniciada.
- Buffering.
- Erro.

Utilize os eventos reais da API.

Considere os estados:

- -1: unstarted.
- 0: ended.
- 1: playing.
- 2: paused.
- 3: buffering.
- 5: cued.

Não confunda o estado unstarted com erro.

Não mantenha LOADING_VIDEO indefinidamente.

Se o player não responder, apresente diagnóstico específico.

# 5. INVESTIGAR O VÍDEO INFORMADO

Teste o vídeo:

AWb-Y9nXZkE

Verifique se:

- O ID é válido.
- O vídeo está disponível.
- O vídeo permite incorporação.
- O vídeo possui restrições geográficas ou de reprodução.
- A API retorna algum código de erro.
- O vídeo consegue ser carregado por meio de cueVideoById.
- O vídeo consegue iniciar após interação explícita.

Não assuma que todo vídeo do YouTube permite incorporação.

Entretanto, também não atribua o problema à restrição de incorporação sem comprovação.

Teste outro vídeo público que permita incorporação para estabelecer uma referência.

# 6. DIAGNÓSTICO VISUAL E TÉCNICO

Quero um painel de diagnóstico temporário que mostre:

- API carregada: SIM/NÃO.
- Player criado: SIM/NÃO.
- Player pronto: SIM/NÃO.
- Video ID atual.
- Estado numérico retornado pelo YouTube.
- Estado visual atual.
- Último evento recebido.
- Último erro.
- Tempo desde o início do carregamento.

No console, registre:

[YT] API_LOADING
[YT] API_READY
[YT] PLAYER_CREATING
[YT] PLAYER_READY
[YT] VIDEO_CUED
[YT] PLAY_REQUESTED
[YT] STATE_CHANGED
[YT] PLAYER_ERROR
[YT] PLAYER_DESTROYED

Registre também a duração de cada etapa.

Não registre tokens, senhas ou informações sensíveis.

# 7. INTEGRAÇÃO COM A SALA

Somente depois que o player isolado funcionar, volte à integração com:

- RoomView.tsx.
- VideoPlayer.tsx.
- useSyncService.ts.
- sync.ts.

Verifique se o fluxo funciona nesta ordem:

1. Usuário adiciona o vídeo.
2. Backend valida o ID.
3. Banco recebe o novo videoId.
4. Realtime transmite a alteração.
5. O participante recebe o novo estado.
6. O player carrega o vídeo.
7. O player informa que está pronto.
8. O participante pode iniciar a reprodução manualmente.

Não permita que o estado de sincronização bloqueie a inicialização local do player.

Cada participante deve conseguir preparar seu próprio player independentemente.

A sincronização deve começar a controlar a reprodução somente quando o player local estiver pronto e autorizado a reproduzir.

# 8. VÍDEOS LONGOS

Não implemente download, proxy ou processamento dos vídeos.

O YouTube deve continuar sendo responsável pelo streaming.

Verifique se existe algum limite de duração introduzido acidentalmente pela aplicação.

A posição do vídeo deve continuar sendo armazenada em segundos.

Não arredonde ou trunque posições de vídeos longos.

Não utilize temporizadores que presumam uma duração fixa.

# 9. CRITÉRIOS DE ACEITAÇÃO

Não considere essa correção concluída até conseguir demonstrar:

1. API do YouTube carregada.
2. Player inicializado.
3. Evento onReady recebido.
4. Vídeo válido carregado.
5. Evento de vídeo preparado recebido.
6. Reprodução iniciada após interação manual.
7. Pause funcionando.
8. Seek funcionando.
9. Troca de vídeo funcionando.
10. Erros de incorporação identificados corretamente.
11. Player funcionando em React StrictMode.
12. Player funcionando na aplicação integrada.

Depois valide a comunicação com o segundo participante.

# 10. ENTREGA

Trabalhe em duas etapas:

ETAPA A:
Faça o diagnóstico isolado e apresente as evidências encontradas.

ETAPA B:
Corrija a causa identificada, integre novamente à sala e valide.

Não faça deploy.

Não altere políticas RLS nesta etapa, a menos que encontre evidência de que elas estão impedindo o carregamento do player.

Não reescreva o projeto inteiro.

Não desative StrictMode para mascarar problemas.

Não declare que está corrigido apenas porque npm run build passou.

Ao terminar, informe:

- Causa raiz comprovada.
- Eventos reais recebidos do YouTube.
- Código de erro, se houver.
- Arquivos modificados.
- Resultado do teste isolado.
- Resultado do teste integrado.
- Pendências para teste no iPhone.

**PRIORIDADE MÁXIMA: CONSEGUIR REPRODUZIR UM VÍDEO REAL ANTES DE CONTINUAR QUALQUER OUTRA EVOLUÇÃO DO PROJETO.**