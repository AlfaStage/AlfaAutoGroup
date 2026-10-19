# PRD, Technical Specs & Issues — AlfaAltoGrup v0.3.0 (Métricas, Auditoria & Variáveis)

## 1. PRD (Requisitos de Produto e Negócio)
- **P1. Auditoria de Membros Duplicados & Proteção de Equipe:**
  - Identificar números repetidos em múltiplos grupos (global e dentro da mesma Tag/praça).
  - Excluir automaticamente administradores (`isAdmin`/`isSuperAdmin`), donos de instância (`ownerPhone`) e números cadastrados na **Whitelist de Equipe** (`Setting: teamWhitelistPhones`).
  - Destacar números presentes em $\ge 3$ grupos como *"Possível Equipe"* com botão de 1 clique para adicionar/remover da Whitelist.
  - Permitir remoção cirúrgica de um membro duplicado dos grupos antigos mantendo-o apenas no grupo mais recente/ativo da Tag.
  - Exibir **Mapa Regional de DDDs** (distribuição por DDD global e por Tag) e **KPIs da Base** (Vagas Ocupadas vs. Membros Únicos Reais vs. Equipe/Admins vs. Duplicados).
- **P2. Rastreamento Avançado `/l/[code]?grupid=[id]`, UTMs, Anti-Bot e Funil `/g/[code]`:**
  - `/l/[code]` deve aceitar `?grupid=<id|slug|jid>` (e aliases `groupid`, `g`), vinculando o clique ao grupo de origem (`LinkClick.groupId`), injetando UTMs automáticas (`utm_source=whatsapp`, `utm_medium=grupo`, `utm_campaign=<tag_slug>`, `utm_content=<group_slug>`) na URL de destino.
  - O `worker.js` deve anexar automaticamente `?grupid=<groupId>` em links `/l/[code]` presentes no texto, legenda ou botões no momento do envio.
  - Filtrar bots de pré-visualização (`WhatsApp`, `facebookexternalhit`, `TelegramBot`, `Twitterbot`, `Slackbot`, `Discordbot`, `HEAD`) em `/l/[code]` e `/g/[code]`.
  - Diferenciar Cliques Totais vs. Cliques Únicos (janela de 10 min) e registrar a hora (`0–23` SP) para **Mapa de Calor de Horários**.
  - Registrar cliques no convite inteligente `/g/[code]` (`TagClick`), gerando o **Funil da Tag** (`Cliques no /g/ -> Novos Membros -> Conversão %`).
- **P3. Motor de Variáveis Dinâmicas & Spintax (`shared/variables.js`):**
  - Suportar 25+ variáveis resolvidas no momento do disparo pelo `worker.js` e ações de grupo:
    - Grupo: `{grupo}`, `{nome_grupo}`, `{grupo_base}`, `{n}`, `{nn}`, `{numero_grupo}`, `{descricao_grupo}`, `{topico}`, `{slug_grupo}`, `{link_grupo}`.
    - Lotação/Escassez: `{membros}`, `{capacidade}`, `{vagas}`, `{vagas_restantes}`, `{ocupacao}`, `{percentual_ocupacao}`, `{vagas_status}`.
    - Tag/Praça: `{tag}`, `{cidade}`, `{praca}`, `{tag_slug}`, `{total_grupos_tag}`, `{total_membros_tag}`, `{link_tag}`, `{link_convite}`.
    - Tempo/Contexto (SP): `{saudacao}`, `{saudacao_emoji}`, `{hoje}`, `{data}`, `{data_curta}`, `{amanha}`, `{amanha_curta}`, `{dia_semana}`, `{mes}`, `{hora}`.
    - Campanha/Envio: `{campanha}`, `{instancia}`, `{id_curto}`.
    - Spintax Anti-Ban: `{opção A|opção B|opção C}` (sorteio dinâmico por grupo).
- **P4. Controle de Fila, Campanhas, Churn Real e UX/Performance (1GB RAM):**
  - Unificar `PrismaClient` singleton e ativar `SQLite WAL Mode` (`journal_mode=WAL`, `synchronous=NORMAL`, `busy_timeout=5000`).
  - Calcular `joinedCount` (entradas reais) e `leftCount` (saídas reais) em `GroupDailySnapshot` comparando `Set` de membros na sincronização.
  - Suportar `campaign` (rótulo de campanha) nos agendamentos e criar painel de **Agenda Global & Controle de Emergência da Fila** (Pausar, Retomar ou Adiar `+30m`/`+1h`/`+2h`/`+1d` por Tag, Instância ou Campanha).
  - Exibir barra semafórica de ocupação nos cards de grupos na Home.
  - **Fora de escopo (por decisão do usuário):** Biblioteca de Templates / "Janela Pronta".

## 2. Technical Specs (Arquitetura & Banco de Dados)
- **Schema (`prisma/schema.prisma`):**
  - `GroupMember`: `+ firstSeenAt DateTime @default(now())`, `@@index([phone])`.
  - `GroupDailySnapshot`: `+ joinedCount Int @default(0)`, `+ leftCount Int @default(0)`.
  - `Schedule`: `+ campaign String?`, `@@index([campaign])`, `@@index([status, adjustedAt])`.
  - `LinkClick`: `+ groupId String?`, `+ isUnique Boolean @default(true)`, `+ hour Int?`, `@@index([groupId])`.
  - `TagClick`: `id String @id @default(uuid())`, `tagId String`, `groupId String?`, `source String?`, `isUnique Boolean @default(true)`, `clickedAt DateTime @default(now())`, `@@index([tagId, clickedAt])`.
- **Módulos Compartilhados (`shared/`):**
  - `shared/bot-filter.js`: `isPreviewBot(ua, method)`, `isUniqueClick(key)`, `appendTrackingToLocalLinks(text, groupId, appUrl)`, `enrichDestinationUrlWithUtm(destUrl, group, tag)`.
  - `shared/variables.js`: `resolveVariables(text, context)`, `resolvePayloadVariables(type, content, context)`, `CATALOGO_VARIAVEIS`.
- **Endpoints REST (`src/app/api/`):**
  - `GET/POST /api/members/audit`: Auditoria de duplicados, gestão da `teamWhitelistPhones` (via `Setting`), mapa de DDDs e remoção segura de duplicados em grupos antigos via Evolution GO `/group/participant`.
  - `GET/POST /api/schedules/queue`: Linha do tempo global, métricas consolidadas por `campaign` e ações em lote na fila (`pause`, `resume`, `delay`).

## 3. Issues (Tarefas de Implementação)
- **ISSUE-1 (DB & Performance):** Atualizar `prisma/schema.prisma`, ativar SQLite WAL em `src/lib/prisma.ts` e `worker.js`, e remover `new PrismaClient()` avulsos em `/l/[code]`, `/g/[code]` e `sync-groups`.
- **ISSUE-2 (Shared Engines):** Criar `shared/bot-filter.js` e `shared/variables.js`; integrar em `worker.js`, `/l/[code]`, `/g/[code]`, `sync-groups` (churn real `joinedCount`/`leftCount`) e `shared/report.js`.
- **ISSUE-3 (APIs de Gestão):** Criar `/api/members/audit` e `/api/schedules/queue`; atualizar `/api/links` e `/api/schedules` para suportar `campaign`, `grupid`, cliques por grupo/tag e heatmap horário.
- **ISSUE-4 (Frontend & UX):** Criar `PainelAuditoriaMembros.tsx`, `PainelAgendaCampanhas.tsx` e `InserirVariavel.tsx`; atualizar `DashboardClient.tsx`, `LinksClient.tsx` e `RelatorioClient.tsx`.
