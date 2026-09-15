# Referência da API REST AlfaAltoGrup

Documentação Swagger interativa disponível em `/api-docs`.

## Principais Endpoints

### Autenticação & Chaves
- `POST /api/keys`: Cria uma nova chave de API externa.
- `GET /api/keys`: Lista chaves ativas e seus prefixos.
- `DELETE /api/keys/[id]`: Revoga uma chave de API.

### Grupos & Instâncias
- `GET /api/groups`: Lista todos os grupos com contagem de membros, agendamentos e tags.
- `POST /api/groups`: Cria um grupo na Evolution e registra localmente.
- `GET /api/groups/[id]`: Retorna detalhes completos do grupo e membros.
- `POST /api/groups/[id]/settings`: Altera permissões do grupo (`announcement`, `locked`, etc.).
- `GET /api/instances`: Lista instâncias da Evolution GO configuradas.

### Agendamentos
- `GET /api/schedules?groupId={id}`: Lista agendamentos do grupo.
- `POST /api/schedules`: Cria agendamentos. Suporta:
  - Disparo único em grupo único (`groupId`).
  - Disparo único em múltiplos grupos (`groupIds`).
  - Disparo segmentado por tag (`tagId`, `tagSlug` ou `tag`).
  - Disparo em massa de múltiplos agendamentos em múltiplos grupos (`groupIds`/tags + `schedules: [...]`).
- `PUT /api/schedules/[id]` ou `PATCH /api/schedules/[id]`: Edita conteúdo, data/hora ou status de um agendamento.
- `DELETE /api/schedules/[id]`: Remove ou cancela um agendamento.

### Edição em Massa
- `POST /api/bulk/profile`: Aplica ou simula (`dryRun: true`) edição em lote de perfil em múltiplos grupos (via `groupIds` ou `tagId`/`tagSlug`).
- `GET /api/bulk/profile`: Lista lotes de edição em massa criados.
- `POST /api/bulk/profile/[id]/undo`: Desfaz o lote restaurando o snapshot anterior.

### Documentação & Especificações
- `GET /api/documentacao`: Documentação técnica completa da API em Markdown e JSON (`?format=json`).
- `GET /llm.txt` (e `/llms.txt`): Especificação estruturada do sistema para consumo por LLMs e agentes.
- `GET /documentacao`: Manual e guia interativo acessível publicamente sem autenticação.
- `GET /api-docs`: Swagger UI para exploração interativa.

### Relatórios
- `GET /api/reports/[date]`: Relatório do dia (YYYY-MM-DD). Suporta `?resumo=1` para texto formatado e `?tagId={id}` para filtrar por tag.

### Uploads & Mídia
- `POST /api/upload`: Envio de arquivo via `multipart/form-data`, JSON `{ base64, filename }` ou `{ url }`. Devolve URL pública e mediatype.
- `GET /api/uploads/[filename]`: Serve o arquivo com suporte a `HEAD` e `HTTP 206 Range`.

### Tags & Lotação
- `GET /api/tags`: Lista tags, grupos vinculados e regras de capacidade.
- `POST /api/tags`: Cria uma tag com capacidade e padrão de nome (`{n}`).
- `GET /g/[code]`: Redirecionador público inteligente para o grupo ativo com vagas da tag.
