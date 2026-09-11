import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { isAuthenticated } from '@/lib/auth'
import { runGroupTask } from '@shared/group-tasks'
import { persistGroupState } from '@/lib/group-state'
import { validateScheduleContent } from '@/lib/schedule-types'

const prisma = new PrismaClient()

function baseUrlFrom(request: Request) {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  const host = request.headers.get('host')
  if (!host) return ''
  const proto = request.headers.get('x-forwarded-proto') || 'http'
  return `${proto}://${host}`
}

/**
 * @swagger
 * /api/groups/{id}/profile:
 *   post:
 *     summary: Altera nome, descrição e/ou foto do grupo agora
 *     description: >
 *       Só os campos enviados são alterados. `picture` aceita uma URL pública
 *       ou um caminho `/api/uploads/<arquivo>` devolvido por POST /api/upload.
 *       O estado atual é conferido antes: nome ou descrição idênticos ao que já
 *       está no grupo não são reenviados, e a resposta volta com status "skipped".
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Alterado, ou já estava assim.
 *       400:
 *         description: Pedido inválido.
 *       401:
 *         description: Não autorizado.
 *       404:
 *         description: Grupo não encontrado.
 *       502:
 *         description: A Evolution recusou a alteração.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isAuthenticated(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const content = await request.json() as {
      name?: string
      description?: string
      picture?: string
    }

    const problema = validateScheduleContent('profile', content)
    if (problema) {
      return NextResponse.json({ error: problema }, { status: 400 })
    }

    const group = await prisma.group.findUnique({ where: { id } })
    if (!group?.instanceName || !group.evolutionGroupId) {
      return NextResponse.json({ error: 'Grupo sem vínculo com a Evolution' }, { status: 404 })
    }

    const result = await runGroupTask({
      group,
      kind: 'profile',
      payload: content,
      baseUrl: baseUrlFrom(request)
    })

    if (result.status === 'error') {
      return NextResponse.json({ error: result.message }, { status: 502 })
    }

    if (result.groupData) {
      await persistGroupState(id, result.groupData)
    }

    return NextResponse.json({
      success: true,
      status: result.status, // done | skipped
      message: result.message,
      applied: result.applied || [],
      alreadyOk: result.alreadyOk || []
    })
  } catch (error) {
    console.error('Erro ao alterar o perfil do grupo:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
