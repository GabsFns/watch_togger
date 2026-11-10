# PROJETO: WATCH TOGETHER — SALA PRIVADA DE VÍDEOS DO YOUTUBE

## 1. CONTEXTO E OBJETIVO

Desenvolva uma aplicação web chamada provisoriamente **Watch Together**.

O objetivo é criar uma plataforma extremamente simples, privada e funcional para duas pessoas assistirem juntas a vídeos do YouTube, mesmo estando em dispositivos e locais diferentes.

O sistema será utilizado por apenas duas pessoas.

Dispositivos que precisam ser suportados:
- iPhone 7 (Safari).
- iPhone XR (Safari).
- Computadores (Chrome, Edge e Firefox).

O principal requisito é permitir que ambos assistam ao mesmo vídeo, aproximadamente na mesma posição da reprodução, com controles sincronizados e um chat em tempo real.

Não estamos construindo uma plataforma pública de Watch Party. Não precisamos de funcionalidades empresariais, múltiplas salas públicas, assinaturas, planos ou recursos desnecessários.

Queremos uma solução pequena, organizada, segura e confiável.

## 2. STACK TECNOLÓGICA

Utilize preferencialmente:

- Next.js com App Router.
- TypeScript.
- Tailwind CSS.
- Supabase PostgreSQL.
- Supabase Realtime.
- YouTube IFrame Player API.
- Vercel para deploy.

Priorize uma implementação simples.

Não introduza bibliotecas ou serviços adicionais sem justificativa técnica.

Antes de implementar, avalie a compatibilidade das dependências com os navegadores Safari do iPhone 7 e iPhone XR.

## 3. FUNCIONALIDADES PRINCIPAIS

### 3.1. Acesso à sala

Criar uma única sala privada para os dois participantes.

Requisitos:
- Acesso por link privado.
- Proteção por código de acesso.
- Apenas dois participantes simultâneos.
- Identificação dos participantes por nome.
- Persistência da identificação durante as sessões.
- Indicador de presença: online ou offline.
- Reconexão automática quando a internet cair e voltar.

Não precisamos de cadastro tradicional com e-mail e senha.

Entretanto, o acesso precisa ter proteção real no backend, não apenas uma validação visual no frontend.

### 3.2. Player do YouTube

Implementar o player utilizando oficialmente a YouTube IFrame Player API.

Funcionalidades:
- Adicionar vídeo através de URL do YouTube.
- Aceitar URLs tradicionais e links curtos (youtu.be).
- Validar e extrair o ID do vídeo.
- Carregar o vídeo para os dois participantes.
- Reproduzir e pausar sincronizadamente.
- Sincronizar posição atual (seek).
- Sincronizar troca de vídeo.
- Sincronizar estado de reprodução.
- Exibir título do vídeo, quando disponível.
- Exibir duração e posição atual.
- Permitir controle de volume individual.
- Permitir tela cheia.
- Exibir estado de carregamento.
- Exibir erros de reprodução e vídeos indisponíveis.

O vídeo deve continuar sendo reproduzido diretamente pelo YouTube.

IMPORTANTE:
Não baixar vídeos, não fazer proxy do conteúdo e não armazenar arquivos de vídeo.

### 3.3. Sistema de sincronização

Esta é a funcionalidade mais importante do projeto.

Implemente uma arquitetura de sincronização baseada no estado compartilhado do player.

O estado da sala deverá contemplar:

- videoId;
- playbackState (playing, paused, buffering);
- currentTime;
- playbackRate;
- updatedAt;
- lastAction;
- actionId;
- updatedBy.

Funcionamento esperado:

1. Quando alguém adicionar um vídeo, o outro participante recebe automaticamente.
2. Quando alguém iniciar a reprodução, o outro recebe o comando.
3. Quando alguém pausar, o outro também pausa.
4. Quando alguém avançar ou retroceder, o outro ajusta sua posição.
5. Quando alguém entrar na sala, deve carregar o vídeo atual e recuperar a posição compartilhada.
6. Quando alguém perder a conexão, o sistema deve permitir reconexão sem perder o estado da sala.

#### Estratégia técnica obrigatória

Não dependa exclusivamente de eventos individuais de play/pause.

Implemente:
- Estado compartilhado persistido no PostgreSQL.
- Eventos em tempo real pelo Supabase Realtime.
- Heartbeat periódico para verificar diferenças entre os players.
- Correção de pequenos desvios de tempo.
- Reconciliação do estado após reconexão.
- Identificação de eventos para evitar loops de sincronização.
- Controle de concorrência para evitar que dois comandos simultâneos sobrescrevam incorretamente o estado.

O servidor/banco deve ser a referência do estado compartilhado.

Evite atualizar o banco a cada segundo. Utilize eventos para ações relevantes e atualizações periódicas controladas.

A sincronização deve ser tolerante a oscilações de internet.

Considere uma pequena tolerância de diferença entre os players para evitar ajustes constantes e incômodos.

### 3.4. Chat em tempo real

Implementar um chat simples dentro da sala.

Funcionalidades:
- Envio de mensagens em tempo real.
- Identificação de quem enviou.
- Horário de envio.
- Histórico de mensagens.
- Rolagem automática para a mensagem mais recente.
- Layout adaptado para celular.
- Diferenciação visual das mensagens de cada participante.

O chat deve funcionar independentemente do player.

Não deve perder mensagens quando alguém atualizar a página.

### 3.5. Lista de vídeos / fila

Implementar uma pequena fila de reprodução.

Funcionalidades:
- Adicionar vídeos.
- Exibir próximos vídeos.
- Remover vídeos da fila.
- Permitir que qualquer participante selecione um vídeo.
- Atualizar a fila para ambos em tempo real.

Não precisamos de playlists complexas.

## 4. EXPERIÊNCIA E INTERFACE

Quero uma interface moderna, minimalista e agradável.

A aplicação deve transmitir a sensação de uma pequena sala privada de entretenimento.

Direção visual:
- Tema escuro.
- Fundo em tons de grafite e preto.
- Superfícies discretas.
- Bordas suaves.
- Cantos arredondados.
- Tipografia moderna.
- Animações leves.
- Ícones consistentes.
- Boa hierarquia visual.

Evitar:
- Excesso de cores.
- Gradientes exagerados.
- Elementos decorativos desnecessários.
- Interface carregada.
- Cards gigantes.
- Componentes que ocupem espaço sem necessidade.

### Layout desktop

Estrutura sugerida:

- Cabeçalho com nome da sala e status dos participantes.
- Player ocupando a maior parte da área principal.
- Chat em uma coluna lateral.
- Fila de vídeos abaixo do player.
- Campo para adicionar novos links.

### Layout mobile

A experiência mobile é prioridade.

No iPhone:
- Player responsivo.
- Chat acessível sem comprometer o vídeo.
- Controles com áreas de toque adequadas.
- Campo de mensagens fácil de utilizar.
- Sem rolagem horizontal.
- Sem elementos cortados.
- Sem dependência de hover.
- Respeitar safe areas do iOS.

Utilize uma organização vertical:
1. Cabeçalho da sala.
2. Player.
3. Informações do vídeo.
4. Controles e fila.
5. Chat.

Pode utilizar abas ou alternância entre vídeo e chat, desde que seja simples e intuitivo.

## 5. COMPATIBILIDADE COM IPHONE

Esse requisito é fundamental.

O iPhone 7 possui limitações de hardware e utiliza uma versão mais antiga do iOS/Safari.

Portanto:
- Evitar dependências pesadas.
- Evitar animações complexas.
- Não utilizar APIs modernas sem verificar compatibilidade.
- Implementar tratamento de autoplay bloqueado.
- Permitir inicialização manual do player.
- Evitar que o player seja destruído ao alternar entre abas da interface.
- Testar comportamento de reconexão.
- Garantir que o teclado virtual não prejudique o chat.
- Respeitar as limitações de reprodução em segundo plano do iOS.

Não assuma que autoplay funcionará.

Cada participante deve conseguir inicializar a reprodução com uma interação explícita.

## 6. MODELAGEM DE DADOS

Proponha uma modelagem pequena e coerente.

Entidades/tabelas sugeridas:

### rooms
- id
- name
- access_code_hash
- created_at

### room_participants
- id
- room_id
- participant_name
- session_token_hash
- last_seen_at
- created_at

### room_state
- id
- room_id
- current_video_id
- playback_state
- current_time
- playback_rate
- updated_at
- updated_by
- action_id

### chat_messages
- id
- room_id
- participant_id
- message
- created_at

### video_queue
- id
- room_id
- video_id
- video_title
- added_by
- position
- created_at

Avalie se todas essas tabelas são realmente necessárias para uma aplicação com apenas uma sala e dois participantes.

Evite abstrações desnecessárias.

Configure corretamente:
- Chaves estrangeiras.
- Índices.
- Restrições.
- Políticas RLS.
- Validação de entrada.
- Proteção dos tokens de sessão.

Nunca exponha a chave service_role do Supabase no frontend.

## 7. SEGURANÇA

Apesar de ser um projeto pessoal, implemente boas práticas.

- Validar acesso à sala no backend.
- Proteger operações de escrita.
- Não permitir entrada de terceiros sem autorização.
- Limitar a quantidade de participantes.
- Validar URLs e IDs do YouTube.
- Sanitizar mensagens do chat.
- Evitar exposição de tokens.
- Configurar corretamente as políticas RLS.
- Proteger contra abuso de envio de mensagens.

Não confie apenas em verificações feitas no React.

## 8. ARQUITETURA E ORGANIZAÇÃO

Utilize uma estrutura organizada e de fácil manutenção.

Separe adequadamente:
- Componentes de interface.
- Hooks.
- Serviços.
- Regras de sincronização.
- Integração com YouTube.
- Integração com Supabase.
- Tipagens.
- Validações.
- Camada de persistência.

Crie um serviço responsável pela sincronização do player.

Não coloque toda a lógica dentro de um único componente React.

Evite:
- Componentes gigantes.
- Regras de negócio dentro da interface.
- Duplicação de código.
- Estados globais desnecessários.
- Abstrações prematuras.

## 9. TRATAMENTO DE FALHAS

A aplicação precisa lidar com:

- Internet desconectada.
- Reconexão.
- Usuário fechando a página.
- Atualização do navegador.
- Player bloqueado pelo Safari.
- Vídeo indisponível.
- Vídeo que não permite incorporação.
- Falha no Supabase Realtime.
- Participantes tentando reproduzir simultaneamente.
- Diferença de tempo entre os players.

Exibir mensagens claras e compreensíveis.

Não deixar a interface travada silenciosamente.

## 10. TESTES E VALIDAÇÃO

Não considere o projeto concluído apenas porque o build passou.

Crie testes para:
- Extração de IDs de URLs do YouTube.
- Validação de URLs.
- Atualização do estado compartilhado.
- Eventos de play/pause.
- Eventos de seek.
- Reconexão.
- Controle de concorrência.
- Envio e recebimento de mensagens.

Também faça uma auditoria funcional da interface.

Verifique:
- Responsividade.
- Layout em telas pequenas.
- Compatibilidade com Safari.
- Funcionamento do chat.
- Sincronização entre dois navegadores.
- Persistência do estado após atualizar a página.

Se não for possível testar fisicamente em iPhones, documente essa limitação e prepare instruções para testes reais.

## 11. CRITÉRIOS DE ACEITAÇÃO

O projeto só será considerado funcional quando:

1. Eu conseguir abrir a sala no computador.
2. Minha namorada conseguir abrir a mesma sala no iPhone.
3. Um de nós conseguir adicionar um vídeo do YouTube.
4. O vídeo aparecer para os dois.
5. Ambos conseguirem iniciar a reprodução após inicializar seus respectivos players.
6. Play e pause funcionarem sincronizados.
7. Avançar e retroceder sincronizarem a posição.
8. A sincronização continuar funcionando em vídeos longos de 3 a 5 horas.
9. O chat funcionar em tempo real.
10. A fila de vídeos funcionar.
11. Atualizar a página não destruir o estado da sala.
12. A experiência mobile funcionar adequadamente.

## 12. FORMA DE EXECUÇÃO

Antes de começar:

1. Analise a arquitetura proposta.
2. Identifique riscos técnicos.
3. Apresente a estrutura de pastas.
4. Explique brevemente como será implementada a sincronização.
5. Identifique limitações da YouTube IFrame API e do Safari.

Depois, implemente por etapas.

Ordem sugerida:

FASE 1 — Estrutura do projeto, configuração e banco de dados.

FASE 2 — Sala privada, acesso e identificação dos participantes.

FASE 3 — Integração com YouTube e reprodução individual.

FASE 4 — Sincronização em tempo real.

FASE 5 — Chat e fila de vídeos.

FASE 6 — Interface responsiva e refinamento visual.

FASE 7 — Testes, auditoria e correção de problemas.

Ao terminar cada fase:
- Informe o que foi implementado.
- Liste os arquivos criados ou modificados.
- Informe decisões técnicas.
- Execute os testes correspondentes.
- Informe pendências reais.

Não simule funcionalidades.
Não deixe botões sem ação.
Não utilize dados estáticos para mascarar funcionalidades que deveriam estar conectadas ao backend.

**PRIORIDADE ABSOLUTA: FUNCIONAMENTO REAL, SINCRONIZAÇÃO CONFIÁVEL E COMPATIBILIDADE MOBILE.**

Prefira uma solução simples que funcione muito bem a uma solução complexa com funcionalidades desnecessárias.