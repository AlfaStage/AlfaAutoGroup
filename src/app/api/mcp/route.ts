import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
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

const prisma = new PrismaClient()

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

  return { path: `/api/uploads/${nome}`, mediatype: tipoDeMidia(ext), bytes: buffer.length }
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
      const s = await prisma.schedule.findUnique({
        where: { id: args.agendamentoId },
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
        path: r.path,
        mediatype: r.mediatype,
        bytes: r.bytes,
        comoUsar: `Use "${r.path}" em content.media (com mediatype "${r.mediatype}") ou em content.picture.`
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
      const s = await prisma.schedule.findUnique({ where: { id: args.agendamentoId } })
      if (!s) return texto('Agendamento não encontrado.')
      if (s.status !== 'pending') {
        return texto(`Não dá para cancelar: o agendamento está como "${s.status}".`)
      }
      await prisma.schedule.update({
        where: { id: args.agendamentoId },
        data: { status: 'deactivated' }
      })
      return texto({ cancelado: true, id: args.agendamentoId })
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
  }
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
