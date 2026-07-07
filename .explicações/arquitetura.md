# Arquitetura e Fluxo do Sistema PWA Evolution GO

## Stack Utilizada
- **Next.js (App Router)**: Framework principal para interface e rotas da API.
- **Prisma (SQLite)**: Banco de dados local para armazenar grupos, usuários e agendamentos.
- **Vanilla CSS / CSS Modules**: Estilização premium e customizada sem Tailwind.
- **Node.js (Worker)**: Script paralelo `worker.js` que roda a cada 10 segundos verificando agendamentos.
- **Docker Compose**: Para deploy simplificado no Coolify.

## Fluxo de Agendamento e Anti-Ban
1. O usuário cria um agendamento na interface com data e hora.
2. A rota `/api/schedules` recebe os dados.
3. O sistema busca no banco se existe outro agendamento `pending` num raio de 1 minuto (`adjustedAt`).
4. Se sim, o sistema calcula um `randomDelay` entre 15s e 60s, e soma ao último horário encontrado para criar o novo `adjustedAt`.
5. O agendamento é salvo no banco com status `pending`.
6. O `worker.js` fica num loop de `setInterval(..., 10000)` buscando agendamentos onde `adjustedAt <= now()` e envia para a Evolution GO.

## Integração Evolution GO
- Endpoints consumidos pelo worker: `/message/sendText/{grupo}` e `/message/sendMedia/{grupo}`.
- O endpoint correto e o token são lidos diretamente do `.env` (`EVOLUTION_API_URL`, `EVOLUTION_API_KEY`).

## Estrutura Visual
- `/login`: Autenticação básica via NextAuth conectada ao Prisma. Usuário root foi feito via Seed.
- `/`: Dashboard de métricas e lista de grupos.
- `/[slug]`: Página específica do grupo. Implementa as 3 colunas (PC) ou Abas Deslizantes (Mobile).
