import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { isAuthenticated } from '@/lib/auth'
import {
  montarPrevia,
  contentDaLinha,
  validarPedido,
  type PedidoEmMassa
} from '@/lib/bulk-edit'

const prisma = new PrismaClient()

/**
 * @swagger
 * /api/bulk/profile:
 *   post:
 *     summary: Edita nome, descrição e/ou foto de vários grupos
 *     description: >
 *       Com `dryRun: true` devolve apenas a prévia, sem gravar nada.
 *       Sem ele, cria um agendamento `profile` por grupo, espaçados por
 *       `spacingSeconds`, e guarda o estado anterior para permitir desfazer.
 *       O template de nome aceita as variáveis {n}, {nn}, {total} e {nome}.
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Prévia (dryRun) ou lote criado.
 *       400:
 *         description: Pedido inválido.
 *       401:
 *         description: Não autorizado.
 */
export async function POST(request: Request) {
  try {
    if (!(await isAuthenticated(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as PedidoEmMassa & {
      groupIds?: string[]
      dryRun?: boolean
    }

    const ids = Array.isArray(body.groupIds) ? body.groupIds : []

    const grupos = await prisma.group.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, topic: true },
      orderBy: { name: 'asc' }
    })

    const problema = validarPedido(body, grupos.length)
    if (problema) return NextResponse.json({ error: problema }, { status: 400 })

    const previa = montarPrevia(grupos, body)

    // Linhas que não mudam nada são descartadas: o verificador do executor
    // as marcaria como "skipped" de qualquer forma.
    const efetivas = previa.filter(l => l.mudaNome || l.mudaDescricao || l.mudaFoto)

    if (body.dryRun) {
      return NextResponse.json({
        previa,
        totalSelecionados: grupos.length,
        totalComMudanca: efetivas.length
      })
    }

    if (efetivas.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum grupo mudaria com esse pedido' },
        { status: 400 }
      )
    }

    const lote = await prisma.bulkEdit.create({
      data: {
        payload: JSON.stringify(body),
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
          content: JSON.stringify(contentDaLinha(linha, body)),
          scheduledAt: quando,
          // Ações de grupo não passam pelo ajuste anti-ban: o espaçamento
          // já vem do próprio lote.
          adjustedAt: quando,
          status: 'pending'
        }
      })
    }

    return NextResponse.json({
      loteId: lote.id,
      agendados: efetivas.length,
      primeiro: efetivas[0].quando,
      ultimo: efetivas[efetivas.length - 1].quando
    }, { status: 201 })
  } catch (error) {
    console.error('Erro na edição em massa:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * @swagger
 * /api/bulk/profile:
 *   get:
 *     summary: Lista os lotes de edição em massa
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Lotes, do mais recente para o mais antigo.
 */
export async function GET(request: Request) {
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const lotes = await prisma.bulkEdit.findMany({
    orderBy: { createdAt: 'desc' },
    take: 30
  })

  return NextResponse.json(lotes.map(l => ({
    id: l.id,
    total: l.total,
    undoneAt: l.undoneAt,
    createdAt: l.createdAt,
    payload: (() => { try { return JSON.parse(l.payload) } catch { return null } })()
  })))
}
