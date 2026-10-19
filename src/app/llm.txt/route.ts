import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const LLM_SPEC = `# AlfaAltoGrup — System Specification for LLMs & Autonomous Agents

AlfaAltoGrup is a WhatsApp group orchestration platform built with Next.js 15, PostgreSQL (Prisma), Redis (BullMQ worker), and Evolution GO API.

## Core Concepts & Rules

1. **Authentication**:
   - HTTP Bearer token: \`Authorization: Bearer aag_<token>\`
   - Scopes: \`read\` (queries only), \`read,write\` (modifications and execution).
   - Public paths: \`/documentacao\`, \`/api-docs\`, \`/api/documentacao\`, \`/api/docs\`, \`/llm.txt\`, \`/llms.txt\`, \`/l/*\`, \`/g/*\`, \`/api/upload\`.

2. **Anti-Ban Architecture & Execution Rules**:
   - **Messages & Polls**: Multi-group broadcasts receive automatic jitter/spacing of up to ±60 seconds to break synchronicity and prevent Meta anti-spam flagging.
   - **Group Actions** (\`permission\`, \`profile\`): Do NOT use random jitter; instead, they enforce sequential spacing (\`spacingSeconds\`, min: 10s, default: 45s).
   - **Idempotency & Pre-flight Verification**: Before applying permissions or profile changes, the worker queries the current state from WhatsApp via Evolution GO. If the desired state matches current state, the action is marked \`skipped\` to conserve API quota and avoid unnecessary operations.

3. **Tags & Capacity Redirection**:
   - Tags group multiple WhatsApp communities (e.g. "São Paulo", "VIP Lançamento").
   - Each tag defines \`capacity\` (e.g. 1000 members). When a group reaches capacity, \`isFull\` is marked true and the invite link automatically redirects to the next available group with lower occupancy via \`/g/:inviteCode\`.
   - Tracked links (\`/l/:slug\`) record click analytics, timestamps, and IP addresses before routing to destination.

4. **Mass Editing & Template Variables**:
   - When updating group names in bulk, the following placeholders are evaluated per group:
     - \`{n}\`: 1-based sequential index (1, 2, 3...)
     - \`{nn}\`: 2-digit zero-padded index (01, 02, 03...)
     - \`{total}\`: Total count of affected groups
     - \`{nome}\`: Original name of the group prior to update

5. **Schedule Types**:
   - \`text\`: \`{ "text": "Markdown message" }\`
   - \`media\`: \`{ "mediatype": "image"|"video"|"audio"|"document", "media": "URL", "caption": "...", "fileName": "..." }\`
   - \`button\`: \`{ "title": "...", "description": "...", "footer": "...", "buttons": [...] }\`
   - \`poll\`: \`{ "name": "Question", "values": ["Opt A", "Opt B"], "selectableCount": 1 }\`
   - \`permission\`: \`{ "announcement": boolean, "restrict": boolean }\`
   - \`profile\`: \`{ "name": string, "description": string, "picture": string }\`

---

## REST API Endpoints

- \`GET /api/groups\`: List all WhatsApp groups with members, state, and tag associations.
- \`GET /api/groups/:id\`: Group state and configuration.
- \`POST /api/groups/:id/action\`: Immediate execution of group action.
- \`GET /api/schedules?groupId=:id\`: List pending and historical schedules.
- \`POST /api/schedules\`: Create schedules. Accepts:
  - Single: \`{ groupId: string, type: string, content: object, scheduledAt: ISO8601 }\`
  - Multi-group: \`{ groupIds: string[], type: string, content: object, scheduledAt: ISO8601 }\`
  - Tag-targeted: \`{ tagSlug: string, type: string, content: object, scheduledAt: ISO8601 }\`
  - Batch: \`{ groupIds: string[], schedules: [...] }\`
- \`PATCH /api/schedules/:id\`: Update schedule content, time or status (\`pending\`, \`deactivated\`).
- \`DELETE /api/schedules/:id\`: Deactivate schedule.
- \`POST /api/bulk/profile\`: Bulk rename, describe, or set avatar for groups.
  - Parameters: \`{ groupIds?: string[], tagSlug?: string, tagId?: string, nameTemplate?: string, description?: string, picture?: string, spacingSeconds?: number, dryRun?: boolean }\`
- \`POST /api/bulk/profile/:id/undo\`: Rollback a bulk profile edit.
- \`GET /api/tags\`: List tags, member totals, and child groups.
- \`POST /api/upload\`: Upload media file up to 64MB (\`multipart/form-data\`, field \`file\`).
- \`GET /api/uploads/:filename\`: Stream uploaded media with HTTP 206 partial content support.
- \`GET /api/reports/:date\`: Daily metrics report (\`?tagId=:id\` for tag filtering).
- \`GET /api/documentacao\`: Human and machine-readable REST API documentation.
- \`POST /api/mcp\`: Model Context Protocol server.

---

## MCP Server Tools (Model Context Protocol)

Endpoint: \`POST /api/mcp\` (JSON-RPC 2.0 with Bearer auth)

Available Tools:
1. \`listar_grupos\`: List groups with members, instance and permissions.
2. \`estado_do_grupo\`: Group status, announcements and restriction flags.
3. \`listar_agendamentos\`: List pending/sent schedules for a group.
4. \`agendar_acao\`: Create a single schedule for a group.
5. \`editar_agendamento\`: Modify content, time, type or status of a schedule.
6. \`enviar_arquivo\`: Upload media via base64 or URL (returns permanent URL).
7. \`cancelar_agendamento\`: Cancel a pending schedule.
8. \`trocar_permissao\`: Immediately toggle \`announcement\` (open/closed) or \`restrict\`.
9. \`editar_grupo\`: Immediately update name, description or photo.
10. \`edicao_em_massa\`: Bulk update names using \`{n}\` templates, description, or photo across \`groupIds\` or \`tagSlug\`/\`tagId\`.
11. \`desfazer_edicao_em_massa\`: Revert a previous bulk edit by \`loteId\`.
12. \`agendamento_em_massa\`: Create single or array of schedules across multiple \`groupIds\` or targeting a \`tagSlug\`/\`tagId\`.
13. \`relatorio_diario\`: Get daily metrics (sent, pending, failed, polls, clicks, tags).
14. \`listar_tags\`: List all tags, capacities, invite links and member counts.
15. \`obter_documentacao\`: Full documentation and parameter schemas for MCP tools.
`

export async function GET() {
  return new NextResponse(LLM_SPEC, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  })
}
