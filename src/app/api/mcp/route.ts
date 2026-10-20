import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  cleanPhoneDigits,
  listarInstanciasEvolution,
  selecionarInstanciaRemetenteConectada,
  sendEvolutionWelcomeMessage
} from '@shared/welcome'
import { montarContextoGrupo, resolverConteudoAgendamento } from '@shared/variables'
import { validarChaveApi, chaveDoHeader } from '@/lib/api-keys'
import { runGroupTask } from '@shared/group-tasks'
import { aplicarRastreio } from '@/lib/tracked-links'
import { writeFile, mkdir } from 'fs/promises'
import { join, extname } from 'path'
import { randomBytes } from 'crypto'
import { persistGroupState } from '@/lib/group-state'
import {
  validateScheduleContent,
  isGroupActionType,
  PERMISSION_ACTIONS,
  SCHEDULE_TYPES
} from '@/lib/schedule-types'
import {
  montarPrevia,
  contentDaLinha,
  validarPedido,
  ESPACO_PADRAO_S,
  ESPACO_MINIMO_S,
  type PedidoEmMassa
} from '@/lib/bulk-edit'
import { montarRelatorio, resumoTexto } from '@shared/report'
import { hojeSP } from '@shared/ops'

// Usa singleton prisma de @/lib/prisma

/**
 * Servidor MCP (Model Context Protocol) sobre HTTP.
 *
 * Fala JSON-RPC 2.0 em POST, com os três métodos que um cliente MCP precisa:
 * `initialize`, `tools/list` e `tools/call`. Autenticação pela mesma chave de
 * API do REST: Authorization: Bearer aag_...
 *
 * Escrito à mão em vez de usar o SDK para não trazer dependência nova — o
 * servidor roda numa VM de 1 GB.
 */

const PROTOCOL_VERSION = '2024-11-05'

type Ferramenta = {
  name: string
  description: string
  inputSchema: Record<string, any>
  handler: (args: any) => Promise<any>
}

// ------------------------------------------------------------------ helpers

async function acharGrupo(args: any) {
  if (args.groupId) {
    const g = await prisma.group.findUnique({ where: { id: args.groupId } })
    if (g) return g
  }
  if (args.slug) {
    const g = await prisma.group.findUnique({ where: { slug: args.slug } })
    if (g) return g
  }
  if (args.nome) {
    const g = await prisma.group.findFirst({
      where: { name: { contains: args.nome } }
    })
    if (g) return g
  }
  return null
}

function texto(valor: any) {
  return {
    content: [{
      type: 'text',
      text: typeof valor === 'string' ? valor : JSON.stringify(valor, null, 2)
    }]
  }
}


// --------------------------------------------------------------- arquivos

const EXT_POR_TIPO: Record<string, string[]> = {
  image: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
  video: ['.mp4', '.3gp', '.mov', '.mkv', '.webm'],
  audio: ['.mp3', '.ogg', '.opus', '.m4a', '.aac', '.wav'],
  document: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.zip']
}
const EXTENSOES_OK = new Set<string>(Object.values(EXT_POR_TIPO).flat())
const LIMITE_BYTES = 64 * 1024 * 1024

function tipoDeMidia(ext: string) {
  for (const [tipo, lista] of Object.entries(EXT_POR_TIPO)) {
    if (lista.includes(ext)) return tipo
  }
  return 'document'
}

/** Mesma logica de /api/upload, para o MCP nao depender de uma chamada HTTP. */
async function salvarArquivo(args: { filename?: string; base64?: string; url?: string }) {
  let buffer: Buffer | null = null
  let nomeOrigem = args.filename || ''

  if (args.base64) {
    const ehDataUri = args.base64.startsWith('data:') && args.base64.includes(',')
    const cru = ehDataUri ? args.base64.slice(args.base64.indexOf(',') + 1) : args.base64
    buffer = Buffer.from(cru, 'base64')
  } else if (args.url) {
    try {
      const r = await fetch(args.url, { redirect: 'follow' })
      if (!r.ok) return { erro: `a URL respondeu ${r.status}` }
      buffer = Buffer.from(await r.arrayBuffer())
      if (!nomeOrigem) {
        try { nomeOrigem = new URL(args.url).pathname } catch { /* url estranha */ }
      }
    } catch {
      return { erro: 'nao consegui baixar a URL' }
    }
  } else {
    return { erro: 'informe base64 (com filename) ou url' }
  }

  if (!buffer || buffer.length === 0) return { erro: 'arquivo vazio' }
  if (buffer.length > LIMITE_BYTES) return { erro: 'arquivo maior que 64 MB' }

  const limpo = String(nomeOrigem || 'arquivo')
    .split(/[\\/]/).pop()!
    .replace(/[^a-zA-Z0-9.\-_]/g, '_')
    .slice(-80)

  const ext = extname(limpo).toLowerCase()
  if (!EXTENSOES_OK.has(ext)) {
    return { erro: `extensao nao aceita: "${ext || 'nenhuma'}" — informe filename com a extensao certa` }
  }

  const base = (limpo.replace(/\.[^.]*$/, '') || 'arquivo').slice(0, 60)
  const nome = `${Date.now()}-${randomBytes(3).toString('hex')}-${base}${ext}`

  const dir = join(process.cwd(), 'uploads')
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, nome), buffer)

  const raiz = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '')
  const caminho = `/api/uploads/${nome}`

  // A URL publica e permanente e o que a Evolution baixa — sem chave, sem sessao.
  return { path: caminho, url: raiz ? raiz + caminho : caminho, mediatype: tipoDeMidia(ext), bytes: buffer.length }
}

// --------------------------------------------------------------- ferramentas

const FERRAMENTAS: Ferramenta[] = [
  {
    name: 'listar_grupos',
    description: 'Lista os grupos de WhatsApp cadastrados, com id, nome, quantidade de membros e permissões atuais.',
    inputSchema: {
      type: 'object',
      properties: {
        busca: { type: 'string', description: 'Filtra pelo nome do grupo' }
      }
    },
    handler: async (args) => {
      const grupos = await prisma.group.findMany({
        where: args.busca ? { name: { contains: args.busca } } : undefined,
        select: {
          id: true, slug: true, name: true, participantCount: true,
          instanceName: true, isAnnounce: true, isLocked: true,
          isApprovalRequired: true, adminOnlyAdd: true, topic: true
        },
        orderBy: { name: 'asc' },
        take: 100
      })
      return texto(grupos)
    }
  },

  {
    name: 'estado_do_grupo',
    description: 'Mostra o estado atual de um grupo: nome, descrição e as quatro permissões.',
    inputSchema: {
      type: 'object',
      properties: {
        groupId: { type: 'string' },
        slug: { type: 'string' },
        nome: { type: 'string', description: 'Parte do nome do grupo' }
      }
    },
    handler: async (args) => {
      const grupo = await acharGrupo(args)
      if (!grupo) return texto('Grupo não encontrado.')
      return texto({
        id: grupo.id,
        nome: grupo.name,
        descricao: grupo.topic || '',
        membros: grupo.participantCount,
        permissoes: {
          somenteAdminsFalam: grupo.isAnnounce,
          somenteAdminsEditam: grupo.isLocked,
          somenteAdminsAdicionam: grupo.adminOnlyAdd,
          aprovacaoParaEntrar: grupo.isApprovalRequired
        }
      })
    }
  },

  {
    name: 'listar_agendamentos',
    description: 'Lista os agendamentos de um grupo, com tipo, horário e status.',
    inputSchema: {
      type: 'object',
      properties: {
        groupId: { type: 'string' },
        slug: { type: 'string' },
        nome: { type: 'string' },
        status: { type: 'string', description: 'pending, sent, skipped, error ou deactivated' }
      }
    },
    handler: async (args) => {
      const grupo = await acharGrupo(args)
      if (!grupo) return texto('Grupo não encontrado.')

      const lista = await prisma.schedule.findMany({
        where: { groupId: grupo.id, ...(args.status ? { status: args.status } : {}) },
        orderBy: { adjustedAt: 'asc' },
        take: 100
      })

      return texto(lista.map(s => ({
        id: s.id,
        tipo: s.type,
        conteudo: (() => { try { return JSON.parse(s.content) } catch { return s.content } })(),
        agendadoPara: s.scheduledAt,
        executaEm: s.adjustedAt,
        status: s.status,
        motivoPulo: s.skipReason,
        erro: s.errorMessage
      })))
    }
  },

  {
    name: 'agendar_acao',
    description:
      'Agenda uma ação num grupo. Tipos: text, media, button, poll (mensagens) '
      + 'e permission, profile (mudanças no grupo). O formato de content é o '
      + 'mesmo documentado no painel.',
    inputSchema: {
      type: 'object',
      required: ['tipo', 'content', 'quando'],
      properties: {
        groupId: { type: 'string' },
        slug: { type: 'string' },
        nome: { type: 'string' },
        tipo: { type: 'string', enum: [...SCHEDULE_TYPES] },
        content: { type: 'object', description: 'Dados da ação; o formato depende do tipo' },
        quando: { type: 'string', description: 'Data e hora em ISO 8601' }
      }
    },
    handler: async (args) => {
      const grupo = await acharGrupo(args)
      if (!grupo) return texto('Grupo não encontrado.')

      const problema = validateScheduleContent(args.tipo, args.content)
      if (problema) return texto(`Pedido inválido: ${problema}`)

      const quando = new Date(args.quando)
      if (isNaN(quando.getTime())) return texto('Data inválida. Use ISO 8601.')

      const criado = await prisma.schedule.create({
        data: {
          groupId: grupo.id,
          type: args.tipo,
          content: JSON.stringify(args.content),
          scheduledAt: quando,
          // ações de grupo não sofrem o ajuste anti-ban
          adjustedAt: quando,
          status: 'pending'
        }
      })

      return texto({
        agendado: true,
        id: criado.id,
        grupo: grupo.name,
        tipo: criado.type,
        executaEm: criado.adjustedAt,
        observacao: isGroupActionType(args.tipo)
          ? 'Mudanças de grupo executam no horário exato.'
          : 'Mensagens podem sofrer ajuste anti-ban de 15 a 60 segundos.'
      })
    }
  },

  {
    name: 'editar_agendamento',
    description:
      'Edita um agendamento que ainda nao foi executado: conteudo, horario, '
      + 'tipo ou status. Prefira editar a cancelar — o historico do disparo '
      + 'e mantido. Passe status "pending" para reativar um agendamento '
      + 'desativado ou com erro.',
    inputSchema: {
      type: 'object',
      required: ['agendamentoId'],
      properties: {
        agendamentoId: { type: 'string' },
        tipo: { type: 'string', enum: [...SCHEDULE_TYPES], description: 'Só se quiser mudar o tipo' },
        content: { type: 'object', description: 'Novo conteúdo, no mesmo formato da criação' },
        quando: { type: 'string', description: 'Nova data e hora em ISO 8601' },
        status: {
          type: 'string',
          enum: ['pending', 'deactivated'],
          description: 'pending reativa; deactivated desliga sem apagar'
        }
      }
    },
    handler: async (args) => {
      const id = args.agendamentoId || args.id || args.scheduleId
      if (!id) return texto('Informe o agendamentoId.')
      const s = await prisma.schedule.findUnique({
        where: { id },
        include: { group: { select: { name: true } } }
      })
      if (!s) return texto('Agendamento não encontrado.')

      if (s.status === 'sent') {
        return texto('Este agendamento já foi enviado — não dá para editar o que já saiu.')
      }

      const tipoFinal = args.tipo || s.type
      const dados: any = {}

      if (args.content !== undefined) {
        const problema = validateScheduleContent(tipoFinal, args.content)
        if (problema) return texto(`Pedido inválido: ${problema}`)

        const base = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '')
        const rastreado = await aplicarRastreio(tipoFinal, args.content, base, s.groupId)
        dados.content = JSON.stringify(rastreado.content)

        if (rastreado.links.length) {
          await prisma.trackedLink.updateMany({
            where: { id: { in: rastreado.links.map((l: any) => l.id) } },
            data: { scheduleId: s.id }
          })
        }
      }

      if (args.tipo) dados.type = args.tipo

      if (args.status) {
        dados.status = args.status
        if (args.status === 'pending') {
          dados.errorMessage = null
          dados.attempts = 0
        }
      }

      if (args.quando) {
        const q = new Date(args.quando)
        if (isNaN(q.getTime())) return texto('Data inválida. Use ISO 8601.')
        dados.scheduledAt = q
        // Ações de grupo executam no horário exato; mensagens podem ser
        // ajustadas pelo anti-ban na hora de rodar.
        dados.adjustedAt = q
      }

      if (Object.keys(dados).length === 0) {
        return texto('Informe ao menos um campo para alterar: content, quando, tipo ou status.')
      }

      const atualizado = await prisma.schedule.update({ where: { id: s.id }, data: dados })

      return texto({
        editado: true,
        id: atualizado.id,
        grupo: s.group?.name,
        tipo: atualizado.type,
        executaEm: atualizado.adjustedAt,
        status: atualizado.status
      })
    }
  },

  {
    name: 'enviar_arquivo',
    description:
      'Sobe uma imagem, video, audio ou documento para o painel e devolve o '
      + 'caminho a usar em content.media (mensagem de midia) ou '
      + 'content.picture (foto de grupo). Aceita base64 ou uma URL publica.',
    inputSchema: {
      type: 'object',
      properties: {
        filename: { type: 'string', description: 'Nome com extensão, ex.: promo.mp4' },
        base64: { type: 'string', description: 'Conteúdo em base64 (aceita data URI)' },
        url: { type: 'string', description: 'URL pública para o servidor baixar' }
      }
    },
    handler: async (args) => {
      const r = await salvarArquivo(args)
      if (r.erro) return texto(`Não consegui salvar: ${r.erro}`)
      return texto({
        salvo: true,
        url: r.url,
        path: r.path,
        mediatype: r.mediatype,
        bytes: r.bytes,
        comoUsar: `Use "${r.url}" em content.media (com mediatype "${r.mediatype}") ou em content.picture. `
          + 'A URL e publica e permanente: a Evolution baixa direto dela.'
      })
    }
  },

  {
    name: 'cancelar_agendamento',
    description:
      'Desativa um agendamento que ainda nao foi executado. Prefira '
      + 'editar_agendamento quando a intencao for corrigir algo — desativar '
      + 'so faz sentido para cancelar de vez.',
    inputSchema: {
      type: 'object',
      required: ['agendamentoId'],
      properties: { agendamentoId: { type: 'string' } }
    },
    handler: async (args) => {
      const id = args.agendamentoId || args.id || args.scheduleId
      if (!id) return texto('Informe o agendamentoId.')
      const s = await prisma.schedule.findUnique({ where: { id } })
      if (!s) return texto('Agendamento não encontrado.')
      if (s.status !== 'pending') {
        return texto(`Não dá para cancelar: o agendamento está como "${s.status}".`)
      }
      await prisma.schedule.update({
        where: { id },
        data: { status: 'deactivated' }
      })
      return texto({ cancelado: true, id })
    }
  },

  {
    name: 'trocar_permissao',
    description:
      'Muda permissões de um grupo agora. O estado atual é conferido antes: '
      + 'o que já estiver como pedido não é reaplicado.',
    inputSchema: {
      type: 'object',
      required: ['acoes'],
      properties: {
        groupId: { type: 'string' },
        slug: { type: 'string' },
        nome: { type: 'string' },
        acoes: {
          type: 'array',
          items: { type: 'string', enum: [...PERMISSION_ACTIONS] },
          description: 'Uma ou mais permissões a aplicar'
        }
      }
    },
    handler: async (args) => {
      const grupo = await acharGrupo(args)
      if (!grupo) return texto('Grupo não encontrado.')

      const problema = validateScheduleContent('permission', { actions: args.acoes })
      if (problema) return texto(`Pedido inválido: ${problema}`)

      const r = await runGroupTask({
        group: grupo,
        kind: 'permission',
        payload: { actions: args.acoes }
      })

      if (r.groupData) await persistGroupState(grupo.id, r.groupData)

      return texto({
        status: r.status,
        mensagem: r.message,
        aplicadas: r.applied || [],
        jaEstavam: r.alreadyOk || []
      })
    }
  },

  {
    name: 'editar_grupo',
    description:
      'Muda nome, descrição e/ou foto de um grupo agora. Só os campos '
      + 'informados são alterados.',
    inputSchema: {
      type: 'object',
      properties: {
        groupId: { type: 'string' },
        slug: { type: 'string' },
        nome: { type: 'string', description: 'Parte do nome atual, para localizar o grupo' },
        novoNome: { type: 'string' },
        descricao: { type: 'string' },
        foto: { type: 'string', description: 'URL pública da imagem' }
      }
    },
    handler: async (args) => {
      const grupo = await acharGrupo(args)
      if (!grupo) return texto('Grupo não encontrado.')

      const content: Record<string, string> = {}
      if (typeof args.novoNome === 'string' && args.novoNome.trim()) content.name = args.novoNome.trim()
      if (typeof args.descricao === 'string') content.description = args.descricao
      if (typeof args.foto === 'string' && args.foto.trim()) content.picture = args.foto.trim()

      const problema = validateScheduleContent('profile', content)
      if (problema) return texto(`Pedido inválido: ${problema}`)

      const r = await runGroupTask({ group: grupo, kind: 'profile', payload: content })
      if (r.groupData) await persistGroupState(grupo.id, r.groupData)

      return texto({
        status: r.status,
        mensagem: r.message,
        aplicadas: r.applied || [],
        jaEstavam: r.alreadyOk || []
      })
    }
  },

  {
    name: 'edicao_em_massa',
    description:
      'Edita nome (usando template com {n}, {nn}, {total}, {nome}), descrição e/ou foto '
      + 'de múltiplos grupos em lote com espaçamento. Permite passar groupIds ou tagSlug/tagId. '
      + 'Suporta dryRun para conferir a prévia antes de aplicar.',
    inputSchema: {
      type: 'object',
      properties: {
        groupIds: { type: 'array', items: { type: 'string' }, description: 'IDs dos grupos' },
        tagSlug: { type: 'string', description: 'Slug da tag (aplica a todos os grupos com esta tag)' },
        tagId: { type: 'string', description: 'ID da tag (aplica a todos os grupos com esta tag)' },
        nameTemplate: { type: 'string', description: 'Template de nome com variáveis {n}, {nn}, {total}, {nome}. Ex: "Grupo {n} - VIP"' },
        description: { type: 'string', description: 'Nova descrição para os grupos' },
        picture: { type: 'string', description: 'URL pública da nova foto de perfil' },
        spacingSeconds: { type: 'number', description: 'Intervalo em segundos entre cada grupo (mínimo 15s)' },
        dryRun: { type: 'boolean', description: 'Se true, devolve apenas a prévia do que mudaria' }
      }
    },
    handler: async (args) => {
      let ids: string[] = Array.isArray(args.groupIds) ? [...args.groupIds] : []
      if (args.tagSlug || args.tagId) {
        const tag = await prisma.tag.findFirst({
          where: args.tagId ? { id: args.tagId } : { slug: args.tagSlug },
          include: { groups: true }
        })
        if (tag) {
          const idsDaTag = tag.groups.map(g => g.groupId)
          ids = Array.from(new Set([...ids, ...idsDaTag]))
        }
      }

      if (ids.length === 0) return texto('Nenhum grupo informado. Forneça groupIds ou tagSlug/tagId.')

      const grupos = await prisma.group.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, topic: true },
        orderBy: { name: 'asc' }
      })
      if (grupos.length === 0) return texto('Nenhum dos grupos informados foi encontrado.')

      const pedido: PedidoEmMassa = {
        nameTemplate: args.nameTemplate,
        description: args.description,
        picture: args.picture,
        spacingSeconds: args.spacingSeconds
      }

      const problema = validarPedido(pedido, grupos.length)
      if (problema) return texto(`Pedido inválido: ${problema}`)

      const previa = montarPrevia(grupos, pedido)
      const efetivas = previa.filter(l => l.mudaNome || l.mudaDescricao || l.mudaFoto)

      if (args.dryRun) {
        return texto({
          modo: 'dryRun (previa)',
          totalSelecionados: grupos.length,
          totalComMudanca: efetivas.length,
          previa
        })
      }

      if (efetivas.length === 0) {
        return texto('Nenhum grupo mudaria com esse pedido.')
      }

      const lote = await prisma.bulkEdit.create({
        data: {
          payload: JSON.stringify(pedido),
          snapshot: JSON.stringify(
            grupos.map(g => ({ groupId: g.id, name: g.name, topic: g.topic || '' }))
          ),
          total: efetivas.length
        }
      })

      for (const linha of efetivas) {
        const quando = new Date(linha.quando)
        await prisma.schedule.create({
          data: {
            groupId: linha.groupId,
            type: 'profile',
            content: JSON.stringify(contentDaLinha(linha, pedido)),
            scheduledAt: quando,
            adjustedAt: quando,
            status: 'pending'
          }
        })
      }

      return texto({
        loteCriado: true,
        loteId: lote.id,
        totalAgendados: efetivas.length,
        primeiro: efetivas[0].quando,
        ultimo: efetivas[efetivas.length - 1].quando,
        comoDesfazer: `Use a ferramenta desfazer_edicao_em_massa com loteId "${lote.id}" para reverter.`
      })
    }
  },

  {
    name: 'desfazer_edicao_em_massa',
    description:
      'Desfaz um lote de edição em massa criado anteriormente, reagendando os nomes e descrições anteriores.',
    inputSchema: {
      type: 'object',
      required: ['loteId'],
      properties: {
        loteId: { type: 'string', description: 'ID do lote retornado por edicao_em_massa' }
      }
    },
    handler: async (args) => {
      const lote = await prisma.bulkEdit.findUnique({ where: { id: args.loteId } })
      if (!lote) return texto('Lote não encontrado.')
      if (lote.undoneAt) return texto('Este lote já foi desfeito anteriormente.')

      const snapshot: { groupId: string; name: string; topic: string }[] = JSON.parse(lote.snapshot)
      let pedido: any = {}
      try { pedido = JSON.parse(lote.payload) } catch {}

      const espaco = Math.max(ESPACO_MINIMO_S, Number(pedido?.spacingSeconds) || ESPACO_PADRAO_S)
      const idsDoLote = snapshot.map(s => s.groupId)

      const cancelados = await prisma.schedule.updateMany({
        where: {
          groupId: { in: idsDoLote },
          type: 'profile',
          status: 'pending',
          createdAt: { gte: lote.createdAt }
        },
        data: { status: 'deactivated' }
      })

      const mudouNome = Boolean(pedido?.nameTemplate)
      const mudouDescricao = typeof pedido?.description === 'string'
      const inicio = Date.now() + 20_000
      let criados = 0

      for (const item of snapshot) {
        const content: Record<string, string> = {}
        if (mudouNome) content.name = item.name
        if (mudouDescricao) content.description = item.topic || ''
        if (Object.keys(content).length === 0) continue

        const quando = new Date(inicio + criados * espaco * 1000)
        await prisma.schedule.create({
          data: {
            groupId: item.groupId,
            type: 'profile',
            content: JSON.stringify(content),
            scheduledAt: quando,
            adjustedAt: quando,
            status: 'pending'
          }
        })
        criados++
      }

      await prisma.bulkEdit.update({
        where: { id: lote.id },
        data: { undoneAt: new Date() }
      })

      return texto({
        desfeito: true,
        loteId: lote.id,
        reagendados: criados,
        canceladosDoLote: cancelados.count,
        observacao: 'Nomes e descrições originais reagendados. Fotos não são guardadas no snapshot.'
      })
    }
  },

  {
    name: 'agendamento_em_massa',
    description:
      'Cria agendamentos simultâneos em múltiplos grupos (passando lista de groupIds ou tagSlug/tagId). '
      + 'Suporta tanto um agendamento único (tipo, content, quando) quanto um array de múltiplos agendamentos (schedules).',
    inputSchema: {
      type: 'object',
      properties: {
        groupIds: { type: 'array', items: { type: 'string' }, description: 'IDs dos grupos' },
        tagSlug: { type: 'string', description: 'Slug da tag (aplica a todos os grupos com esta tag)' },
        tagId: { type: 'string', description: 'ID da tag (aplica a todos os grupos com esta tag)' },
        tipo: { type: 'string', enum: [...SCHEDULE_TYPES], description: 'Tipo da ação se for agendamento único' },
        content: { type: 'object', description: 'Conteúdo da ação se for agendamento único' },
        quando: { type: 'string', description: 'Data/hora em ISO 8601 se for agendamento único' },
        schedules: {
          type: 'array',
          items: {
            type: 'object',
            required: ['tipo', 'content', 'quando'],
            properties: {
              tipo: { type: 'string', enum: [...SCHEDULE_TYPES] },
              content: { type: 'object' },
              quando: { type: 'string' }
            }
          },
          description: 'Lista de múltiplos agendamentos para criar em cada grupo'
        }
      }
    },
    handler: async (args) => {
      let ids: string[] = Array.isArray(args.groupIds) ? [...args.groupIds] : []

      if (args.tagSlug || args.tagId) {
        const tag = await prisma.tag.findFirst({
          where: args.tagId ? { id: args.tagId } : { slug: args.tagSlug },
          include: { groups: true }
        })
        if (tag) {
          const idsDaTag = tag.groups.map(g => g.groupId)
          ids = Array.from(new Set([...ids, ...idsDaTag]))
        }
      }

      if (ids.length === 0) {
        return texto('Nenhum grupo informado. Forneça groupIds ou tagSlug/tagId.')
      }

      const listaTarefas: Array<{ tipo: string; content: any; quando: string }> = []
      if (Array.isArray(args.schedules) && args.schedules.length > 0) {
        for (const s of args.schedules) {
          listaTarefas.push({ tipo: s.tipo, content: s.content, quando: s.quando })
        }
      } else if (args.tipo && args.content && args.quando) {
        listaTarefas.push({ tipo: args.tipo, content: args.content, quando: args.quando })
      } else {
        return texto('Informe os dados do agendamento (tipo, content, quando) ou a lista schedules.')
      }

      for (const t of listaTarefas) {
        const prob = validateScheduleContent(t.tipo, t.content)
        if (prob) return texto(`Pedido inválido (${t.tipo}): ${prob}`)
        const d = new Date(t.quando)
        if (isNaN(d.getTime())) return texto(`Data inválida (${t.quando}). Use ISO 8601.`)
      }

      const base = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '')
      let criadosTotal = 0

      for (const t of listaTarefas) {
        const acaoGrupo = isGroupActionType(t.tipo)
        const reqTime = new Date(t.quando)

        for (const gid of ids) {
          let adjusted = new Date(reqTime)
          if (!acaoGrupo) {
            const oneMinBefore = new Date(adjusted.getTime() - 60000)
            const oneMinAfter = new Date(adjusted.getTime() + 60000)
            const conflitos = await prisma.schedule.findMany({
              where: { status: 'pending', adjustedAt: { gte: oneMinBefore, lte: oneMinAfter } },
              orderBy: { adjustedAt: 'desc' }
            })
            if (conflitos.length > 0) {
              const delay = Math.floor(Math.random() * (60 - 15 + 1)) + 15
              adjusted = new Date(conflitos[0].adjustedAt.getTime() + delay * 1000)
            }
          }

          const rastreado = await aplicarRastreio(t.tipo, t.content, base, gid)
          const sch = await prisma.schedule.create({
            data: {
              groupId: gid,
              type: t.tipo,
              content: JSON.stringify(rastreado.content),
              scheduledAt: reqTime,
              adjustedAt: adjusted,
              status: 'pending'
            }
          })
          if (rastreado.links.length) {
            await prisma.trackedLink.updateMany({
              where: { id: { in: rastreado.links.map((l: any) => l.id) } },
              data: { scheduleId: sch.id }
            })
          }
          criadosTotal++
          if (!acaoGrupo && ids.length > 1) {
            reqTime.setTime(adjusted.getTime())
          }
        }
      }

      return texto({
        sucesso: true,
        gruposAfetados: ids.length,
        agendamentosPorGrupo: listaTarefas.length,
        totalCriados: criadosTotal
      })
    }
  },

  {
    name: 'relatorio_diario',
    description:
      'Consulta o relatório diário com métricas de mensagens enviadas, falhas, cliques em links, '
      + 'crescimento de membros e dados detalhados de cada tag. Suporta filtrar por tag.',
    inputSchema: {
      type: 'object',
      properties: {
        data: { type: 'string', description: 'Data em YYYY-MM-DD no fuso de SP (padrão hoje)' },
        tagId: { type: 'string', description: 'ID da tag para filtrar' },
        resumoTexto: { type: 'boolean', description: 'Se true, inclui o resumo textual formatado para o WhatsApp' }
      }
    },
    handler: async (args) => {
      const dataIso = args.data || hojeSP()
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dataIso)) {
        return texto('Formato de data inválido. Use YYYY-MM-DD.')
      }

      const rel = await montarRelatorio(prisma, dataIso, {
        comEnquetes: false,
        tagId: args.tagId
      })

      if (args.resumoTexto) {
        return texto({
          ...rel,
          textoFormatadoWhatsApp: resumoTexto(rel)
        })
      }

      return texto(rel)
    }
  },

  {
    name: 'listar_tags',
    description:
      'Lista as tags de grupos cadastradas, com quantidade de grupos, capacidade, membros e links de convite.',
    inputSchema: {
      type: 'object',
      properties: {
        busca: { type: 'string', description: 'Filtra pelo nome ou slug da tag' }
      }
    },
    handler: async (args) => {
      const tags = await prisma.tag.findMany({
        where: args.busca
          ? { OR: [{ name: { contains: args.busca } }, { slug: { contains: args.busca } }] }
          : undefined,
        include: {
          groups: {
            include: {
              group: {
                select: { id: true, name: true, participantCount: true, isFull: true }
              }
            },
            orderBy: { position: 'asc' }
          }
        },
        orderBy: { name: 'asc' }
      })

      return texto(tags.map(t => {
        const totalMembros = t.groups.reduce((acc, g) => acc + (g.group?.participantCount || 0), 0)
        return {
          id: t.id,
          nome: t.name,
          slug: t.slug,
          cor: t.color,
          capacidade: t.capacity,
          autoCreate: t.autoCreate,
          padraoNome: t.namePattern,
          linkConvite: t.inviteCode ? `/g/${t.inviteCode}` : null,
          totalGrupos: t.groups.length,
          totalMembros,
          grupos: t.groups.map(g => ({
            id: g.group?.id,
            nome: g.group?.name,
            membros: g.group?.participantCount,
            lotado: g.group?.isFull,
            posicao: g.position
          }))
        }
      }))
    }
  },

  {
    name: 'obter_documentacao',
    description:
      'Retorna a documentação completa ou específica de ferramentas do servidor MCP AlfaAltoGrup. '
      + 'Explica ferramentas disponíveis, parâmetros, tipos de agendamento, formatação de templates {n}, anti-ban e boas práticas.',
    inputSchema: {
      type: 'object',
      properties: {
        ferramenta: {
          type: 'string',
          description: 'Nome específico da ferramenta para obter detalhes (opcional). Se omitido, retorna a documentação completa.'
        }
      }
    },
    handler: async (args) => {
      const docsCompletos: Record<string, any> = {
        servidor: 'AlfaAltoGrup MCP Server (JSON-RPC 2.0)',
        versao: '1.1.0',
        visaoGeral: 'Servidor MCP HTTP para orquestração autônoma de grupos WhatsApp conectados via Evolution GO.',
        regrasAntiBan: {
          antiBanJitter: 'Mensagens e enquetes para múltiplos grupos recebem automaticamente espaçamento/jitter de até 1 minuto para evitar banimento.',
          acoesDeGrupo: 'Trocas de permissão e edições de perfil (nome/descrição/foto) utilizam espaçamento manual (mínimo 10s, padrão 45s).'
        },
        tiposDeAcao: {
          text: 'Envio de mensagem de texto com suporte a markdown WhatsApp e link tracking automático.',
          media: 'Envio de mídia (image, video, audio, document) com legenda e nome do arquivo opcional.',
          button: 'Envio de botões interativos (reply ou CTA link).',
          poll: 'Enquetes interativas com múltiplas opções configuráveis.',
          permission: 'Alteração em lote de permissões (announcement: aberto/fechado, restrict: admins/todos alteram dados).',
          profile: 'Edição de nome, descrição (tópico) e foto do grupo com templates numéricos {n}.'
        },
        templatesNome: {
          '{n}': 'Posição sequencial do grupo no lote (1, 2, 3...)',
          '{nn}': 'Posição sequencial com zero à esquerda (01, 02...)',
          '{total}': 'Quantidade total de grupos no lote',
          '{nome}': 'Nome atual do grupo antes da alteração'
        },
        ferramentas: FERRAMENTAS.map(f => ({
          name: f.name,
          description: f.description,
          inputSchema: f.inputSchema
        }))
      }

      if (args.ferramenta) {
        const f = FERRAMENTAS.find(item => item.name.toLowerCase() === args.ferramenta.toLowerCase().trim())
        if (!f) {
          return texto({
            erro: `Ferramenta '${args.ferramenta}' não encontrada.`,
            ferramentasDisponiveis: FERRAMENTAS.map(item => item.name)
          })
        }
        return texto({
          ferramenta: f.name,
          descricao: f.description,
          inputSchema: f.inputSchema,
          comoUsar: `Chame tools/call com name: "${f.name}" e arguments conforme o schema.`
        })
      }

      return texto(docsCompletos)
    }
  },
  // --------------------------------------------------- automacao de boas-vindas
  {
    name: 'welcome_list',
    description:
      'Lista todas as regras do Automatizador de Boas-Vindas (configuradas por Grupo ou por Tag), status (enabled), estatísticas de envios e últimos disparos da fila.',
    inputSchema: {
      type: 'object',
      properties: {
        limitQueue: {
          type: 'number',
          description: 'Quantidade máxima de itens recentes da fila a retornar (padrão 30).'
        }
      }
    },
    async handler(args) {
      const limit = Math.min(100, Math.max(1, Number(args.limitQueue || 30)))
      const [regras, fila] = await Promise.all([
        prisma.welcomeRule.findMany({
          include: {
            group: { select: { id: true, name: true, slug: true, instanceName: true } },
            tag: { select: { id: true, name: true, slug: true, instanceName: true } },
            _count: { select: { dispatches: true } }
          },
          orderBy: { updatedAt: 'desc' }
        }),
        prisma.welcomeDispatch.findMany({
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            group: { select: { id: true, name: true } }
          }
        })
      ])
      return texto({
        totalRegras: regras.length,
        regrasAtivas: regras.filter(r => r.enabled).length,
        regras: regras.map(r => ({
          id: r.id,
          escopo: r.tagId ? 'tag' : 'group',
          groupId: r.groupId,
          grupoNome: r.group?.name || null,
          tagId: r.tagId,
          tagNome: r.tag?.name || null,
          enabled: r.enabled,
          type: r.type,
          content: (() => {
            try { return JSON.parse(r.content) } catch { return { text: r.content } }
          })(),
          delayMinSec: r.delayMinSec,
          delayMaxSec: r.delayMaxSec,
          cooldownDays: r.cooldownDays,
          senderInstance: r.senderInstance,
          totalDispatches: r._count.dispatches
        })),
        filaRecente: fila
      })
    }
  },
  {
    name: 'welcome_upsert',
    description:
      'Cria ou atualiza uma regra de Boas-Vindas no Privado para um Grupo (groupId/slug) ou para uma Tag (tagId/tagSlug). Suporta os tipos text, media, button e poll, variáveis dinâmicas ({nome}, {primeiro_nome}, {grupo}, {tag}, {saudacao_emoji}), Spintax e rastreio de links.',
    inputSchema: {
      type: 'object',
      properties: {
        groupId: { type: 'string', description: 'ID ou slug do grupo (exclusivo com tagId)' },
        tagId: { type: 'string', description: 'ID ou slug da Tag (exclusivo com groupId)' },
        enabled: { type: 'boolean', description: 'Se a automação já inicia ativa (padrão false para permitir teste seguro antes)' },
        type: { type: 'string', enum: ['text', 'media', 'button', 'poll'], description: 'Formato da mensagem de boas-vindas' },
        content: { type: 'object', description: 'Conteúdo da mensagem (mesmo formato de schedule_create: text, media, button ou poll)' },
        trackLinks: { type: 'boolean', description: 'Se true, converte URLs em links curtos rastreáveis /l/xxxxx?grupid=xxxx' },
        delayMinSec: { type: 'number', description: 'Delay mínimo em segundos após entrar no grupo (padrão 45)' },
        delayMaxSec: { type: 'number', description: 'Delay máximo em segundos após entrar no grupo (padrão 150)' },
        cooldownDays: { type: 'number', description: 'Dias sem repetir boas-vindas para o mesmo número (padrão 30)' },
        senderInstance: { type: 'string', description: 'Instância remetente opcional (se omitido, usa a instância do grupo)' }
      },
      required: ['type', 'content']
    },
    async handler(args) {
      let resolvedGroupId: string | null = null
      let resolvedTagId: string | null = null

      if (args.groupId) {
        const g = await prisma.group.findFirst({
          where: { OR: [{ id: String(args.groupId) }, { slug: String(args.groupId) }] }
        })
        if (!g) return texto({ erro: `Grupo não encontrado: ${args.groupId}` })
        resolvedGroupId = g.id
      } else if (args.tagId) {
        const t = await prisma.tag.findFirst({
          where: { OR: [{ id: String(args.tagId) }, { slug: String(args.tagId) }, { name: String(args.tagId) }] }
        })
        if (!t) return texto({ erro: `Tag não encontrada: ${args.tagId}` })
        resolvedTagId = t.id
      } else {
        return texto({ erro: 'Informe groupId OU tagId.' })
      }

      const type = String(args.type || 'text')
      const rawContent = typeof args.content === 'string' ? JSON.parse(args.content) : { ...(args.content || {}) }
      if (args.trackLinks !== undefined) rawContent.trackLinks = Boolean(args.trackLinks)

      const problema = validateScheduleContent(type as any, rawContent)
      if (problema) return texto({ erro: problema })

      const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '')
      const rastreado = await aplicarRastreio(type, rawContent, baseUrl, resolvedGroupId || undefined)

      const delayMinSec = Math.max(10, Math.min(3600, Number(args.delayMinSec ?? 45)))
      const delayMaxSec = Math.max(delayMinSec, Math.min(7200, Number(args.delayMaxSec ?? 150)))
      const cooldownDays = Math.max(1, Math.min(365, Number(args.cooldownDays ?? 30)))
      const enabled = args.enabled !== undefined ? Boolean(args.enabled) : false
      const senderInstance = args.senderInstance ? String(args.senderInstance).trim() : null

      const dataPayload = {
        type,
        content: JSON.stringify(rastreado.content),
        enabled,
        delayMinSec,
        delayMaxSec,
        cooldownDays,
        senderInstance
      }

      const rule = resolvedGroupId
        ? await prisma.welcomeRule.upsert({
            where: { groupId: resolvedGroupId },
            update: dataPayload,
            create: { groupId: resolvedGroupId, ...dataPayload }
          })
        : await prisma.welcomeRule.upsert({
            where: { tagId: resolvedTagId! },
            update: dataPayload,
            create: { tagId: resolvedTagId!, ...dataPayload }
          })

      return texto({ ok: true, rule, linksCriados: rastreado.links.length })
    }
  },
  {
    name: 'welcome_toggle',
    description: 'Ativa ou desativa (enabled: true/false) uma regra de Boas-Vindas por id, groupId ou tagId.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID da regra WelcomeRule' },
        groupId: { type: 'string', description: 'ID ou slug do grupo' },
        tagId: { type: 'string', description: 'ID ou slug da Tag' },
        enabled: { type: 'boolean', description: 'true para ativar, false para desativar' }
      },
      required: ['enabled']
    },
    async handler(args) {
      let rule = null
      if (args.id) {
        rule = await prisma.welcomeRule.findUnique({ where: { id: String(args.id) } })
      } else if (args.groupId) {
        const g = await prisma.group.findFirst({ where: { OR: [{ id: String(args.groupId) }, { slug: String(args.groupId) }] } })
        if (g) rule = await prisma.welcomeRule.findUnique({ where: { groupId: g.id } })
      } else if (args.tagId) {
        const t = await prisma.tag.findFirst({ where: { OR: [{ id: String(args.tagId) }, { slug: String(args.tagId) }] } })
        if (t) rule = await prisma.welcomeRule.findUnique({ where: { tagId: t.id } })
      }
      if (!rule) return texto({ erro: 'Regra de boas-vindas não encontrada.' })
      const updated = await prisma.welcomeRule.update({
        where: { id: rule.id },
        data: { enabled: Boolean(args.enabled) }
      })
      return texto({ ok: true, rule: updated })
    }
  },
  {
    name: 'welcome_delete',
    description: 'Remove uma regra de Boas-Vindas e limpa seus disparos na fila.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID da regra WelcomeRule' },
        groupId: { type: 'string', description: 'ID do grupo' },
        tagId: { type: 'string', description: 'ID da Tag' }
      }
    },
    async handler(args) {
      const where = args.id
        ? { id: String(args.id) }
        : args.groupId
          ? { groupId: String(args.groupId) }
          : args.tagId
            ? { tagId: String(args.tagId) }
            : null
      if (!where) return texto({ erro: 'Informe id, groupId ou tagId.' })
      await prisma.welcomeRule.delete({ where })
      return texto({ ok: true })
    }
  },
  {
    name: 'welcome_test',
    description:
      'Executa um disparo de TESTE SEGURO de uma regra de Boas-Vindas entre instâncias conectadas (targetInstanceName) ou para um número/grupo de teste (targetPhoneOrJid), sem ativar em grupos finais.',
    inputSchema: {
      type: 'object',
      properties: {
        ruleId: { type: 'string', description: 'ID da regra WelcomeRule a testar' },
        targetInstanceName: { type: 'string', description: 'Nome da instância conectada que receberá a mensagem de teste' },
        targetPhoneOrJid: { type: 'string', description: 'Telefone ou JID de grupo de teste (grupos finais são bloqueados)' },
        targetName: { type: 'string', description: 'Nome fictício do membro para interpolar {nome} / {primeiro_nome}' },
        senderInstance: { type: 'string', description: 'Instância remetente opcional para o teste' }
      },
      required: ['ruleId']
    },
    async handler(args) {
      const rule = await prisma.welcomeRule.findUnique({
        where: { id: String(args.ruleId) },
        include: {
          group: true,
          tag: {
            include: {
              groups: { orderBy: { position: 'asc' }, take: 1, include: { group: true } }
            }
          }
        }
      })
      if (!rule) return texto({ erro: 'Regra não encontrada.' })

      const apiUrl = process.env.EVOLUTION_API_URL || ''
      const apiKey = process.env.EVOLUTION_API_KEY || ''
      const instList = await listarInstanciasEvolution(apiUrl, apiKey)

      let recipient = ''
      let targetLabel = String(args.targetName || 'Teste Entre Instâncias')
      if (args.targetInstanceName) {
        const found = instList.find((i: any) => i.name === String(args.targetInstanceName).trim())
        if (!found || !found.phone) return texto({ erro: `Instância de destino ${args.targetInstanceName} não encontrada.` })
        recipient = found.phone
        targetLabel = found.name
      } else if (args.targetPhoneOrJid) {
        const raw = String(args.targetPhoneOrJid).trim()
        if (raw.endsWith('@g.us')) {
          const tg = await prisma.group.findFirst({ where: { evolutionGroupId: raw } })
          if (tg && !/teste|test/i.test(tg.name)) {
            return texto({ erro: 'Bloqueio de segurança: não é permitido testar em grupos finais.' })
          }
          recipient = raw
        } else {
          recipient = cleanPhoneDigits(raw)
        }
      }
      if (!recipient) return texto({ erro: 'Informe targetInstanceName ou targetPhoneOrJid válido.' })

      const sampleGroup = rule.group || rule.tag?.groups?.[0]?.group || (await prisma.group.findFirst())
      if (!sampleGroup) return texto({ erro: 'Nenhum grupo cadastrado para contexto.' })

      const preferredSender = args.senderInstance || rule.senderInstance || sampleGroup.instanceName || ''
      const senderInst = selecionarInstanciaRemetenteConectada(instList, preferredSender, recipient)
      if (!senderInst?.token) return texto({ erro: 'Sem instância remetente conectada.' })

      const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '')
      let rawContent: any = {}
      try {
        rawContent = JSON.parse(rule.content || '{}')
      } catch {
        rawContent = { text: String(rule.content || '') }
      }
      const ctx = await montarContextoGrupo(prisma, sampleGroup, {
        baseUrl,
        tag: rule.tag || undefined,
        campaign: 'boas-vindas-teste',
        memberName: targetLabel,
        memberPhone: cleanPhoneDigits(recipient) || recipient
      })
      const resolvedContent = resolverConteudoAgendamento(rule.type, rawContent, ctx)

      const sendRes = await sendEvolutionWelcomeMessage(
        apiUrl,
        senderInst.token,
        recipient,
        rule.type,
        resolvedContent,
        (u: string) => (u && !/^https?:\/\//i.test(u) && baseUrl ? `${baseUrl}${u.startsWith('/') ? '' : '/'}${u}` : u)
      )

      const dispatch = await prisma.welcomeDispatch.create({
        data: {
          ruleId: rule.id,
          groupId: sampleGroup.id,
          tagId: rule.tagId || null,
          phone: recipient,
          displayName: `[TESTE] ${targetLabel}`,
          status: sendRes.ok ? 'sent' : 'error',
          scheduledAt: new Date(),
          sentAt: sendRes.ok ? new Date() : null,
          attempts: 1,
          errorMessage: sendRes.ok ? null : `HTTP ${sendRes.status}`,
          isTest: true
        }
      })

      return texto({ ok: sendRes.ok, senderInstance: senderInst.name, recipient, resolvedContent, dispatch })
    }
  },
  {
    name: 'welcome_queue_control',
    description: 'Controla a fila de disparos de Boas-Vindas (cancel_pending ou retry_errors).',
    inputSchema: {
      type: 'object',
      properties: {
        subAction: { type: 'string', enum: ['cancel_pending', 'retry_errors'], description: 'Ação na fila' },
        ruleId: { type: 'string', description: 'Filtrar opcionalmente por ruleId' }
      },
      required: ['subAction']
    },
    async handler(args) {
      const ruleId = args.ruleId ? String(args.ruleId) : undefined
      if (args.subAction === 'cancel_pending') {
        const r = await prisma.welcomeDispatch.updateMany({
          where: { status: 'pending', ...(ruleId ? { ruleId } : {}) },
          data: { status: 'skipped', errorMessage: 'Cancelado via MCP' }
        })
        return texto({ ok: true, afetados: r.count })
      }
      if (args.subAction === 'retry_errors') {
        const r = await prisma.welcomeDispatch.updateMany({
          where: { status: 'error', ...(ruleId ? { ruleId } : {}) },
          data: { status: 'pending', attempts: 0, errorMessage: null, scheduledAt: new Date(Date.now() + 20000) }
        })
        return texto({ ok: true, afetados: r.count })
      }
      return texto({ erro: 'subAction inválida' })
    }
  }
// fim de FERRAMENTAS
]

// -------------------------------------------------------------- JSON-RPC

function resposta(id: any, result: any) {
  return NextResponse.json({ jsonrpc: '2.0', id, result })
}

function erro(id: any, code: number, message: string, status = 200) {
  return NextResponse.json({ jsonrpc: '2.0', id, error: { code, message } }, { status })
}

export async function POST(request: Request) {
  const chave = chaveDoHeader(request)
  if (!chave || !(await validarChaveApi(chave))) {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Chave de API inválida ou ausente' } },
      { status: 401 }
    )
  }

  let corpo: any
  try {
    corpo = await request.json()
  } catch {
    return erro(null, -32700, 'JSON inválido', 400)
  }

  const { id = null, method, params } = corpo || {}

  if (method === 'initialize') {
    return resposta(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: 'alfaaltogrup', version: '1.0.0' }
    })
  }

  // Notificação: o cliente não espera resposta.
  if (typeof method === 'string' && method.startsWith('notifications/')) {
    return new NextResponse(null, { status: 204 })
  }

  if (method === 'tools/list') {
    return resposta(id, {
      tools: FERRAMENTAS.map(f => ({
        name: f.name,
        description: f.description,
        inputSchema: f.inputSchema
      }))
    })
  }

  if (method === 'tools/call') {
    const nome = params?.name
    const ferramenta = FERRAMENTAS.find(f => f.name === nome)
    if (!ferramenta) return erro(id, -32602, `Ferramenta desconhecida: ${nome}`)

    try {
      const resultado = await ferramenta.handler(params?.arguments || {})
      return resposta(id, resultado)
    } catch (e: any) {
      console.error(`[MCP] erro em ${nome}:`, e)
      return resposta(id, {
        content: [{ type: 'text', text: `Erro ao executar ${nome}: ${e?.message || e}` }],
        isError: true
      })
    }
  }

  return erro(id, -32601, `Método não suportado: ${method}`)
}

/** GET simples para conferir se o endpoint está de pé. */
export async function GET(request: Request) {
  const chave = chaveDoHeader(request)
  if (!chave || !(await validarChaveApi(chave))) {
    return NextResponse.json({ error: 'Chave de API inválida ou ausente' }, { status: 401 })
  }
  return NextResponse.json({
    servidor: 'alfaaltogrup',
    protocolo: PROTOCOL_VERSION,
    transporte: 'JSON-RPC 2.0 sobre HTTP POST',
    ferramentas: FERRAMENTAS.map(f => f.name)
  })
}
