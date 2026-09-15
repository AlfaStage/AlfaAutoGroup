import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const DOCS_MD = `# AlfaAltoGrup — Documentação da API REST

API REST do AlfaAltoGrup para automação, orquestração e agendamentos em grupos de WhatsApp (Evolution GO).

---

## 1. Autenticação

Todas as rotas da API (exceto as de documentação pública, webhooks e upload) exigem autenticação via Header HTTP:

\`\`\`http
Authorization: Bearer aag_sua_chave_aqui
\`\`\`

As chaves são gerenciadas na interface web em \`/chaves\` e possuem escopos \`read\` ou \`read,write\`.

---

## 2. Endpoints Principais

### Grupos

#### \`GET /api/groups\`
Lista todos os grupos sincronizados com contagem de membros, estado e tags associadas.

#### \`GET /api/groups/:id\`
Detalhes de um grupo específico.

#### \`POST /api/groups/:id/action\`
Executa uma ação imediata no grupo (trocar permissões, enviar mensagem de teste).

---

### Agendamentos

#### \`GET /api/schedules?groupId=:id\`
Retorna os agendamentos cadastrados para o grupo especificado.

#### \`POST /api/schedules\`
Cria um ou múltiplos agendamentos. Suporta envio por grupo individual (\`groupId\`), lista de grupos (\`groupIds\`) ou por tag (\`tagId\`, \`tagSlug\` ou \`tag\`).

**Payload de exemplo (único agendamento em massa por tag):**
\`\`\`json
{
  "tagSlug": "promocoes-vip",
  "type": "text",
  "content": {
    "text": "Olá pessoal! Confira as novidades de hoje: https://meusite.com/ofertas"
  },
  "scheduledAt": "2026-09-15T18:00:00.000Z"
}
\`\`\`

**Payload de exemplo (múltiplos agendamentos):**
\`\`\`json
{
  "groupIds": ["id-grupo-1", "id-grupo-2"],
  "schedules": [
    {
      "type": "text",
      "content": { "text": "Bom dia!" },
      "scheduledAt": "2026-09-16T08:00:00.000Z"
    },
    {
      "type": "permission",
      "content": { "announcement": true },
      "scheduledAt": "2026-09-16T22:00:00.000Z"
    }
  ]
}
\`\`\`

**Tipos suportados (\`type\`):**
- \`text\`: \`{ "text": "Mensagem..." }\`
- \`media\`: \`{ "mediatype": "image|video|audio|document", "media": "URL", "caption": "...", "fileName": "..." }\`
- \`button\`: \`{ "title": "...", "description": "...", "footer": "...", "buttons": [{ "type": "reply", "displayText": "Sim", "id": "1" }] }\`
- \`poll\`: \`{ "name": "Pergunta", "values": ["Opção 1", "Opção 2"], "selectableCount": 1 }\`
- \`permission\`: \`{ "announcement": true|false, "restrict": true|false }\`
- \`profile\`: \`{ "name": "Novo Nome", "description": "Nova Descrição", "picture": "URL" }\`

#### \`PATCH /api/schedules/:id\`
Edita um agendamento existente (conteúdo, horário ou status).

#### \`DELETE /api/schedules/:id\`
Cancela um agendamento pendente (altera status para \`deactivated\`).

---

### Edição em Massa de Grupos

#### \`POST /api/bulk/profile\`
Edita nome, descrição e/ou foto de múltiplos grupos em lote com espaçamento seguro.
Suporta variáveis dinâmicas no template de nome:
- \`{n}\`: Posição sequencial do grupo (1, 2, 3...)
- \`{nn}\`: Posição com zero à esquerda (01, 02...)
- \`{total}\`: Quantidade total de grupos no lote
- \`{nome}\`: Nome atual do grupo

**Parâmetros suportados:**
- \`groupIds\`: Array de IDs dos grupos (opcional se enviar tag)
- \`tagId\` ou \`tagSlug\`: Alvo por tag (todos os grupos da tag)
- \`nameTemplate\`: String do template de nome
- \`description\`: Nova descrição
- \`picture\`: URL da nova foto de perfil
- \`spacingSeconds\`: Intervalo em segundos entre cada grupo (mínimo 10s, padrão 45s)
- \`dryRun\`: \`true\` para obter apenas a prévia sem gravar

#### \`POST /api/bulk/profile/:id/undo\`
Desfaz um lote de edição em massa, restaurando nomes e descrições anteriores.

---

### Tags e Lotação

#### \`GET /api/tags\`
Lista todas as tags com grupos vinculados, capacidade máxima de membros e links encurtados de entrada (\`/g/:inviteCode\`).

---

### Upload de Arquivos

#### \`POST /api/upload\`
Envia arquivo de mídia (imagens, vídeos, áudios e documentos) até **64 MB**.
Formato: \`multipart/form-data\` com o campo \`file\`.
Retorna \`{ "filename": "...", "url": "/api/uploads/...", "mimetype": "...", "size": ... }\`.

#### \`GET /api/uploads/:filename\`
Serve o arquivo de mídia estático com suporte a streaming HTTP 206 Range.

---

### Relatórios e Auditoria

#### \`GET /api/reports/:date?tagId=:tagId\`
Gera o relatório diário consolidado (formato YYYY-MM-DD), com cliques de links, disparos, status de grupos e métricas de tags.

---

### Protocolo MCP (Model Context Protocol)

#### \`POST /api/mcp\`
Servidor MCP sobre HTTP compatível com clientes Anthropic/Claude Desktop, OpenAI e Cursor.
Documentação específica disponível chamando a ferramenta \`obter_documentacao\`.
`

export async function GET(request: Request) {
  const url = new URL(request.url)
  const format = url.searchParams.get('format')
  const accept = request.headers.get('accept') || ''

  if (format === 'json' || accept.includes('application/json')) {
    return NextResponse.json({
      title: 'AlfaAltoGrup REST API',
      version: '1.1.0',
      authentication: 'Authorization: Bearer <chave_api>',
      documentation_md_url: '/api/documentacao',
      swagger_url: '/api-docs',
      llm_spec_url: '/llm.txt',
      endpoints: [
        { method: 'GET', path: '/api/groups', description: 'Listar grupos com tags e membros' },
        { method: 'GET', path: '/api/schedules', description: 'Listar agendamentos' },
        { method: 'POST', path: '/api/schedules', description: 'Criar agendamentos (suporta groupIds e tagSlug/tagId)' },
        { method: 'PATCH', path: '/api/schedules/:id', description: 'Editar agendamento' },
        { method: 'DELETE', path: '/api/schedules/:id', description: 'Cancelar agendamento' },
        { method: 'POST', path: '/api/bulk/profile', description: 'Edição de grupos em massa por tag ou lista com template {n}' },
        { method: 'POST', path: '/api/bulk/profile/:id/undo', description: 'Reverter lote de edição' },
        { method: 'GET', path: '/api/tags', description: 'Listar tags e lotação' },
        { method: 'POST', path: '/api/upload', description: 'Upload de arquivos até 64MB' },
        { method: 'GET', path: '/api/reports/:date', description: 'Relatório diário com métricas' },
        { method: 'POST', path: '/api/mcp', description: 'Servidor MCP JSON-RPC 2.0' }
      ]
    })
  }

  return new NextResponse(DOCS_MD, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  })
}
