# PRD, Technical Specs & Issues — Páginas Dedicadas & Boas-Vindas Multi-Blocos (`v0.5.0`)

## 1. PRD (Product Requirements Document)

### 1.1. Objetivo do Produto
1. **Páginas Dedicadas de Topo (`/agenda`, `/auditoria`, `/boas-vindas`):**
   - Promover as 3 funcionalidades que antes ficavam como sub-abas dentro de `Grupos` (`/`) — **"Agenda & Fila Global"**, **"Auditoria de Membros & DDDs"** e **"Boas-Vindas (PV)"** — para páginas principais independentes na barra lateral/menu do `AppShell`, no mesmo nível de `Grupos`, `Tags`, `Relatórios`, `Links` e `Chaves de API`.
   - Manter a página inicial `/` (`Grupos`) limpa e focada exclusivamente na gestão de instâncias, KPIs rápidos e lista/criação de grupos.
2. **Boas-Vindas no Privado em Múltiplos Blocos Sequenciais (`blocks`):**
   - Permitir que uma Regra de Boas-Vindas configure **1 única mensagem** (como já funciona hoje, 100% retrocompatível) OU **vários blocos de mensagens enviados em sequência** no privado quando um novo membro entra no grupo.
   - Cada bloco possui **seu próprio formato independente** (`text`, `media`, `button`, `poll`) e seu próprio conteúdo (com variáveis dinâmicas, spintax e rastreio individual de links `/l/[code]?grupid=[id]`).

### 1.2. Requisitos Funcionais (RF)
- **RF-01 (Navegação e Páginas Dedicadas):**
  - `/agenda`: Página dedicada para **Agenda & Fila Global** (`PainelAgendaCampanhas`).
  - `/boas-vindas`: Página dedicada para **Boas-Vindas (PV)** (`PainelBoasVindas`).
  - `/auditoria`: Página dedicada para **Auditoria de Membros & DDDs** (`PainelAuditoriaMembros`).
  - `AppShell.tsx`: Incluir links diretos na navegação lateral (Desktop) e gaveta/barra mobile, destacando rota ativa via `pathname`.
  - `DashboardClient.tsx`: Remover as abas internas (`Tabs`) da tela `/`, exibindo diretamente a barra de instâncias, KPIs e gestão de `Meus grupos`.
- **RF-02 (Múltiplos Blocos de Mensagem no Boas-Vindas):**
  - Na criação/edição de regra em `/boas-vindas`, o usuário pode manter apenas **1 bloco** (comportamento padrão atual) ou clicar em **"+ Adicionar Bloco de Mensagem"** para empilhar múltiplos blocos (até 8 blocos por regra para proteção anti-ban).
  - Cada bloco permite escolher seu formato (`Texto`, `Mídia`, `Botões Interativos / CTA`, `Enquete`), preencher os campos correspondentes com `InserirVariavel`, reordenar (subir/descer) e remover blocos extras.
- **RF-03 (Motor de Disparo Sequencial e Rastreio por Bloco):**
  - No salvamento (`POST /api/welcome` `action: 'upsert'` e MCP `configurar_boas_vindas`), cada bloco é validado individualmente (`validateScheduleContent`) e recebe rastreamento automático de links (`aplicarRastreio`) quando `trackLinks: true`.
  - No envio (`shared/welcome.js` — tanto na fila automática `processWelcomeQueue` quanto no disparo de teste `POST /api/welcome` `action: 'test'` e MCP `testar_boas_vindas`), os blocos são resolvidos com o contexto do membro/grupo e enviados na ordem exata configurada, com pausa humanizada de `1.8s` a `2.5s` entre blocos consecutivos.
- **RF-04 (Trava de Segurança em Grupos Finais):**
  - Preservar integralmente a trava que impede ativar regras (`enabled: true`) ou disparar testes em grupos finais de clientes; apenas grupos de teste (`/teste|test/i`) ou envio direto entre instâncias/números de teste são permitidos.

---

## 2. Technical Specifications (Specs)

### 2.1. Arquitetura de Rotas e Navegação (`Next.js App Router`)
- **Novas Rotas Server Components (com `getServerSession()` + `redirect('/login')`):**
  1. `src/app/agenda/page.tsx` + `src/app/agenda/AgendaClient.tsx`:
     - Carrega `tags` do Prisma e instâncias da Evolution API (ou via `/api/instances` no client) e renderiza `<PainelAgendaCampanhas />` dentro de `<AppShell titulo="Agenda & Fila Global" subtitulo="Gerenciamento central de campanhas, fila de disparos e controle em lote" />`.
  2. `src/app/boas-vindas/page.tsx`:
     - Carrega `groups` (`id, name, slug, instanceName`) e `tags` (`id, name, color`) via Prisma no servidor e renderiza `<PainelBoasVindas groups={groups} tags={tags} />` dentro de `<AppShell titulo="Boas-Vindas no Privado (PV)" subtitulo="Automação de mensagens em bloco único ou múltiplos blocos para novos membros" />`.
  3. `src/app/auditoria/page.tsx` + `src/app/auditoria/AuditoriaClient.tsx`:
     - Permite filtrar opcionalmente por Tag e renderiza `<PainelAuditoriaMembros />` dentro de `<AppShell titulo="Auditoria de Membros & DDDs" subtitulo="Detecção de membros duplicados com proteção de equipe e mapa geográfico por DDD/Estado" />`.
- **Reserva de Slugs (`src/app/api/groups/route.ts`):**
  - Garantir que slugs reservados do sistema (`agenda`, `auditoria`, `boas-vindas`, `tags`, `relatorios`, `links`, `chaves`, `login`, `api`, `l`, `g`) não possam colidir com `Group.slug`.
- **Navegação (`src/components/AppShell.tsx`):**
  - Atualizar `DESTINOS` para incluir `/agenda`, `/boas-vindas` e `/auditoria` com ícones `CalendarClock`, `Sparkles` e `ShieldCheck`.
  - Manter exatamente 4 itens `principal: true` na barra inferior mobile (`grid-cols-5`: 4 principais + botão `Mais` que abre o `Sheet` com todas as páginas) para preservar o layout responsivo em telas pequenas.

### 2.2. Modelo de Dados Retrocompatível para Multi-Blocos (Zero Migração SQLite)
- A tabela `WelcomeRule` já armazena `type: String` e `content: String` (JSON).
- **Estrutura de `content` JSON:**
  - Cada bloco é representado por `{ type: 'text' | 'media' | 'button' | 'poll', content: Record<string, any> }`.
  - Quando salvo pelo `/api/welcome` ou MCP:
    - O campo raiz `rule.type` armazena o `type` do **primeiro bloco** (`blocks[0].type`), garantindo compatibilidade total com qualquer consulta legada.
    - O JSON salvo em `rule.content` mantém os campos do primeiro bloco na raiz **E** inclui a propriedade `blocks: Array<{ type: string, content: Record<string, any> }>` (além de `trackLinks: boolean`).
  - **Função Utilitária `extractWelcomeBlocks(ruleOrType, rawContent)` em `shared/welcome.js`:**
    - Se `rawContent && Array.isArray(rawContent.blocks) && rawContent.blocks.length > 0`, retorna a lista normalizada de blocos `rawContent.blocks.map(b => ({ type: b.type || ruleType, content: b.content || b }))`.
    - Caso contrário (regra antiga de 1 mensagem), retorna `[{ type: ruleType, content: rawContent }]`.
    - Limite máximo de segurança: `MAX_WELCOME_BLOCKS = 8`.

### 2.3. Motor de Disparo Sequencial (`shared/welcome.js`)
- Nova função `sendEvolutionWelcomeSequence(evolutionUrl, token, recipient, blocks, ctx, urlAbsolutaDeMidia)`:
  - Itera sobre `blocks` sequencialmente (`for (let idx = 0; idx < blocks.length; idx++)`).
  - Para cada bloco:
    1. Resolve variáveis e spintax com `variaveis.resolverConteudoAgendamento(block.type, block.content, ctx)`.
    2. Chama `sendEvolutionWelcomeMessage(evolutionUrl, token, recipient, block.type, resolvedBlockContent, urlAbsolutaDeMidia)`.
    3. Se um bloco falhar, interrompe ou registra o erro com identificação do bloco (`blockIndex: idx + 1`) e retorna `{ ok: false, status, error, body, results }`.
    4. Se houver próximo bloco (`idx < blocks.length - 1`), aguarda pausa humanizada de `1800ms` (em modo `isTest`) ou `2000ms + random(0..800ms)` (na fila automática) para garantir entrega na ordem exata no WhatsApp Mobile e Web.
  - Retorna `{ ok: true, status: 200, blocksSent: blocks.length, results }`.

---

## 3. Implementation Issues (Actionable Tasks)

### ISSUE-1: Motor Multi-Blocos em `shared/welcome.js`, `/api/welcome` e `/api/mcp`
- **Arquivos:** `shared/welcome.js`, `src/app/api/welcome/route.ts`, `src/app/api/mcp/route.ts`.
- **Critérios de Aceite:**
  1. `extractWelcomeBlocks` e `sendEvolutionWelcomeSequence` exportados em `shared/welcome.js` e utilizados tanto em `processWelcomeQueue` quanto em `/api/welcome` (`action: 'test'`) e `/api/mcp` (`testar_boas_vindas`).
  2. `POST /api/welcome` (`action: 'upsert'`) e MCP (`configurar_boas_vindas`) aceitam `blocks: Array<{ type, content }>` (ou `type` + `content` único), validam cada bloco com `validateScheduleContent`, aplicam `aplicarRastreio` por bloco e persistem `blocks` no JSON de `WelcomeRule.content`.
  3. Validação de limite `1 <= blocks.length <= 8` e manutenção rigorosa da trava de segurança que bloqueia ativação ou teste em grupos finais de clientes.

### ISSUE-2: UI Multi-Blocos em `src/components/PainelBoasVindas.tsx`
- **Arquivos:** `src/components/PainelBoasVindas.tsx`.
- **Critérios de Aceite:**
  1. Suporte a 1 ou múltiplos blocos no construtor de regras: por padrão inicia com 1 bloco (`Bloco #1`), permitindo adicionar novos blocos (`+ Adicionar Bloco de Mensagem`), alterar o formato individual de cada bloco (`text`, `media`, `button`, `poll`), subir/descer a ordem e remover blocos quando houver mais de 1.
  2. Ao clicar em **"Editar"** numa regra existente (seja de 1 bloco legado ou de múltiplos blocos), popula todos os blocos com fidelidade (incluindo botões interativos, mídias e enquetes).
  3. Nos cards de **Regras Configuradas**, exibe badge indicando a quantidade e tipos de blocos quando houver mais de 1 bloco (ex.: `3 BLOCOS: MEDIA → TEXT → BUTTON`) e prévia clara do conteúdo.

### ISSUE-3: Páginas Dedicadas (`/agenda`, `/boas-vindas`, `/auditoria`) e Navegação (`AppShell.tsx` / `DashboardClient.tsx`)
- **Arquivos:** `src/app/agenda/page.tsx`, `src/app/agenda/AgendaClient.tsx`, `src/app/boas-vindas/page.tsx`, `src/app/auditoria/page.tsx`, `src/app/auditoria/AuditoriaClient.tsx`, `src/components/AppShell.tsx`, `src/app/DashboardClient.tsx`, `src/app/api/groups/route.ts`.
- **Critérios de Aceite:**
  1. As 3 novas páginas carregam com autenticação NextAuth no servidor e funcionam de forma independente no menu lateral/mobile do `AppShell`.
  2. `DashboardClient.tsx` fica dedicado à visão de Grupos, Instâncias e KPIs (sem as abas antigas embutidas).
  3. Slugs reservados protegidos contra colisão com slugs de grupos.
