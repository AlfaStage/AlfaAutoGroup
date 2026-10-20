# PRD, Technical Specs & Issues — Automatizador de Boas-Vindas (v0.4.0)

## 1. PRD (Product Requirements Document)
### 1.1 Objetivo
Automatizar o envio de mensagens de boas-vindas no privado (PV) quando um novo membro entra em um grupo do WhatsApp, permitindo configurar ofertas, instruções ou mídias/botões por **Grupo** ou por **Tag**, com controle de ativação/desativação (`enabled`) e suporte completo via **UI, API REST (`/api/welcome`) e Servidor MCP (`/api/mcp`)**.

### 1.2 Requisitos de Negócio & Segurança Operacional
1. **Escopo por Tag ou Grupo (Herança)**:
   - Regras configuradas em uma **Tag** aplicam-se automaticamente a todos os grupos atuais e futuros (transbordo) daquela Tag.
   - Regras configuradas em um **Grupo** têm precedência sobre a regra da Tag.
   - Ativação e desativação instantânea (`enabled: true | false`). Por padrão de segurança, novas regras podem ser salvas desativadas para teste prévio.
2. **Suporte Completo de Conteúdo & Variáveis**:
   - Mesmos 4 tipos do agendador: `text`, `media` (imagem, vídeo, áudio, documento), `button` (botões interativos/CTA com mídia opcional) e `poll` (enquete).
   - Suporte às +35 variáveis dinâmicas existentes, Spintax (`{Olá|Oi}`), links rastreáveis `/l/xxxxx?grupid=xxxx` e novas variáveis do membro: `{nome}`, `{nome_membro}`, `{primeiro_nome}` e `{telefone}`.
3. **Blindagem Anti-Ban e Anti-Spam**:
   - **Delay Humanizado**: Envio agendado entre `delayMinSec` (padrão 45s) e `delayMaxSec` (padrão 150s) após a entrada no grupo.
   - **Cadência Anti-Rajada**: Quando múltiplos membros entram simultaneamente, a fila escalona os horários (`+25s a +45s` entre cada envio pendente) e o `worker.js` processa de forma cadenciada.
   - **Deduplicação (`cooldownDays`)**: Não envia boas-vindas repetidas para o mesmo telefone na mesma Tag/Grupo dentro da janela configurada (padrão 30 dias).
   - **Proteção de Equipe e Instâncias**: Admins globais, donos de grupo, números das próprias instâncias conectadas e números da `team_whitelist_phones` nunca recebem disparo automático.
   - **Instância Remetente Opcional (`senderInstance`)**: Permite usar a instância do próprio grupo ou selecionar outra instância conectada para enviar o PV.
4. **Modo de Teste Seguro (Entre Instâncias / Grupo de Teste)**:
   - Endpoint e botão **"Testar Boas-Vindas"** (`action: "test"`) que dispara imediatamente (ou enfileira) a mensagem da regra apenas para uma instância conectada ou grupo/número de teste, sem ativar nem afetar grupos finais de clientes.

---

## 2. Technical Specs (Arquitetura para VPS 1 vCPU / 1GB RAM)
### 2.1 Banco de Dados (`prisma/schema.prisma`)
- `WelcomeRule`:
  - `id` (UUID PK), `groupId` (`String? @unique`), `tagId` (`String? @unique`), `enabled` (`Boolean @default(false)`), `type` (`String`), `content` (`String` JSON), `delayMinSec` (`Int @default(45)`), `delayMaxSec` (`Int @default(150)`), `cooldownDays` (`Int @default(30)`), `senderInstance` (`String?`), `createdAt`, `updatedAt`.
- `WelcomeDispatch`:
  - `id` (UUID PK), `ruleId` (FK `WelcomeRule`), `groupId` (FK `Group`), `tagId` (`String?`), `phone` (`String`), `displayName` (`String?`), `status` (`pending | processing | sent | skipped | error`), `scheduledAt` (`DateTime`), `sentAt` (`DateTime?`), `attempts` (`Int @default(0)`), `errorMessage` (`String?`), `isTest` (`Boolean @default(false)`), `createdAt` (`DateTime @default(now())`).
  - Índices: `@@index([status, scheduledAt])`, `@@index([phone, tagId])`, `@@index([phone, groupId])`, `@@index([ruleId])`.

### 2.2 Módulo Compartilhado (`shared/welcome.js`)
- `resolveActiveWelcomeRule(prisma, groupId)`: Busca regra do grupo; se existir e `enabled=false`, retorna `null` (override explícito); se existir e `enabled=true`, retorna a regra; se não existir regra no grupo, busca a regra da Tag principal do grupo (`enabled=true`).
- `enqueueWelcomeForJoin(prisma, { groupId, phone, displayName })`: Valida telefone, checa proteção de equipe/admins/instâncias, verifica deduplicação (`cooldownDays`), calcula `scheduledAt` escalonado contra rajadas e insere em `WelcomeDispatch`.
- `processWelcomeQueue(prisma, instanceTokens, evolutionUrl, urlAbsolutaDeMidia)`: Executado no `worker.js` a cada ciclo (máx. 2 envios por ciclo com pausa de 2s entre eles), interpolando variáveis de grupo + `{nome}`/`{primeiro_nome}`/`{telefone}` + Spintax + `?grupid=` curto.
- `triggerTestWelcome(prisma, { ruleId, targetJidOrPhone, targetName })`: Executa disparo de teste seguro entre instâncias ou para um grupo de teste.

### 2.3 Gatilhos de Entrada (`/api/webhook` + `connect` + `sync-groups`)
- `src/app/api/webhook/route.ts`: Captura eventos de entrada em grupo da Evolution GO (`event: "GroupInfo"` com `data.Join`, `event: "group-participants.update"` ou `event: "GroupParticipants"` com `action: "add" | "join"`), registra o novo membro em `GroupMember` e aciona `enqueueWelcomeForJoin`.
- `src/app/api/instances/[name]/connect/route.ts`: Inclui `subscribe: ["MESSAGE", "GROUP"]` para garantir que a Evolution GO envie eventos de grupo ao webhook.

### 2.4 API REST (`/api/welcome`) & MCP (`/api/mcp`)
- `GET /api/welcome`: Lista regras (por grupo e tag), estatísticas de envios e últimos 100 itens da fila `WelcomeDispatch`.
- `POST /api/welcome`: Suporta `action: "upsert"` (cria/edita regra com rastreio opcional de links), `action: "toggle"` (ativa/desativa), `action: "delete"`, `action: "test"` (disparo de teste seguro entre instâncias/grupo de teste) e `action: "queue_control"` (`pause_pending`, `cancel_pending`, `retry_errors`).
- **Tools MCP (`/api/mcp`)**: `welcome_list`, `welcome_upsert`, `welcome_toggle`, `welcome_delete`, `welcome_test`, `welcome_queue_control`.

---

## 3. Issues de Implementação
- **ISSUE-1 (Schema & Engine `shared/welcome.js`)**: Adicionar `WelcomeRule` e `WelcomeDispatch` ao `prisma/schema.prisma`; implementar `shared/welcome.js` e atualizar `shared/variables.js` com `{nome}`, `{nome_membro}`, `{primeiro_nome}` e `{telefone}`.
- **ISSUE-2 (Webhook, Worker, API REST & MCP)**: Atualizar `/api/webhook`, `worker.js`, criar `/api/welcome/route.ts` e adicionar as 6 ferramentas MCP em `/api/mcp/route.ts`.
- **ISSUE-3 (UI Painel de Boas-Vindas & Teste Entre Instâncias)**: Criar `src/components/PainelBoasVindas.tsx` e integrá-lo ao `DashboardClient.tsx`, permitindo criar regras por Tag ou Grupo (Texto, Mídia, Botões, Enquete), ligar/desligar, monitorar a fila e testar envio entre instâncias.
- **ISSUE-4 (Auditoria 3 Pilares, Deploy VPS & Teste Real Entre Instâncias)**: Executar auditoria dos 3 pilares (>9.0/10), deploy na VPS e validar o disparo real entre as instâncias `IceLaser-Franquiadas` e `IceLaser-0800` sem tocar em nenhum grupo final.
