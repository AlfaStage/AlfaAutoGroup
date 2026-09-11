import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { isAuthenticated } from '@/lib/auth'
import { ESPACO_PADRAO_S, ESPACO_MINIMO_S } from '@/lib/bulk-edit'

const prisma = new PrismaClient()

/**
 * @swagger
 * /api/bulk/profile/{id}/undo:
 *   post:
 *     summary: Desfaz um lote de edição em massa
 *     description: >
 *       Reagenda os nomes e descrições que os grupos tinham antes do lote.
 *       A foto não é restaurada — a imagem anterior não é guardada.
 *       Agendamentos do lote que ainda não executaram são desativados.
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Reversão agendada.
 *       404:
 *         description: Lote não encontrado.
 *       409:
 *         description: Lote já desfeito.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isAuthenticated(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const lote = await prisma.bulkEdit.findUnique({ where: { id } })
    if (!lote) return NextResponse.json({ error: 'Lote não encontrado' }, { status: 404 })
    if (lote.undoneAt) {
      return NextResponse.json({ error: 'Este lote já foi desfeito' }, { status: 409 })
    }

    const snapshot: { groupId: string; name: string; topic: string }[] =
      JSON.parse(lote.snapshot)

    let pedido: any = {}
    try { pedido = JSON.parse(lote.payload) } catch { /* lote antigo */ }

    const espaco = Math.max(
      ESPACO_MINIMO_S,
      Number(pedido?.spacingSeconds) || ESPACO_PADRAO_S
    )

    // Cancela o que ainda não saiu deste lote, para não brigar com a reversão.
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
      where: { id },
      data: { undoneAt: new Date() }
    })

    return NextResponse.json({
      desfeito: true,
      reagendados: criados,
      canceladosDoLote: cancelados.count,
      observacao: 'A foto não é restaurada — a imagem anterior não é guardada.'
    }, { status: 201 })
  } catch (error) {
    console.error('Erro ao desfazer lote:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
