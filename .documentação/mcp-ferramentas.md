# Servidor MCP AlfaAltoGrup (/api/mcp)

O servidor implementa o protocolo JSON-RPC 2.0 sobre HTTP POST.
Autenticação: `Authorization: Bearer <API_KEY>`

## Ferramentas Disponíveis

1. `listar_grupos`: Lista os grupos cadastrados com contagem de membros, permissões atuais e IDs.
2. `estado_do_grupo`: Mostra o estado detalhado de um grupo (nome, descrição e as 4 permissões).
3. `listar_agendamentos`: Consulta agendamentos pendentes, enviados ou com erro de um grupo.
4. `agendar_acao`: Agenda uma ação individual (texto, mídia, botão, enquete, permissão ou perfil).
5. `agendamento_em_massa`: Cria múltiplos agendamentos em múltiplos grupos ou por tag de uma única vez.
6. `editar_agendamento`: Altera horário, conteúdo, tipo ou status (pending/deactivated) de um agendamento existente.
7. `cancelar_agendamento`: Desativa um agendamento pendente sem remover o histórico.
8. `trocar_permissao`: Aplica permissões de imediato num grupo (fala, edição de info, aprovação, adição de membros).
9. `editar_grupo`: Altera nome, descrição e/ou foto de um grupo de imediato.
10. `edicao_em_massa`: Edita em lote nome (com variáveis `{n}`, `{nn}`, `{total}`, `{nome}`), descrição e foto com espaçamento anti-spam e suporte a `dryRun`.
11. `desfazer_edicao_em_massa`: Reverte um lote de edição em massa restaurando o estado original a partir do `loteId`.
12. `enviar_arquivo`: Faz upload de imagem, vídeo, áudio ou documento (via base64 ou URL) e devolve a URL pública permanente.
13. `relatorio_diario`: Extrai o relatório consolidado de envios, falhas, cliques e tags, com opção de texto para WhatsApp.
14. `listar_tags`: Lista as tags cadastradas, grupos associados e status de lotação.
