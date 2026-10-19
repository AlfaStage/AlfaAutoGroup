# Arquitetura do Sistema AlfaAltoGrup

## Stack & Camadas
- **Next.js 16 (App Router / Standalone)**: Interface web PWA, rotas de API REST, Swagger (/api-docs) e servidor MCP (/api/mcp).
- **Prisma + SQLite (`prisma/dev.db`)**: Banco de dados relacional em arquivo local com snapshot e volume persistente `sqlite_data`.
- **Worker Autônomo (`worker.js`)**: Processo Node.js em background executando a cada 10s:
  - Disparo de mensagens e ações de grupo com jitter anti-ban (15-60s) e backoff (2m, 10m, 30m).
  - Alerta em tempo real de falhas no grupo de gestão do WhatsApp.
  - Relatório diário consolidado às 23:59 (fuso SP).
  - Gestão de lotação de tags (a cada 5min) e snapshots de membros diários.
- **Evolution GO (`evoapicloud/evolution-go:latest`)**: Engine Go de alta performance para conexão com o WhatsApp.
- **Postgres 16 Alpine**: Banco exclusivo da Evolution GO (`evogo_auth` e `evogo_users`), garantindo persistência de sessão sem precisar reler QR Code.
- **Caddy 2 Alpine**: Proxy reverso com emissão automática de SSL (Let's Encrypt), HTTP/2 e limite de corpo de requisição em 64MB.

## Alocação de Memória e Resiliência na VPS (VM 1GB RAM)
- `caddy`: limite de 64MB
- `postgres`: limite de 352MB (`shared_buffers=48MB`, `max_connections=120`, `idle_in_transaction_session_timeout=5min`, TCP keepalives ativos e healthcheck a cada 60s)
- `evolution-go`: limite de 640MB
- `web`: limite de 256MB (`NODE_OPTIONS="--max-old-space-size=224"`)
- `worker`: limite de 192MB (`NODE_OPTIONS="--max-old-space-size=128"`), espaçamento de 1.5s entre tarefas de grupo e retry automático contra HTTP 429 (`rate-overlimit`)
- `watchdog-evolution.sh`: cron a cada 5min que expurga conexões ociosas órfãs (>2h) no Postgres preservando o pool ativo e reconecta instâncias desconectadas
- `logging`: rotação automática JSON (`max-size=10m`, `max-file=3`) em todos os containers
- `swapfile`: 6GB em disco com `vm.swappiness=10`

## Mídia e Uploads
- Pasta: `/app/uploads` (volume `uploads_data`), com limpeza diária após 7 dias preservando avatares de grupos (`group-*.jpg`).
- Servidor: `/api/uploads/[filename]` com suporte a `HEAD` e `HTTP 206 Partial Content (Range)` para streaming direto da Evolution.
- Upload: `/api/upload` com limite de 64MB, liberado do edge middleware para evitar duplicação de buffer em memória.
