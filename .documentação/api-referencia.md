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
- `POST /api/schedules`: Cria agendamentos (suporta `campaign`, variáveis dinâmicas e spintax). Suporta:
  - Disparo único em grupo único (`groupId`).
  - Disparo único em múltiplos grupos (`groupIds`).
  - Disparo segmentado por tag (`tagId`, `tagSlug` ou `tag`).
  - Disparo em massa de múltiplos agendamentos em múltiplos grupos (`groupIds`/tags + `schedules: [...]`).
- `PUT /api/schedules/[id]` ou `PATCH /api/schedules/[id]`: Edita conteúdo, data/hora, `campaign` ou status de um agendamento.
- `DELETE /api/schedules/[id]`: Remove ou cancela um agendamento.
- `GET /api/schedules/queue`: Retorna linha do tempo global, métricas por campanha (`campaign`), resumo da fila e catálogo de variáveis dinâmicas.
- `POST /api/schedules/queue`: Controles de emergência em massa (`pause`, `resume` com espaçamento anti-ban, `delay` em minutos) filtrados por `tagId`, `instanceName`, `groupId` ou `campaign`.

### Auditoria de Membros, Proteção de Equipe & Mapa de DDDs
- `GET /api/members/audit`: Detecta leads duplicados em múltiplos grupos (excluindo admins, donos de instância e whitelist da equipe), sinaliza possíveis membros de equipe sem admin (`>= 3` grupos) e gera o Mapa Regional de DDDs/UFs por tag.
- `POST /api/members/audit`: Gerencia a Whitelist da Equipe (`whitelist_add`, `whitelist_remove`) e executa remoção cirúrgica de duplicados dos grupos antigos (`remove_duplicates`) com trava de segurança no backend.

### Links Rastreáveis, Atribuição por Grupo (`?grupid=`) & UTMs
- `GET /api/links`: Lista links curtos com cliques totais, cliques únicos, distribuição por hora (0–23h SP) e desdobramento por grupo (`porGrupo`).
- `POST /api/links`: Cria ou retorna link rastreável `/l/[code]` (código curto de 5 caracteres).
- `GET /l/[code]?grupid={shortId|id|slug|jid}`: Redirecionador com suporte a `grupid` encurtado de **4 caracteres Base62** (ex.: `/l/a3k9p?grupid=2xP9`), filtro anti-bot (ignora pré-visualizações do WhatsApp/redes sociais), deduplicação de clique único (janela de 10 min), atribuição ao grupo/tag de origem e injeção automática de parâmetros UTM (`utm_source=whatsapp`, `utm_medium=grupo`, `utm_campaign`, `utm_content`, `grupid`) na URL de destino.

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
- `GET /api/reports/[date]`: Relatório do dia (YYYY-MM-DD) com churn real (`entradas`/`saidas`), funil de convite `/g/`, cliques únicos/por hora/por grupo e performance de campanhas. Suporta `?resumo=1` e `?tagId={id}`.

### Uploads & Mídia
- `POST /api/upload`: Envio de arquivo via `multipart/form-data`, JSON `{ base64, filename }` ou `{ url }`. Devolve URL pública e mediatype.
- `GET /api/uploads/[filename]`: Serve o arquivo com suporte a `HEAD` e `HTTP 206 Range`.

### Tags, Lotação & Funil
- `GET /api/tags`: Lista tags, grupos vinculados e regras de capacidade.
- `POST /api/tags`: Cria uma tag com capacidade e padrão de nome (`{n}`).
- `GET /g/[code]`: Redirecionador público inteligente para o grupo ativo com vagas da tag, registrando cliques reais (`TagClick`, com filtro anti-bot) para cálculo de taxa de conversão.

