# Arquitetura do Sistema AlfaAltoGrup (v0.5.0)

## 1. Stack & Camadas

### 1.1 Backend, Persistência e Processamento Autônomo
- **Next.js 16 (App Router / Standalone)**: Interface web PWA, rotas de API REST, Swagger (`/api-docs`) e servidor MCP (`/api/mcp`).
- **Prisma Singleton + SQLite WAL (`prisma/dev.db` / `prod.db`)**: Banco de dados relacional local configurado com `PRAGMA journal_mode = WAL`, `synchronous = NORMAL`, `busy_timeout = 5000` e `temp_store = MEMORY`, eliminando bloqueios (`SQLITE_BUSY`) entre `web` e `worker`.
- **Módulos Compartilhados (`shared/`)**:
  - `shared/bot-filter.js`: Filtro anti-bot (ignora pré-visualizações do WhatsApp/redes sociais), deduplicação de cliques em memória com TTL, atribuição de grupo via `?grupid=` (código curto determinístico de 4 caracteres Base62) e injeção automática de UTMs.
  - `shared/variables.js`: Motor de interpolação de +38 variáveis dinâmicas em 6 categorias (incluindo `{nome}`, `{primeiro_nome}`, `{nome_membro}` e `{telefone}`) e Spintax (`{opção A|opção B}`) resolvido no momento exato do disparo.
  - `shared/welcome.js`: Motor de automação de Boas-Vindas no Privado (PV) ao entrar no grupo, suportando regras por Tag (com herança automática em transbordos) e por Grupo (precedência sobre Tag), 4 formatos (`text`, `media`, `button`, `poll`), proteção de equipe/admins/instâncias, cooldown por lead e fila anti-ban com espaçamento progressivo.
  - `shared/report.js`, `shared/capacity.js`, `shared/group-tasks.js`: Consolidação de relatórios com churn real (`joinedCount`/`leftCount`), funil `/g/`, transbordo automático de grupos lotados preservando `campaign` e tarefas de grupo.
- **Worker Autônomo (`worker.js`)**: Processo Node.js em background executando a cada 10s:
  - Disparo de mensagens de grupo e fila de boas-vindas no privado (`processWelcomeQueue`) com interpolação de variáveis dinâmicas, spintax, sufixo `?grupid=` em links `/l/`, jitter anti-ban e backoff (2m, 10m, 30m).
  - Alerta em tempo real de falhas no grupo de gestão do WhatsApp.
  - Relatório diário consolidado às 23:59 (fuso SP).
  - Gestão de lotação de tags (a cada 5min) e snapshots de membros diários com cálculo exato de entradas e saídas (`firstSeenAt`).
- **Evolution GO (`evoapicloud/evolution-go:latest`)**: Engine Go de alta performance para conexão com o WhatsApp (eventos `MESSAGE` e `GROUP`), com montagem opcional de binário customizado (`./evogo-server:/app/server:ro`) para suporte nativo a botões interativos WhatsApp (`waE2E`).
- **Postgres 16 Alpine**: Banco exclusivo da Evolution GO (`evogo_auth` e `evogo_users`), garantindo persistência das sessões autenticadas do WhatsApp (`whatsmeow_device`) sem perda de conexão em restarts.
- **Caddy 2 Alpine**: Proxy reverso com emissão automática de SSL (Let's Encrypt), HTTP/2 e limite de corpo de requisição em 64MB.

### 1.2 Frontend & Mobile PWA (v0.5.0)
- **Design System & Tokens**:
  - `shadcn/ui` estilo `new-york`, base `zinc` dark (`--background: 240 10% 3.9%`), com acentos `emerald-500` (WhatsApp, instâncias conectadas, sucesso) e `indigo-500`/`sky-500` (links, campanhas e gráficos).
  - Ícones padronizados via `lucide-react`.
- **Camada de Primitivos UI Zero-Bloat (`src/components/ui/`)**:
  - 24 primitivos enxutos sem dependências pesadas adicionais de runtime.
  - Reutilização direta do `@radix-ui/react-dialog` já instalado para compor `alert-dialog.tsx`.
  - Primitivos construídos em React 19 + Tailwind: `switch.tsx`, `progress.tsx`, `skeleton.tsx`, `scroll-area.tsx`, `separator.tsx`, `tooltip.tsx`, `avatar.tsx`, `alert.tsx`, `toast.tsx` e `toaster.tsx`.
- **Casca Unificada de Navegação (`src/components/AppShell.tsx`)**:
  - Envolve todas as rotas da aplicação (incluindo `/[slug]` com `voltarPara="/"` e `/api-docs`).
  - **Desktop (>= 1024px)**: Sidebar lateral colapsável com alternância de largura (`w-64` expandida vs `w-16` compacta) com persistência de estado, combinada com topbar contextual com indicador de status da instância e ações rápidas.
  - **Mobile (< 1024px) & PWA Standalone**: Topbar com botão voltar ou menu hambúrguer; barra inferior fixa com 5 colunas (`/`, `/tags`, `/relatorios`, `/links`, "Mais") disparando drawer `Sheet` para destinos secundários e instalação PWA.
  - **Suporte a Safe Area Insets**: Aplicação estrita de `env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`, `env(safe-area-inset-left)` e `env(safe-area-inset-right)`.
- **Sistema de Notificações e Modais Ergonômicos**:
  - Eliminação de 100% dos `alert()` e `confirm()` nativos da árvore `src/`, substituídos por Toast global montado em `Providers.tsx` e `AlertDialog` acessível.
  - Contrato padrão para os 14 modais: cabeçalho fixo (`DialogHeader`), corpo com rolagem interna (`max-h-[85dvh]` ou `ScrollArea`) e rodapé fixo (`DialogFooter bg-background/80 backdrop-blur`).
- **Arquitetura PWA e Resiliência Offline**:
  - Service Worker v3 (`public/sw.js`, cache `'alfaaltogrup-v3'`) com estratégia Network-First para navegação HTML, Cache-First para estáticos versionados (`/_next/static`, ícones) e bypass para chamadas dinâmicas (`/api/`, `/l/`, `/g/`).
  - Página offline estática (`public/offline.html`) estilizada com o tema escuro zinc.
  - Componente global `GlobalErrorAlerts.tsx` com alerta flutuante compatível com a barra inferior mobile e popup padronizado de sessão desconectada.

---

## 2. Alocação de Memória e Resiliência na VPS (VM 1 vCPU / 1GB RAM)

- **Total Físico**: 954 MiB de RAM física + 6.0 GiB de Swap ativo (`vm.swappiness=10`).
- **Limites por Container (`deploy/docker-compose.prod.yml`)**:
  - `caddy`: limite de 64MB.
  - `postgres`: limite de 352MB (`shared_buffers=48MB`, `work_mem=1MB`, `max_connections=120`, `idle_in_transaction_session_timeout=5min`, TCP keepalives ativos e healthcheck a cada 60s).
  - `evolution-go`: limite de 640MB (com montagem `./evogo-server:/app/server:ro`).
  - `web`: limite de 256MB (`NODE_OPTIONS="--max-old-space-size=224"`).
  - `worker`: limite de 192MB (`NODE_OPTIONS="--max-old-space-size=128"`), espaçamento de 1.5s entre tarefas de grupo, máx. 2 disparos de boas-vindas por ciclo de 10s e retry automático contra HTTP 429 (`rate-overlimit`).
- **Regra de Build Único**: O processo de build em produção compila exclusivamente o serviço `web` (`docker compose build web`) para evitar que compilações simultâneas de `web` e `worker` saturem a RAM física.
- **Rotinas de Manutenção**:
  - `watchdog-evolution.sh`: cron a cada 5min que expurga conexões ociosas órfãs (>2h) no Postgres preservando o pool ativo e reconecta instâncias desconectadas.
  - `logging`: rotação automática JSON (`max-size=10m`, `max-file=3`) em todos os containers.

---

## 3. Mídia, Uploads e Persistência de Dados

- **Volumes Persistentes (Não Excluir em Deploys)**:
  - `deploy_sqlite_data` (`/app/prisma`): Banco SQLite em modo WAL (`dev.db`, `dev.db-wal`, `dev.db-shm`) contendo grupos, agendamentos, tags, regras de PV, links e estatísticas.
  - `deploy_uploads_data` (`/app/uploads`): Mídias enviadas e avatares de grupos (`group-*.jpg`), com limpeza automática diária de arquivos temporários com mais de 7 dias.
  - `deploy_pg_data` (`/var/lib/postgresql/data`): Banco Postgres com a tabela `whatsmeow_device` onde residem as 2 sessões ativas do WhatsApp.
- **Servidor de Mídia**:
  - `/api/uploads/[filename]`: Suporte a requisições `HEAD` e `HTTP 206 Partial Content (Range)` para streaming eficiente pela Evolution GO.
  - `/api/upload`: Upload de mídias com limite de até 64MB liberado do middleware para evitar buffers duplicados em memória.
